// oneko.js: https://github.com/adryd325/oneko.js

(function oneko() {
  const isReducedMotion =
    window.matchMedia(`(prefers-reduced-motion: reduce)`) === true ||
    window.matchMedia(`(prefers-reduced-motion: reduce)`).matches === true;

  if (isReducedMotion) return;

  const nekoEl = document.createElement("div");

  let nekoPosX = 32;
  let nekoPosY = 32;

  let mousePosX = 0;
  let mousePosY = 0;

  let frameCount = 0;
  let idleTime = 0;
  let idleAnimation = null;
  let idleAnimationFrame = 0;

  const nekoSpeed = 20;

  // The cat belongs to the intro and the footer, and to nothing else. It is
  // one script for the whole document, so rather than mounting and unmounting
  // it, it fades out wherever it has no business being — over the hero, the
  // works pane, the marquee — and keeps walking behind the scenes so it is
  // already in the right place when the reader comes back.
  const HOME_SECTIONS = '#intro, #contact';

  // Following the TRAIL, not the pointer.
  //
  // `PixelTrail` publishes the path it painted along as `window.__pixelTrail`.
  // Walking that queue in order means the cat retraces the route the reader's
  // hand took — round the loops and doublings-back — instead of cutting the
  // corner to wherever the cursor ended up. When the trail has faded there is
  // nothing left to walk, and it goes back to chasing the cursor itself.
  const TRAIL_MAX_AGE_MS = 1400; // roughly how long a trail cell stays visible
  const TRAIL_ARRIVE_PX = 24; // close enough to call a point reached
  const MOUSE_ARRIVE_PX = 48; // the cat sits this far off the cursor
  let followedId = -1;
  const spriteSets = {
    idle: [[-3, -3]],
    alert: [[-7, -3]],
    scratchSelf: [
      [-5, 0],
      [-6, 0],
      [-7, 0],
    ],
    scratchWallN: [
      [0, 0],
      [0, -1],
    ],
    scratchWallS: [
      [-7, -1],
      [-6, -2],
    ],
    scratchWallE: [
      [-2, -2],
      [-2, -3],
    ],
    scratchWallW: [
      [-4, 0],
      [-4, -1],
    ],
    tired: [[-3, -2]],
    sleeping: [
      [-2, 0],
      [-2, -1],
    ],
    N: [
      [-1, -2],
      [-1, -3],
    ],
    NE: [
      [0, -2],
      [0, -3],
    ],
    E: [
      [-3, 0],
      [-3, -1],
    ],
    SE: [
      [-5, -1],
      [-5, -2],
    ],
    S: [
      [-6, -3],
      [-7, -2],
    ],
    SW: [
      [-5, -3],
      [-6, -1],
    ],
    W: [
      [-4, -2],
      [-4, -3],
    ],
    NW: [
      [-1, 0],
      [-1, -1],
    ],
  };

  function init() {
    nekoEl.id = "oneko";
    nekoEl.ariaHidden = true;
    nekoEl.style.width = "32px";
    nekoEl.style.height = "32px";
    nekoEl.style.position = "fixed";
    nekoEl.style.pointerEvents = "auto";
    nekoEl.style.imageRendering = "pixelated";
    // Left, not right: `frame` writes `left` on every move, and starting from
    // the opposite edge made the first step jump the width of the screen.
    nekoEl.style.left = `${nekoPosX - 16}px`;
    nekoEl.style.top = `${nekoPosY - 16}px`;
    nekoEl.style.zIndex = 20;
    nekoEl.style.mixBlendMode = "difference";
    nekoEl.style.transition = "opacity 260ms ease";

    let nekoFile = "./oneko-white.png";
    const curScript = document.currentScript;
    if (curScript && curScript.dataset.cat) {
      nekoFile = curScript.dataset.cat;
    }
    nekoEl.style.backgroundImage = `url(${nekoFile})`;

    document.body.appendChild(nekoEl);

    document.addEventListener("mousemove", function (event) {
      mousePosX = event.clientX;
      mousePosY = event.clientY;
    });

    window.requestAnimationFrame(onAnimationFrame);
  }

  let lastFrameTimestamp;

  function onAnimationFrame(timestamp) {
    // Stops execution if the neko element is removed from DOM
    if (!nekoEl.isConnected) {
      return;
    }
    if (!lastFrameTimestamp) {
      lastFrameTimestamp = timestamp;
    }
    if (timestamp - lastFrameTimestamp > 100) {
      lastFrameTimestamp = timestamp;
      frame();
    }
    window.requestAnimationFrame(onAnimationFrame);
  }

  function setSprite(name, frame) {
    const sprite = spriteSets[name][frame % spriteSets[name].length];
    nekoEl.style.backgroundPosition = `${sprite[0] * 32}px ${sprite[1] * 32}px`;
  }

  function resetIdleAnimation() {
    idleAnimation = null;
    idleAnimationFrame = 0;
  }

  function idle() {
    idleTime += 1;

    // every ~ 20 seconds
    if (
      idleTime > 10 &&
      Math.floor(Math.random() * 200) == 0 &&
      idleAnimation == null
    ) {
      let avalibleIdleAnimations = ["sleeping", "scratchSelf"];
      if (nekoPosX < 32) {
        avalibleIdleAnimations.push("scratchWallW");
      }
      if (nekoPosY < 32) {
        avalibleIdleAnimations.push("scratchWallN");
      }
      if (nekoPosX > window.innerWidth - 32) {
        avalibleIdleAnimations.push("scratchWallE");
      }
      if (nekoPosY > window.innerHeight - 32) {
        avalibleIdleAnimations.push("scratchWallS");
      }
      idleAnimation =
        avalibleIdleAnimations[
          Math.floor(Math.random() * avalibleIdleAnimations.length)
        ];
    }

    switch (idleAnimation) {
      case "sleeping":
        if (idleAnimationFrame < 8) {
          setSprite("tired", 0);
          break;
        }
        setSprite("sleeping", Math.floor(idleAnimationFrame / 4));
        if (idleAnimationFrame > 192) {
          resetIdleAnimation();
        }
        break;
      case "scratchWallN":
      case "scratchWallS":
      case "scratchWallE":
      case "scratchWallW":
      case "scratchSelf":
        setSprite(idleAnimation, idleAnimationFrame);
        if (idleAnimationFrame > 9) {
          resetIdleAnimation();
        }
        break;
      default:
        setSprite("idle", 0);
        return;
    }
    idleAnimationFrame += 1;
  }

  function explodeHearts() {
    const parent = nekoEl.parentElement;
    const rect = nekoEl.getBoundingClientRect();
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const centerX = rect.left + rect.width / 2 + scrollLeft;
    const centerY = rect.top + rect.height / 2 + scrollTop;

    for (let i = 0; i < 10; i++) {
      const heart = document.createElement("div");
      heart.className = "heart";
      heart.textContent = "❤";
      const offsetX = (Math.random() - 0.5) * 50;
      const offsetY = (Math.random() - 0.5) * 50;
      heart.style.left = `${centerX + offsetX - 16}px`;
      heart.style.top = `${centerY + offsetY - 16}px`;
      heart.style.transform = `translate(-50%, -50%) rotate(${
        Math.random() * 360
      }deg)`;
      parent.appendChild(heart);

      setTimeout(() => {
        parent.removeChild(heart);
      }, 1000);
    }
  }

  const style = document.createElement("style");
  style.innerHTML = `
		  @keyframes heartBurst {
			  0% { transform: scale(0); opacity: 1; }
			  100% { transform: scale(1); opacity: 0; }
		  }
		  .heart {
			  position: absolute;
			  font-size: 2em;
			  animation: heartBurst 1s ease-out;
			  animation-fill-mode: forwards;
			  color: #ab9df2;
		  }
	  `;

  document.head.appendChild(style);
  nekoEl.addEventListener("click", explodeHearts);

  // Is the cat standing on ground it is allowed to be seen on?
  //
  // A hit test rather than a rect comparison, for the same reason the trail
  // uses one: the footer is fixed behind the page and its rect claims the
  // whole viewport at every scroll position, so only asking what is actually
  // on top at this point can tell the covered footer from the revealed one.
  // The cat itself is skipped — it is the topmost thing at its own position.
  function onHomeGround() {
    const x = Math.round(nekoPosX);
    const y = Math.round(nekoPosY);
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
      return false;
    }
    const stack = document.elementsFromPoint(x, y);
    for (const el of stack) {
      if (el === nekoEl || nekoEl.contains(el)) continue;
      return !!el.closest?.(HOME_SECTIONS);
    }
    return false;
  }

  // The oldest point on the trail the cat has not reached yet. Points it has
  // arrived at, and points that have faded before it could get to them, are
  // marked off by advancing `followedId` past them.
  function trailTarget() {
    const trail = window.__pixelTrail;
    if (!trail || trail.points.length === 0) return null;
    const now = performance.now();
    const scrollY = window.scrollY;
    for (const point of trail.points) {
      if (point.id <= followedId) continue;
      if (now - point.at > TRAIL_MAX_AGE_MS) {
        followedId = point.id;
        continue;
      }
      const y = point.docY - scrollY;
      const reached =
        Math.sqrt((nekoPosX - point.x) ** 2 + (nekoPosY - y) ** 2) <=
        TRAIL_ARRIVE_PX;
      if (reached) {
        followedId = point.id;
        continue;
      }
      return { x: point.x, y: y };
    }
    return null;
  }

  function frame() {
    frameCount += 1;

    const home = onHomeGround();
    nekoEl.style.opacity = home ? "1" : "0";
    // An invisible cat should not be catching clicks meant for the page.
    nekoEl.style.pointerEvents = home ? "auto" : "none";

    const trail = trailTarget();
    const targetX = trail ? trail.x : mousePosX;
    const targetY = trail ? trail.y : mousePosY;
    const arrive = trail ? TRAIL_ARRIVE_PX : MOUSE_ARRIVE_PX;

    const diffX = nekoPosX - targetX;
    const diffY = nekoPosY - targetY;
    const distance = Math.sqrt(diffX ** 2 + diffY ** 2);

    if (distance < nekoSpeed || distance < arrive) {
      idle();
      return;
    }

    idleAnimation = null;
    idleAnimationFrame = 0;

    if (idleTime > 1) {
      setSprite("alert", 0);
      // count down after being alerted before moving
      idleTime = Math.min(idleTime, 7);
      idleTime -= 1;
      return;
    }

    let direction;
    direction = diffY / distance > 0.5 ? "N" : "";
    direction += diffY / distance < -0.5 ? "S" : "";
    direction += diffX / distance > 0.5 ? "W" : "";
    direction += diffX / distance < -0.5 ? "E" : "";
    setSprite(direction, frameCount);

    nekoPosX -= (diffX / distance) * nekoSpeed;
    nekoPosY -= (diffY / distance) * nekoSpeed;

    nekoPosX = Math.min(Math.max(16, nekoPosX), window.innerWidth - 16);
    nekoPosY = Math.min(Math.max(16, nekoPosY), window.innerHeight - 16);

    nekoEl.style.left = `${nekoPosX - 16}px`;
    nekoEl.style.top = `${nekoPosY - 16}px`;
  }

  init();
})();
