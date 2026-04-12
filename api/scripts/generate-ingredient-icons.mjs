import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const outputDir = path.join(rootDir, "public", "ingredient-icons");

const icons = [
  {
    slug: "oc-huong",
    title: "Ốc hương",
    kind: "spiral",
    bg1: "#4f2a1a",
    bg2: "#d79d56",
    shell1: "#f7e0b6",
    shell2: "#d9a95b",
    accent: "#8f5b35",
    accent2: "#fff8eb",
    rings: 5,
  },
  {
    slug: "oc-mo",
    title: "Ốc mỡ",
    kind: "spiral",
    bg1: "#7f4a22",
    bg2: "#f0bf76",
    shell1: "#fff7df",
    shell2: "#f4d295",
    accent: "#b77b33",
    accent2: "#fffaf1",
    rings: 4,
    glossy: true,
  },
  {
    slug: "oc-gao",
    title: "Ốc gạo",
    kind: "spiral",
    bg1: "#6e6535",
    bg2: "#d5c17b",
    shell1: "#f6f0c7",
    shell2: "#ceb86a",
    accent: "#8e7f3f",
    accent2: "#fffce6",
    rings: 5,
    grains: true,
  },
  {
    slug: "oc-lac",
    title: "Ốc lác",
    kind: "spiral",
    bg1: "#53604b",
    bg2: "#c2d0b0",
    shell1: "#edf4e4",
    shell2: "#aebd99",
    accent: "#6b785e",
    accent2: "#ffffff",
    rings: 4,
    ridges: true,
  },
  {
    slug: "oc-dua",
    title: "Ốc dừa",
    kind: "spiral",
    bg1: "#6a4326",
    bg2: "#efc18a",
    shell1: "#f7e6cb",
    shell2: "#d09a5b",
    accent: "#7e522f",
    accent2: "#fff8ef",
    rings: 4,
    leaf: true,
  },
  {
    slug: "oc-toi",
    title: "Ốc tỏi",
    kind: "spiral",
    bg1: "#574c38",
    bg2: "#d9c78d",
    shell1: "#fbf4e4",
    shell2: "#cbb37a",
    accent: "#8e7b54",
    accent2: "#fffdf7",
    rings: 4,
    garlic: true,
  },
  {
    slug: "oc-mong-tay",
    title: "Ốc móng tay",
    kind: "razor",
    bg1: "#14596b",
    bg2: "#7cc8d7",
    shell1: "#edf9fb",
    shell2: "#a3e1ef",
    accent: "#f28f74",
    accent2: "#ffffff",
  },
  {
    slug: "so-long",
    title: "Sò lông",
    kind: "clam",
    bg1: "#4a3b2c",
    bg2: "#d4b07d",
    shell1: "#f8ebd1",
    shell2: "#b98c5a",
    accent: "#8b6542",
    accent2: "#fffaf2",
  },
  {
    slug: "so-huyet",
    title: "Sò huyết",
    kind: "clam",
    bg1: "#611a2e",
    bg2: "#d95a6f",
    shell1: "#ffe8e0",
    shell2: "#cf6b6b",
    accent: "#8e2438",
    accent2: "#fff8f5",
    heart: true,
  },
  {
    slug: "so-lua",
    title: "Sò lụa",
    kind: "clam",
    bg1: "#6f5a48",
    bg2: "#ead2b4",
    shell1: "#fbf3e8",
    shell2: "#d8b98f",
    accent: "#9b6d4b",
    accent2: "#ffffff",
    soft: true,
  },
  {
    slug: "ngao-2-coi",
    title: "Ngao 2 còi",
    kind: "twinClam",
    bg1: "#235f6f",
    bg2: "#8fd0d8",
    shell1: "#f0fbfd",
    shell2: "#a8e3ea",
    accent: "#1f7181",
    accent2: "#ffffff",
  },
  {
    slug: "chem-chep",
    title: "Chem chép",
    kind: "mussel",
    bg1: "#224a72",
    bg2: "#7cb2df",
    shell1: "#eef7ff",
    shell2: "#a7cde9",
    accent: "#304d8a",
    accent2: "#ffffff",
  },
  {
    slug: "ngheu",
    title: "Nghêu",
    kind: "clam",
    bg1: "#8b6e58",
    bg2: "#e6cdb0",
    shell1: "#fff6ef",
    shell2: "#d8b796",
    accent: "#ab7f5a",
    accent2: "#ffffff",
  },
  {
    slug: "hau",
    title: "Hàu",
    kind: "oyster",
    bg1: "#6e4c58",
    bg2: "#f0d3dc",
    shell1: "#fff7fb",
    shell2: "#deb0c2",
    accent: "#c98ba3",
    accent2: "#ffffff",
  },
  {
    slug: "vit-lon",
    title: "Vịt lộn",
    kind: "egg",
    bg1: "#8a4c2d",
    bg2: "#f0c170",
    shell1: "#fff3da",
    shell2: "#f5d78c",
    accent: "#b25d34",
    accent2: "#fffbe9",
  },
  {
    slug: "mi",
    title: "Mì",
    kind: "noodle",
    bg1: "#7f5223",
    bg2: "#f0cc68",
    shell1: "#fff7ea",
    shell2: "#e5c052",
    accent: "#9c6726",
    accent2: "#ffffff",
  },
  {
    slug: "cang-ghe",
    title: "Càng ghẹ",
    kind: "claw",
    bg1: "#7f231e",
    bg2: "#ef8c49",
    shell1: "#ffe8dc",
    shell2: "#f5a164",
    accent: "#c84c2f",
    accent2: "#fffdf9",
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sharedDefs(id, icon) {
  return `
    <defs>
      <linearGradient id="${id}-bg" x1="36" y1="24" x2="476" y2="354" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="${icon.bg1}"/>
        <stop offset="100%" stop-color="${icon.bg2}"/>
      </linearGradient>
      <radialGradient id="${id}-glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(102 84) rotate(38) scale(300 220)">
        <stop offset="0%" stop-color="${icon.accent2}" stop-opacity="0.42"/>
        <stop offset="100%" stop-color="${icon.accent2}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${id}-shell" x1="154" y1="112" x2="360" y2="272" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="${icon.shell1}"/>
        <stop offset="100%" stop-color="${icon.shell2}"/>
      </linearGradient>
      <linearGradient id="${id}-accent" x1="180" y1="102" x2="332" y2="286" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stop-color="${icon.accent2}"/>
        <stop offset="100%" stop-color="${icon.accent}"/>
      </linearGradient>
    </defs>
  `;
}

function background(id, icon) {
  return `
    <rect width="512" height="384" rx="40" fill="url(#${id}-bg)"/>
    <circle cx="92" cy="74" r="64" fill="url(#${id}-glow)"/>
    <circle cx="430" cy="80" r="44" fill="${icon.accent2}" opacity="0.12"/>
    <circle cx="412" cy="306" r="58" fill="${icon.accent2}" opacity="0.1"/>
    <ellipse cx="256" cy="290" rx="150" ry="22" fill="#221913" opacity="0.16"/>
  `;
}

function renderSpiral(id, icon) {
  if (icon.slug === "oc-huong") {
    return `
      <g transform="translate(256 194) rotate(-10)">
        <ellipse cx="-6" cy="108" rx="112" ry="20" fill="#1d150f" opacity="0.17"/>
        <path d="M-92 20C-98 -26 -74 -66 -30 -88C8 -108 62 -106 96 -76C128 -48 138 -8 124 34C110 74 76 108 28 122C-24 136 -72 122 -92 94C-108 70 -104 44 -92 20Z" fill="url(#${id}-shell)"/>
        <path d="M-56 -36C-28 -62 14 -68 48 -52C82 -36 100 -2 94 32C88 66 60 90 24 96C-12 102 -46 86 -62 54C-78 22 -72 -10 -56 -36Z" fill="none" stroke="${icon.accent2}" stroke-width="10" stroke-linecap="round" opacity="0.78"/>
        <path d="M-74 -2C-26 -22 30 -22 86 -2" stroke="${icon.accent2}" stroke-width="8" stroke-linecap="round" opacity="0.58"/>
        <path d="M-72 24C-20 12 36 16 100 38" stroke="${icon.accent2}" stroke-width="7" stroke-linecap="round" opacity="0.44"/>
        <path d="M-62 52C-8 46 40 52 90 72" stroke="${icon.accent2}" stroke-width="6" stroke-linecap="round" opacity="0.32"/>
        <path d="M58 -2C82 0 102 12 116 32C108 56 94 74 74 88C56 98 40 102 22 100C36 82 40 64 36 44C32 24 36 6 58 -2Z" fill="#f7e7c7"/>
        <path d="M60 8C74 10 86 18 94 30C88 44 78 54 68 62C58 70 48 74 38 76C42 62 42 50 40 38C38 26 42 14 60 8Z" fill="${icon.accent}"/>
        <path d="M58 -2C82 0 102 12 116 32" stroke="${icon.accent2}" stroke-width="7" stroke-linecap="round" opacity="0.48"/>
      </g>
    `;
  }

  const rings = Array.from({ length: icon.rings || 4 }, (_, index) => {
    const scale = 1 - index * 0.13;
    const rx = 104 * scale;
    const ry = 84 * scale;
    const stroke = index % 2 === 0 ? `url(#${id}-accent)` : icon.accent2;
    const strokeWidth = 12 - index * 1.3;
    return `<ellipse cx="0" cy="10" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth.toFixed(1)}" opacity="${index === 0 ? 0.95 : 0.7}"/>`;
  }).join("\n        ");

  const ridges = icon.ridges
    ? `
        <path d="M-80 28C-42 2 42 2 80 28" stroke="${icon.accent2}" stroke-width="7" stroke-linecap="round" opacity="0.6"/>
        <path d="M-64 46C-30 24 30 24 64 46" stroke="${icon.accent2}" stroke-width="6" stroke-linecap="round" opacity="0.48"/>
      `
    : "";

  const garnish = icon.leaf
    ? `
        <path d="M102 -34C132 -34 144 -8 126 16C108 40 74 38 58 18C42 -2 58 -34 102 -34Z" fill="#b9d76f"/>
        <path d="M70 10C88 0 104 -10 124 -24" stroke="#4d6d1f" stroke-width="5" stroke-linecap="round"/>
      `
    : icon.garlic
      ? `
        <path d="M52 -34C74 -56 108 -52 120 -24C130 0 116 34 92 52C68 70 34 64 22 36C10 10 24 -14 52 -34Z" fill="#f7eddc"/>
        <path d="M70 -10C80 -22 94 -24 106 -14" stroke="#d2b98d" stroke-width="5" stroke-linecap="round"/>
      `
      : icon.grains
        ? `
        <circle cx="86" cy="-10" r="7" fill="#fff6c7"/>
        <circle cx="102" cy="4" r="5.5" fill="#f3dc9c"/>
        <circle cx="78" cy="18" r="4.8" fill="#f7eecc"/>
        <circle cx="110" cy="22" r="4.5" fill="#f1cf78"/>
      `
        : "";

  const highlight = icon.glossy
    ? `<path d="M-36 -58C-4 -74 42 -68 74 -42" stroke="${icon.accent2}" stroke-width="10" stroke-linecap="round" opacity="0.55"/>`
    : "";

  return `
    <g transform="translate(256 198)">
      <ellipse cx="0" cy="92" rx="116" ry="22" fill="#1d150f" opacity="0.18"/>
      <path d="M-126 18C-112 -52 -62 -92 0 -92C62 -92 112 -52 126 18C140 88 86 140 0 140C-86 140 -140 88 -126 18Z" fill="url(#${id}-shell)"/>
      <path d="M-70 10C-42 -20 14 -28 58 -10C96 4 122 36 122 72C122 101 102 122 74 124C42 126 12 108 -4 82C-22 52 -18 26 0 8C16 -8 40 -14 62 -10" fill="none" stroke="${icon.accent2}" stroke-width="11" stroke-linecap="round" opacity="0.78"/>
      ${rings}
      ${ridges}
      ${highlight}
      ${garnish}
      <circle cx="0" cy="10" r="16" fill="${icon.accent2}" opacity="0.94"/>
      <circle cx="0" cy="10" r="8" fill="${icon.accent}"/>
    </g>
  `;
}

function renderRazor(id, icon) {
  return `
    <g transform="translate(256 198)">
      <ellipse cx="0" cy="104" rx="116" ry="20" fill="#1d150f" opacity="0.18"/>
      <path d="M-138 16C-116 -28 -74 -54 -20 -56C48 -58 104 -28 140 18C112 54 48 70 -10 70C-72 70 -122 52 -138 16Z" fill="url(#${id}-shell)"/>
      <path d="M-92 10C-66 -8 -28 -12 6 -6C44 0 78 16 102 38C72 48 32 54 -6 54C-48 54 -84 42 -92 10Z" fill="${icon.accent2}" opacity="0.45"/>
      <path d="M-102 36C-62 58 14 64 98 44" stroke="${icon.accent2}" stroke-width="8" stroke-linecap="round" opacity="0.72"/>
      <path d="M-86 -4C-44 -20 16 -20 72 -6" stroke="${icon.accent}" stroke-width="6" stroke-linecap="round" opacity="0.7"/>
      <circle cx="86" cy="2" r="14" fill="${icon.accent2}" opacity="0.9"/>
      <circle cx="88" cy="2" r="6" fill="${icon.accent}"/>
    </g>
  `;
}

function renderClam(id, icon) {
  if (icon.slug === "so-huyet") {
    return `
      <g transform="translate(256 192)">
        <ellipse cx="0" cy="98" rx="118" ry="20" fill="#1d150f" opacity="0.17"/>
        <path d="M-132 34C-116 -22 -74 -60 -20 -72C-34 -20 -32 24 -16 70C-44 94 -84 104 -124 88C-142 78 -144 58 -132 34Z" fill="url(#${id}-shell)"/>
        <path d="M132 34C116 -22 74 -60 20 -72C34 -20 32 24 16 70C44 94 84 104 124 88C142 78 144 58 132 34Z" fill="url(#${id}-shell)"/>
        <path d="M-100 28C-70 4 -42 -6 -8 -6C-18 22 -18 50 -4 78C-38 80 -72 68 -100 28Z" fill="${icon.accent2}" opacity="0.34"/>
        <path d="M100 28C70 4 42 -6 8 -6C18 22 18 50 4 78C38 80 72 68 100 28Z" fill="${icon.accent2}" opacity="0.34"/>
        <path d="M-60 18C-38 -2 -16 -10 0 -10C16 -10 38 -2 60 18C52 38 34 52 0 56C-34 52 -52 38 -60 18Z" fill="#8f1a31"/>
        <path d="M-32 10C-18 0 -8 -4 0 -4C8 -4 18 0 32 10" stroke="#ffb1a9" stroke-width="7" stroke-linecap="round" opacity="0.8"/>
        <path d="M-28 28C-10 20 10 20 28 28" stroke="#f15c6a" stroke-width="6" stroke-linecap="round" opacity="0.78"/>
        <path d="M-10 38C0 44 10 44 20 38" stroke="#ffd8d1" stroke-width="5" stroke-linecap="round" opacity="0.5"/>
        <circle cx="-22" cy="18" r="4" fill="#c62646"/>
        <circle cx="22" cy="18" r="4" fill="#c62646"/>
      </g>
    `;
  }

  const extra = icon.soft
    ? `<path d="M-96 38C-38 18 40 18 96 38" stroke="${icon.accent2}" stroke-width="6" stroke-linecap="round" opacity="0.42"/>`
    : "";
  const heart = icon.heart
    ? `<circle cx="0" cy="16" r="16" fill="${icon.accent2}" opacity="0.92"/><circle cx="0" cy="16" r="7" fill="${icon.accent}"/>`
    : "";

  return `
    <g transform="translate(256 192)">
      <ellipse cx="0" cy="96" rx="110" ry="20" fill="#1d150f" opacity="0.17"/>
      <path d="M-122 16C-94 -46 -40 -80 0 -80C40 -80 94 -46 122 16C88 72 38 110 0 110C-38 110 -88 72 -122 16Z" fill="url(#${id}-shell)"/>
      <path d="M-78 20C-54 -8 -24 -20 0 -20C24 -20 54 -8 78 20C58 36 30 48 0 48C-30 48 -58 36 -78 20Z" fill="${icon.accent2}" opacity="0.52"/>
      <path d="M-78 20L-104 4" stroke="${icon.accent2}" stroke-width="7" stroke-linecap="round"/>
      <path d="M-54 38L-74 28" stroke="${icon.accent2}" stroke-width="6" stroke-linecap="round" opacity="0.8"/>
      <path d="M-22 46L-28 38" stroke="${icon.accent2}" stroke-width="5" stroke-linecap="round" opacity="0.8"/>
      <path d="M0 48L0 36" stroke="${icon.accent2}" stroke-width="5" stroke-linecap="round" opacity="0.8"/>
      <path d="M22 46L28 38" stroke="${icon.accent2}" stroke-width="5" stroke-linecap="round" opacity="0.8"/>
      <path d="M54 38L74 28" stroke="${icon.accent2}" stroke-width="6" stroke-linecap="round" opacity="0.8"/>
      <path d="M78 20L104 4" stroke="${icon.accent2}" stroke-width="7" stroke-linecap="round"/>
      ${extra}
      ${heart}
    </g>
  `;
}

function renderTwinClam(id, icon) {
  return `
    <g transform="translate(256 196)">
      <ellipse cx="0" cy="98" rx="116" ry="20" fill="#1d150f" opacity="0.17"/>
      <path d="M-120 16C-102 -38 -56 -70 -14 -72C-32 -20 -22 28 8 72C-32 94 -84 90 -120 16Z" fill="url(#${id}-shell)"/>
      <path d="M120 16C102 -38 56 -70 14 -72C32 -20 22 28 -8 72C32 94 84 90 120 16Z" fill="url(#${id}-shell)"/>
      <path d="M-76 8C-52 -10 -30 -16 -8 -16C-18 16 -18 46 -4 74C-34 72 -64 52 -76 8Z" fill="${icon.accent2}" opacity="0.34"/>
      <path d="M76 8C52 -10 30 -16 8 -16C18 16 18 46 4 74C34 72 64 52 76 8Z" fill="${icon.accent2}" opacity="0.34"/>
      <path d="M-74 20C-42 2 -18 -2 0 0C18 -2 42 2 74 20" stroke="${icon.accent2}" stroke-width="7" stroke-linecap="round" opacity="0.6"/>
      <circle cx="0" cy="10" r="14" fill="${icon.accent2}" opacity="0.9"/>
      <circle cx="0" cy="10" r="6" fill="${icon.accent}"/>
    </g>
  `;
}

function renderMussel(id, icon) {
  return `
    <g transform="translate(256 196) rotate(-8)">
      <ellipse cx="0" cy="98" rx="118" ry="20" fill="#1d150f" opacity="0.17"/>
      <path d="M-104 26C-88 -18 -50 -54 -6 -70C58 -92 120 -58 132 4C142 60 110 104 52 120C-18 138 -78 108 -104 26Z" fill="url(#${id}-shell)"/>
      <path d="M-58 18C-40 -2 -14 -10 16 -8C54 -4 82 16 100 48C70 58 42 64 16 62C-20 60 -48 44 -58 18Z" fill="${icon.accent2}" opacity="0.42"/>
      <path d="M-52 2C-22 24 10 42 48 60" stroke="${icon.accent2}" stroke-width="7" stroke-linecap="round" opacity="0.7"/>
      <path d="M-72 32C-36 44 -4 54 28 82" stroke="${icon.accent2}" stroke-width="6" stroke-linecap="round" opacity="0.55"/>
      <circle cx="52" cy="24" r="12" fill="${icon.accent2}" opacity="0.9"/>
      <circle cx="52" cy="24" r="5" fill="${icon.accent}"/>
    </g>
  `;
}

function renderOyster(id, icon) {
  return `
    <g transform="translate(256 194)">
      <ellipse cx="0" cy="102" rx="120" ry="20" fill="#1d150f" opacity="0.17"/>
      <path d="M-124 26C-88 -44 -26 -78 20 -74C78 -70 128 -30 132 20C112 86 58 128 0 128C-70 128 -130 78 -124 26Z" fill="url(#${id}-shell)"/>
      <path d="M-90 34C-50 4 2 -8 46 0C82 8 108 32 118 64C86 74 44 82 2 82C-42 82 -80 66 -90 34Z" fill="${icon.accent2}" opacity="0.36"/>
      <circle cx="28" cy="20" r="34" fill="#fff8ef"/>
      <circle cx="28" cy="20" r="11" fill="${icon.accent}"/>
      <path d="M-14 42C18 20 60 20 96 34" stroke="${icon.accent2}" stroke-width="8" stroke-linecap="round" opacity="0.7"/>
      <path d="M-58 26C-26 8 10 0 48 2" stroke="${icon.accent2}" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
    </g>
  `;
}

function renderEgg(id, icon) {
  return `
    <g transform="translate(256 192)">
      <ellipse cx="0" cy="100" rx="104" ry="20" fill="#1d150f" opacity="0.17"/>
      <path d="M0 -96C56 -96 108 -30 108 28C108 100 58 136 0 136C-58 136 -108 100 -108 28C-108 -30 -56 -96 0 -96Z" fill="url(#${id}-shell)"/>
      <path d="M-30 -26L-8 -6L-24 18L4 32L-10 58L18 74" stroke="${icon.accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <path d="M-52 20C-18 -14 10 -22 48 -14C66 -10 80 -4 92 8" stroke="${icon.accent2}" stroke-width="8" stroke-linecap="round" opacity="0.58"/>
      <circle cx="6" cy="34" r="30" fill="#fff3c9"/>
      <circle cx="6" cy="34" r="11" fill="${icon.accent}"/>
    </g>
  `;
}

function renderNoodle(id, icon) {
  if (icon.slug === "mi") {
    return `
      <g transform="translate(256 196)">
        <ellipse cx="0" cy="110" rx="132" ry="18" fill="#1d150f" opacity="0.18"/>
        <path d="M-116 52C-106 6 -66 -24 0 -24C66 -24 106 6 116 52C110 86 86 114 48 124C20 132 -20 132 -48 124C-86 114 -110 86 -116 52Z" fill="url(#${id}-shell)"/>
        <path d="M-92 52C-80 28 -54 14 -22 10C10 6 42 10 72 22C86 28 98 38 106 52C96 70 72 82 34 88C8 92 -12 92 -40 88C-72 82 -92 70 -92 52Z" fill="#fff8ea"/>
        <path d="M-78 4C-68 -18 -52 -30 -36 -34" stroke="${icon.accent2}" stroke-width="7" stroke-linecap="round" opacity="0.42"/>
        <path d="M-54 -4C-42 -22 -28 -32 -12 -36" stroke="${icon.accent2}" stroke-width="6" stroke-linecap="round" opacity="0.34"/>
        <path d="M-74 22C-46 6 -22 0 0 0C22 0 46 6 74 22" stroke="${icon.accent2}" stroke-width="10" stroke-linecap="round"/>
        <path d="M-80 38C-52 22 -26 18 0 18C26 18 52 22 80 38" stroke="${icon.accent2}" stroke-width="8" stroke-linecap="round" opacity="0.9"/>
        <path d="M-72 56C-48 42 -24 38 0 38C24 38 48 42 72 56" stroke="${icon.accent2}" stroke-width="7" stroke-linecap="round" opacity="0.78"/>
        <path d="M-88 72C-54 60 -26 60 0 60C26 60 54 60 88 72" stroke="${icon.accent}" stroke-width="10" stroke-linecap="round" opacity="0.72"/>
        <path d="M-62 86C-36 72 -16 68 0 68C16 68 36 72 62 86" stroke="${icon.accent}" stroke-width="8" stroke-linecap="round" opacity="0.58"/>
        <path d="M-28 4L64 34" stroke="#8f5f22" stroke-width="8" stroke-linecap="round"/>
        <path d="M-48 -4L48 26" stroke="#c48738" stroke-width="6" stroke-linecap="round"/>
        <circle cx="46" cy="48" r="7" fill="#f2e0bc"/>
        <circle cx="-18" cy="46" r="5" fill="#f3d06e"/>
      </g>
    `;
  }

  return `
    <g transform="translate(256 198)">
      <ellipse cx="0" cy="104" rx="120" ry="20" fill="#1d150f" opacity="0.17"/>
      <path d="M-116 56C-106 4 -62 -30 0 -30C62 -30 106 4 116 56C100 98 62 120 0 120C-62 120 -100 98 -116 56Z" fill="url(#${id}-shell)"/>
      <path d="M-84 54C-52 36 -28 30 0 30C28 30 52 36 84 54" stroke="${icon.accent2}" stroke-width="11" stroke-linecap="round"/>
      <path d="M-76 30C-40 12 -18 6 0 6C18 6 40 12 76 30" stroke="${icon.accent2}" stroke-width="9" stroke-linecap="round" opacity="0.84"/>
      <path d="M-58 8C-30 -6 -10 -10 0 -10C10 -10 30 -6 58 8" stroke="${icon.accent2}" stroke-width="8" stroke-linecap="round" opacity="0.7"/>
      <path d="M-92 82C-44 94 44 94 92 82" stroke="${icon.accent}" stroke-width="10" stroke-linecap="round" opacity="0.7"/>
      <path d="M-64 76C-34 58 -14 46 0 46C14 46 34 58 64 76" stroke="${icon.accent}" stroke-width="7" stroke-linecap="round" opacity="0.5"/>
      <path d="M-32 58C-8 48 8 48 32 58" stroke="${icon.accent2}" stroke-width="7" stroke-linecap="round" opacity="0.72"/>
    </g>
  `;
}

function renderClaw(id, icon) {
  if (icon.slug === "cang-ghe") {
    return `
      <g transform="translate(256 196)">
        <ellipse cx="0" cy="102" rx="124" ry="20" fill="#1d150f" opacity="0.17"/>
        <circle cx="0" cy="42" r="34" fill="url(#${id}-shell)"/>
        <path d="M-18 36C-42 18 -70 10 -98 10C-116 10 -130 16 -140 30C-130 42 -120 48 -104 48C-84 48 -68 44 -52 36C-38 28 -28 26 -18 36Z" fill="url(#${id}-shell)"/>
        <path d="M18 36C42 18 70 10 98 10C116 10 130 16 140 30C130 42 120 48 104 48C84 48 68 44 52 36C38 28 28 26 18 36Z" fill="url(#${id}-shell)"/>
        <path d="M-92 16C-116 8 -130 6 -144 12C-138 24 -138 36 -144 48C-130 48 -118 44 -108 36C-100 28 -94 22 -92 16Z" fill="#f9e4d8" opacity="0.7"/>
        <path d="M-92 56C-116 66 -130 68 -144 62C-138 50 -138 38 -144 26C-130 26 -118 30 -108 38C-100 46 -94 52 -92 56Z" fill="#f9e4d8" opacity="0.7"/>
        <path d="M92 16C116 8 130 6 144 12C138 24 138 36 144 48C130 48 118 44 108 36C100 28 94 22 92 16Z" fill="#f9e4d8" opacity="0.7"/>
        <path d="M92 56C116 66 130 68 144 62C138 50 138 38 144 26C130 26 118 30 108 38C100 46 94 52 92 56Z" fill="#f9e4d8" opacity="0.7"/>
        <path d="M-104 32C-82 22 -62 22 -46 32" stroke="${icon.accent2}" stroke-width="7" stroke-linecap="round" opacity="0.68"/>
        <path d="M104 32C82 22 62 22 46 32" stroke="${icon.accent2}" stroke-width="7" stroke-linecap="round" opacity="0.68"/>
        <path d="M-100 48C-76 56 -58 58 -44 52" stroke="${icon.accent2}" stroke-width="6" stroke-linecap="round" opacity="0.48"/>
        <path d="M100 48C76 56 58 58 44 52" stroke="${icon.accent2}" stroke-width="6" stroke-linecap="round" opacity="0.48"/>
        <path d="M-12 18C-4 10 4 10 12 18C4 28 -4 28 -12 18Z" fill="#f9e4d8" opacity="0.4"/>
        <path d="M0 42C-12 50 -22 60 -30 74" stroke="${icon.accent2}" stroke-width="9" stroke-linecap="round"/>
        <path d="M0 42C12 50 22 60 30 74" stroke="${icon.accent2}" stroke-width="9" stroke-linecap="round"/>
        <path d="M-30 74C-18 72 -8 66 0 58" stroke="${icon.accent}" stroke-width="7" stroke-linecap="round"/>
        <path d="M30 74C18 72 8 66 0 58" stroke="${icon.accent}" stroke-width="7" stroke-linecap="round"/>
      </g>
    `;
  }

  return `
    <g transform="translate(256 198)">
      <ellipse cx="0" cy="104" rx="116" ry="20" fill="#1d150f" opacity="0.17"/>
      <path d="M-124 46C-120 -6 -88 -42 -36 -56C-4 -64 30 -58 56 -40C86 -20 104 6 110 34C116 62 110 96 92 114C72 134 38 138 14 126C-8 116 -18 98 -20 80C-44 96 -74 102 -100 92C-118 86 -126 68 -124 46Z" fill="url(#${id}-shell)"/>
      <path d="M-92 58C-54 42 -22 40 8 46C38 52 64 66 88 88" stroke="${icon.accent2}" stroke-width="9" stroke-linecap="round" opacity="0.72"/>
      <path d="M-96 22C-54 18 -24 28 -2 52" stroke="${icon.accent2}" stroke-width="7" stroke-linecap="round" opacity="0.56"/>
      <path d="M20 28C56 8 88 2 126 8C112 44 90 68 58 84" fill="none" stroke="${icon.accent2}" stroke-width="10" stroke-linecap="round"/>
      <circle cx="42" cy="42" r="12" fill="${icon.accent2}" opacity="0.96"/>
      <circle cx="42" cy="42" r="5" fill="${icon.accent}"/>
      <path d="M-8 -22C12 -36 38 -40 62 -34" stroke="${icon.accent2}" stroke-width="8" stroke-linecap="round" opacity="0.45"/>
    </g>
  `;
}

function renderIcon(icon) {
  const id = `icon-${icon.slug}`;
  const symbol =
    icon.kind === "spiral"
      ? renderSpiral(id, icon)
      : icon.kind === "razor"
        ? renderRazor(id, icon)
        : icon.kind === "clam"
          ? renderClam(id, icon)
          : icon.kind === "twinClam"
            ? renderTwinClam(id, icon)
            : icon.kind === "mussel"
              ? renderMussel(id, icon)
              : icon.kind === "oyster"
                ? renderOyster(id, icon)
                : icon.kind === "egg"
                  ? renderEgg(id, icon)
                  : icon.kind === "noodle"
                    ? renderNoodle(id, icon)
                    : renderClaw(id, icon);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="384" viewBox="0 0 512 384" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="${id}-title ${id}-desc">
  <title id="${id}-title">${escapeXml(icon.title)}</title>
  <desc id="${id}-desc">SVG minh họa cho ${escapeXml(icon.title)}</desc>
  ${sharedDefs(id, icon)}
  ${background(id, icon)}
  ${symbol}
</svg>
`;
}

ensureDir(outputDir);

for (const icon of icons) {
  const filePath = path.join(outputDir, `${icon.slug}.svg`);
  fs.writeFileSync(filePath, renderIcon(icon), "utf8");
}

console.log(`Generated ${icons.length} ingredient icons in ${outputDir}`);
