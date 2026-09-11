// Moodie has no scrape video, so its screenshot stands in as the cover.
//
// The six gifs that used to be imported here fed an `assets` array on every
// project record that no component ever read. Webpack emitted all of them into
// the build regardless — 6.4MB, most of it one 5.3MB gif — so the field and its
// imports are gone. Five were byte-identical to the copies in public/cursors,
// which the posterize script still uses; those stayed.
import moodieAsset from "./assets/moodie-screenshot.png";

// Project Links
export const MCFrontEndLink =
  "https://github.com/kevinrufino/minecraft-clone-react";
export const MCServerLink =
  "https://github.com/GreyDaCaLa/ReactMineCraftCloneServer";
export const MCLiveLink =
  "https://minecraft-clone-react-chi.vercel.app/";

export const MaxsLabLink = "https://www.swoosh.nike/m/maxs-lab";

export const swoosh404Link = "https://www.swoosh.nike/m/air-force-1-low-404";

export const dogewoodLink =
  "https://web.archive.org/web/20220506004107/https://app.dogewoodnft.com/";

export const anonymiceLink = "https://anonymice.com/";

export const snkybotLink = "https://github.com/kevinrufino/SNK-Y-Bot";

export const OurForce1CDPLink = "https://www.swoosh.nike/collections/our-force-1-poster";

export const EAFCPartnerPageLink = "https://www.swoosh.nike/p/ea-sports-fc";

export const TINAJCLPLink = "https://www.swoosh.nike/collections/our-force-1-tinaj/products/air-force-1-tinaj/tokens/301?tab=story";

export const MoodieLink = "https://moo-die-bice.vercel.app/";

// Project Scrape Gifs

// Optimized (≤720p, audio-stripped, faststart) copies live in public/optimized.
// Originals are retained in public/ as backups.
export const MCScrapeGif = "/optimized/Minecraft-Scrape-Video.mp4";
export const MaxsLabScrapeGif = "/optimized/maxs-lab-video.mp4";
export const swoosh404ScrapeGif = "/optimized/404-error-scrape.mp4";
export const dogewoodScrapeGif = "/optimized/dogewood-scrape.mp4";
export const anonymiceScrapeGif = "/optimized/cheeth-scrape-video.mp4";
export const snkybotScrapeGif = "/optimized/SNKY-Bot-scrape-video.mp4";
export const OF1PosterCDPGif = "/optimized/OF1-Poster-CDP.mp4";
export const EAFCPartnerPageGif = "/optimized/EAFC-Page.mp4";
export const TINAJCLPGif = "/optimized/TINAJ-CLP.mp4";

