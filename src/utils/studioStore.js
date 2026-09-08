/**
 * The studio's storage and its way out.
 *
 * There is no CMS behind this and there is not meant to be. The editor runs in
 * the browser, keeps its work locally, and ends by handing over a bundle: one
 * JSON file the site reads, and the assets it refers to. Dropping that bundle
 * into the repo and committing it is the publish step — which is the whole
 * point, because the site is static and its content should be reviewable in a
 * diff like everything else.
 *
 * Two stores, because they have very different shapes:
 *
 * - The DRAFT (every word and every block, plus the order the works pane
 *   should list them in) is small and goes in localStorage, so a reload never
 *   loses an afternoon of writing.
 * - The ASSETS are megabytes of video and go in IndexedDB, which is the only
 *   browser store that will hold them. They are kept as real Blobs, so the
 *   export writes the original bytes rather than a re-encoded copy.
 */

const DRAFT_KEY = 'studio.draft.v2';
// v1 kept the projects map at the top level. v2 keeps `{ projects, order }`,
// because the order the works pane lists them in belongs to the draft too and
// is not a property of any one project. A v1 draft is somebody's afternoon, so
// it is lifted into the new shape rather than dropped.
const DRAFT_KEY_V1 = 'studio.draft.v1';
const DB_NAME = 'studio-assets';
const DB_STORE = 'files';

// ── the draft ───────────────────────────────────────────────────────────────

export function loadDraft() {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (raw) return JSON.parse(raw);
    const legacy = window.localStorage.getItem(DRAFT_KEY_V1);
    return legacy ? { projects: JSON.parse(legacy), order: {} } : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    // Quota, private mode, or a draft that has somehow grown enormous. The
    // editor keeps working from memory; only the safety net is gone.
    return false;
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
    window.localStorage.removeItem(DRAFT_KEY_V1);
  } catch {
    /* nothing to do */
  }
}

// ── the assets ──────────────────────────────────────────────────────────────

const openDb = () =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const tx = async (mode, run) => {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(DB_STORE, mode);
    const store = transaction.objectStore(DB_STORE);
    const request = run(store);
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error);
  });
};

/** Keep one file under a path, e.g. `max-s-lab/cover.mp4`. */
export const putAsset = (path, file) => tx('readwrite', s => s.put(file, path));

export const getAsset = path => tx('readonly', s => s.get(path));

export const deleteAsset = path => tx('readwrite', s => s.delete(path));

export const listAssets = () => tx('readonly', s => s.getAllKeys());

// ── the bundle ──────────────────────────────────────────────────────────────

const CRC = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return bytes => {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  };
})();

/**
 * A store-only zip.
 *
 * Written by hand rather than pulled in as a dependency: the whole format for
 * uncompressed entries is three small records, and everything going in here is
 * already compressed — mp4, webp, png — so deflating it would spend CPU to
 * make the file marginally larger.
 *
 * @param {{name: string, bytes: Uint8Array}[]} files
 * @returns {Blob}
 */
export function zip(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;

  const u16 = n => [n & 0xff, (n >>> 8) & 0xff];
  const u32 = n => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

  for (const file of files) {
    const name = encoder.encode(file.name);
    const crc = CRC(file.bytes);
    const size = file.bytes.length;

    const local = new Uint8Array([
      0x50, 0x4b, 0x03, 0x04,
      ...u16(20), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(name.length), ...u16(0),
    ]);
    chunks.push(local, name, file.bytes);

    central.push(
      new Uint8Array([
        0x50, 0x4b, 0x01, 0x02,
        ...u16(20), ...u16(20), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0),
        ...u32(crc), ...u32(size), ...u32(size),
        ...u16(name.length), ...u16(0), ...u16(0),
        ...u16(0), ...u16(0), ...u32(0),
        ...u32(offset),
      ]),
      name,
    );
    offset += local.length + name.length + size;
  }

  const directory = central.reduce((n, part) => n + part.length, 0);
  const end = new Uint8Array([
    0x50, 0x4b, 0x05, 0x06,
    ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(directory), ...u32(offset),
    ...u16(0),
  ]);

  return new Blob([...chunks, ...central, end], { type: 'application/zip' });
}

/** Hand a blob to the browser as a download. */
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Long enough for the download to have started; revoking immediately
  // cancels it in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
