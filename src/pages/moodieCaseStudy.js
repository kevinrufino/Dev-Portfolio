export const moodieCaseStudy = {
  status: 'MOODIE · MOODI.ME · IN BUILD',
  title: 'A recommendation engine trained on one person’s taste',
  summary:
    'A personal culture archive that maps a thousand saved images into a navigable taste graph.',
  meta: [
    {
      label: 'Timeline',
      values: ['2025 — ongoing', 'Nights and weekends'],
    },
    {
      label: 'Scope',
      values: [
        'Product design',
        'Frontend architecture',
        'Embedding pipeline',
        'Design system',
      ],
    },
    {
      label: 'Worked with',
      values: [
        'Solo build',
        'Architecture review with',
        'two backend engineers',
      ],
    },
    {
      label: 'Stack',
      values: [
        'Next.js 14 · Vercel',
        'Supabase · pgvector',
        'Python · FastAPI · CLIP',
      ],
    },
  ],
  context: [
    {
      label: 'Project context / Why it exists',
      title: 'Every recommendation system I use is trained on everyone else.',
      body: 'Spotify, Pinterest, and TikTok model taste as a cluster you fall into. I wanted the inverse: a system with a training set of one. Moodie ingests my own saved images—streetwear, food, Filipino visual culture, graphic design—and maps the relationships between them. The question it answers is not “what do people like you like,” it is “what else is near this?”',
    },
    {
      label: 'Why it matters',
      title:
        'A taste graph is a design problem before it is a machine-learning problem.',
      body: 'The embeddings were never the hard part. The hard part was deciding what a neighbour means, how far is too far, and what a person should be able to do with a 768-dimensional space once it has been flattened onto a screen. Each of those is a design decision with an engineering bill attached.',
    },
  ],
  artifacts: {
    label: 'Final artifacts',
    title: 'The canvas, the pipeline, and the schema that hold them together.',
    body: 'Three artifacts carry the work: the interactive canvas a visitor actually touches, the offline pipeline that fills it, and the four-table schema that keeps every query to a single hop.',
    captions: [
      'The navigable taste canvas, where proximity becomes the primary interface.',
      'The offline path from saved image to embedding, projection, and rendered neighbour.',
    ],
  },
  momentsIntro: {
    label: 'Key design moments',
    title: 'Three decisions the rest of the build hangs on.',
    body: 'Each had a real alternative, a real cost, and a reason I would defend in review. The decisions without a defensible reason are not on this page.',
  },
  moments: [
    {
      index: '01',
      tone: 'cyan',
      type: 'Tradeoff',
      tension:
        'Locking the embedding model early meant every later improvement would cost a full re-embed.',
      options: [
        {
          label: 'A',
          title:
            'Start on a small, fast model—CLIP ViT-B/32 at 512 dimensions.',
          cost: 'Cheaper to run and quicker to iterate, but measurably worse at fine-grained visual similarity.',
        },
        {
          label: 'B',
          title:
            'Commit to CLIP ViT-L/14 at 768 dimensions before the first batch.',
          cost: 'Slower to embed and more storage per row, but a much higher ceiling for “similar.”',
        },
      ],
      call: 'ViT-L/14 at 768 dimensions, locked before the first batch ran.',
      why: 'Re-embedding is not a code change; it is a data migration across every row, a full UMAP recompute, and a rebuilt HNSW index. Paying once up front was cheaper than paying that bill later.',
    },
    {
      index: '02',
      tone: 'yellow',
      type: 'Decision',
      tension:
        'The layout algorithm decides what “near” looks like, and the two candidates disagree about what they preserve.',
      options: [
        {
          label: 'A',
          title: 't-SNE.',
          cost: 'Beautiful local clusters, but global distance becomes meaningless.',
        },
        {
          label: 'B',
          title: 'UMAP.',
          cost: 'Slightly looser clusters, but the global structure survives the projection.',
        },
      ],
      call: 'UMAP, with x/y precomputed into a separate layouts table.',
      why: 'The canvas invites people to pan across the whole space, not inspect one cluster at a time. That interaction only tells the truth if the distance between clusters means something.',
    },
    {
      index: '03',
      tone: 'pink',
      type: 'Controversial',
      tension:
        'The only source of my own taste data at real scale was a platform whose terms discourage exactly this.',
      options: [
        {
          label: 'A',
          title: 'Use the official Pinterest API.',
          cost: 'Sanctioned and stable, but OAuth-gated, rate-limited, and awkward for storing image data.',
        },
        {
          label: 'B',
          title:
            'Intercept the board page’s XHR responses, with a DOM fallback.',
          cost: 'Fast and complete, but fragile against frontend changes.',
        },
        {
          label: 'C',
          title: 'Manual export.',
          cost: 'Unambiguously fine, and unusable at a thousand items.',
        },
      ],
      call: 'XHR interception with a DOM fallback, scoped to my own boards and never redistributed.',
      why: 'This is the weakest link in the project and I would rather say so than bury it. If Moodie ever becomes something other people log into, this gets rebuilt on the official API before anything else ships.',
    },
  ],
  impact: {
    title:
      'The system runs end to end. The numbers that would prove it is fast are not in yet.',
    body: 'Moodie is a personal project without users, so the honest measures are about the pipeline rather than adoption. The one number that matters to the experience—how long a neighbour lookup takes at p95—is blank until the HNSW index lands.',
    stats: [
      {
        figure: '1,000',
        label: 'Items embedded',
        context:
          'Pinterest saves at CLIP ViT-L/14. Roughly 500MB in object storage.',
      },
      {
        figure: '768',
        label: 'Dimensions per item',
        context:
          'Locked before the first batch. Changing it means re-embedding everything.',
      },
      {
        figure: '4',
        label: 'Tables',
        context:
          'Items, media, embeddings, layouts. No query crosses more than two.',
      },
      {
        figure: '—',
        label: 'p95 neighbour query',
        context:
          'Not measured yet. This stays deliberately blank until the index lands.',
      },
    ],
  },
  reflections: [
    {
      title:
        'Locking a decision early is a design act, not an engineering shortcut.',
      body: 'The embedding model looked like infrastructure. It set the ceiling on how good “similar” could ever feel, which made it the most consequential design decision in the project.',
    },
    {
      title: 'Precomputation is what makes an interface feel like a place.',
      body: 'Nothing about the canvas feels responsive because of clever rendering. It feels responsive because the expensive question—where does everything go—was answered offline.',
    },
    {
      title: 'I can defend the architecture faster than I can defend the look.',
      body: 'Writing down why the canvas looks the way it does took three times as long as the implementation. Closing that gap is the thing I am deliberately working on next.',
    },
  ],
};