export const ProjectsData = [
  {
    title: "Max's Lab",
    year: "2023",
    role: "Lead Engineer",
    type: "3D World Experience",
    client: "Nike .Swoosh",
    technology: ["React", "Three.js", "Next.js", "Blender"],
    description:
      "I lead the development of a fully 3D marketing experience. This experience allowed users to deeply engage in a story of a collection of airmax products by exploring a full 3D world with easter eggs and live world events in support of IRL marketing moments. I worked cross functionally with 3D artists, designers, and project managers and marketing specialists to bring this to life. Feel free to check it out here.",
    links: [{
      "Try Out Max's Lab!": MaxsLabLink
    }],
    scrapeGif: MaxsLabScrapeGif,
  },
  {
    title: "Moodie",
    year: "2026",
    role: "Creator",
    type: "Infinite Canvas",
    client: "Passion Project",
    technology: ["Next.js", "React", "TypeScript", "Zustand"],
    description: "An infinite 2D discovery canvas of Pinterest-style mood pins. Users can pan and zoom through an endless world with only the pins in view being rendered in the DOM. Built with a transform-based camera, lazy procedural spatial index, viewport culling, and full SSR/SEO support. The architecture uses a single transformed layer for GPU-accelerated panning with zero React renders, and pins only re-render when the visible set changes.",
    links: [{
      "Check out Moodie!": MoodieLink
    }],
    liveLink: MoodieLink,
    scrapeGif: moodieAsset,
  },
  {
    title: "Minecraft Clone",
    year: "2022",
    role: "Creator",
    type: "Multiplayer WebGL Game",
    client: "Passion Project",
    technology: ["React", "Three.js", "Web Sockets", "Procedural Generation", "Physics Simulation"],
    description:
      "Developed and collaborated on a 3D WebGL clone of Minecraft with online functionalities. The online functionality uses web sockets to send and retrieve updates utilizing Socket.IO. Being built entirely in R3F, this is proudly the most in depth React Minecraft clone. The game generates a randomized voxel terrain of the world using an algorithm to create a graph of all the block data. The block data is used to construct a 3D geometry of the environment which the player can interact with using a custom physics engine. This terrain generation can support multiple parameters such as environment types. This started as a passion project to learn how a game like Minecraft can create its limitless world.",
    links: [
      {
        "Try it on your machine!": MCFrontEndLink,
      },
      {
        "Boot up a server, play with friends!": MCServerLink
      }
    ],
    liveLink: MCLiveLink,
    scrapeGif: MCScrapeGif,
  },
  {
    title: "Our Force 1 Poster Content Display Page",
    year: "2023",
    role: "Lead Engineer",
    type: "Content Display Page",
    client: "Nike .Swoosh",
    technology: ["React", "Three.js", "Next.js"],
    description:
      "I lead and architected a custom content display page for our OF1 Poster Collection. This page gave users a chance to dive into the world of our NFT collection through an engaging and beatiful page. I helped engineer our sites CMS implementation and created custom and authorable component blocks utilizing cool design features such a paralax effects and cool custom 3D shader to give the posters a wavey effect. I worked with designers and project managers to bring this to our loyal community.",
    links: [{
      "Check Out the CDP!": OurForce1CDPLink
    }],
    scrapeGif: OF1PosterCDPGif,
  },
  {
    title: ".Swoosh 404",
    year: "2023",
    role: "Engineer",
    type: "WebGL Game",
    client: "Nike .Swoosh",
    technology: ["React", "Canvas", "Next.js"],
    description:
      "To support the release of a physical product, I helped developed this space-invaders inspired game giving users eligibilty to purchase based on thier performance. This moment was lead by a site takeover where we glitched the site out and teased release information via decrytbable easter eggs. Worked cross functionally with marketing specialist and experience designers to test and rapidly iterate on this experience.",
    links: [{
      "Check out the .Swoosh Platform!": swoosh404Link
    }],
    scrapeGif: swoosh404ScrapeGif,
  },
  {
    title: "EA Sports FC Partner Page",
    year: "2023",
    role: "Engineer",
    type: "Partner Launch Page",
    client: "Nike x EA Sports",
    technology: ["React", "Three.js", "Next.js"],
    description: "I helped engineer the authorable custom component/block system for our site, allowing us to build reusable components that can be brought into any page. Using that block system I helped developeed this interable 3D player viewer and FAQ custom component. This page was built to support the launch of the EA Sports FC game and was a collaboration with the EA team.",
    links: [{
      "Check out the EA Partner Page!": EAFCPartnerPageLink
    }],
    scrapeGif: EAFCPartnerPageGif,
  },
  {
    title: "TINAJ Collection Listing Page",
    year: "2023",
    role: "Engineer",
    type: "3D Product Viewer",
    client: "Nike .Swoosh",
    technology: ["React", "Three.js", "Next.js"],
    description: "I helped build this page and an authorable and scalable 3D virtual product viewer that can support the display and control of any customizable virtual collectable. These collectables have mutiple traits, animations, and control types.",
    links: [{
      "Check out the CLP!": TINAJCLPLink
    }],
    scrapeGif: TINAJCLPGif,
  },
  {
    title: "Defenders of Dogewood",
    year: "2022",
    role: "Engineer",
    type: "NFT Adventure Game",
    client: "Dogewood",
    technology: ["React", "Spline.ts", "Ethers.js", "Unity WebGL"],
    description:
      "I helped support the DoD team by refactoring the unity webgl based adventure experience to one that is built in react js using spline to control the animation assets. This experience was exclusive to members who owned a dogewood nft. Players we're able to take doge's on adventures to train them and earn rewards.",
    links: [{
      "The website is down but check it out on the way back machine!": dogewoodLink
    }],
    scrapeGif: dogewoodScrapeGif,
  },
  {
    title: "Anonymice",
    year: "2022",
    role: "Engineer",
    type: "Staking dApp",
    client: "Anonymice",
    technology: ["React", "CSS", "Ethers.js", "Discord"],
    description:
      "I build the cheeth v2 staking experience for anonymice. This experience allowed users to stake their mice tokens to earn cheeth. Players would stake thier mice in order to help control the supply of the 'in game' economy to have a hand and advantage in the scarcity game. I worked with the team to design and develop the custom staking experience that was easy to use and understand, while also consulting on the tokenomics of the cheeth token.",
    links: [{
      "Check out their new site!": anonymiceLink
    }],
    scrapeGif: anonymiceScrapeGif,
  },
  {
    title: "SNK-Y Bot",
    year: "2019",
    role: "Creator",
    type: "Automation Bot",
    client: "College Project",
    technology: ["Vue", "Puppeteer", "Firebase", "Express", "Node.js"],
    description: "A college project that explored the use of web scraping to create a bot that would monitor sneaker releases and notify users of restocks. The bot was built using puppeteer to scrape data from various sneaker sites and automated the purchasing process. The bot was built with a Vue front end and a Firebase backend to store user data and preferences.",
    links: [{
      "Check out the GH!": snkybotLink
    }],
    scrapeGif: snkybotScrapeGif,
  },
];
