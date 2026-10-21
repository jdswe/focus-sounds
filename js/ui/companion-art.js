// Original SVG artwork for the companions and their items (MIT, part of this repository).
// Each species defines anchor points for its slots, so shared items (glasses, headphones,
// backpacks) are placed according to that animal's anatomy; clothing is drawn per species.
(function () {
  const app = window.StillApp;
  let renderCount = 0;

  const eyes = (positions, radius, color) => `
    <g class="c-eyes-open">${positions.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${radius}" fill="${color || "#2B1D14"}"/><circle cx="${x + radius * 0.35}" cy="${y - radius * 0.35}" r="${radius * 0.32}" fill="#fff"/>`).join("")}</g>
    <g class="c-eyes-closed" fill="none" stroke="${color || "#2B1D14"}" stroke-width="2" stroke-linecap="round">${positions.map(([x, y]) => `<path d="M${x - radius - 1} ${y} q${radius + 1} ${radius} ${(radius + 1) * 2} 0"/>`).join("")}</g>`;
  const blush = (positions) => positions.map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="4" fill="#F28B9B" opacity=".42"/>`).join("");

  const SPECIES_ART = {
    capybara: {
      anchors: { head: [100, 42, 1], eyes: [100, 62, 1], ears: [100, 66, 1.05], neck: [100, 108, 1], back: [100, 128, 1], hand: [142, 138, 1], lap: [100, 152, 1] },
      body: `
        <ellipse cx="100" cy="140" rx="60" ry="42" fill="#A8754A" stroke="#7A5232" stroke-width="2"/>
        <ellipse cx="100" cy="150" rx="36" ry="24" fill="#C69A6D"/>
        <ellipse cx="76" cy="178" rx="14" ry="7" fill="#7A5232"/><ellipse cx="124" cy="178" rx="14" ry="7" fill="#7A5232"/>
        <ellipse cx="58" cy="142" rx="9" ry="14" fill="#946440" stroke="#7A5232" stroke-width="1.5" transform="rotate(12 58 142)"/>`,
      head: `
        <ellipse cx="62" cy="44" rx="9" ry="8" fill="#8C5E3A"/><ellipse cx="138" cy="44" rx="9" ry="8" fill="#8C5E3A"/>
        <rect x="52" y="38" width="96" height="72" rx="34" fill="#B07D52" stroke="#7A5232" stroke-width="2"/>
        <rect x="68" y="74" width="64" height="32" rx="16" fill="#956641"/>
        <ellipse cx="90" cy="82" rx="3" ry="2.2" fill="#3B2617"/><ellipse cx="110" cy="82" rx="3" ry="2.2" fill="#3B2617"/>
        <path d="M94 94q6 5 12 0" stroke="#3B2617" stroke-width="2" fill="none" stroke-linecap="round"/>
        ${eyes([[78, 62], [122, 62]], 4.6)}${blush([[68, 78], [132, 78]])}`,
      paw: `<ellipse cx="142" cy="146" rx="9" ry="8" fill="#946440" stroke="#7A5232" stroke-width="1.5"/>`
    },
    carpincho: {
      anchors: { head: [100, 36, 0.9], eyes: [100, 62, 0.82], ears: [100, 64, 0.92], neck: [100, 103, 0.9], back: [100, 130, 0.95], hand: [138, 134, 1], lap: [100, 152, 0.9] },
      body: `
        <ellipse cx="100" cy="138" rx="48" ry="46" fill="#8A5636" stroke="#5E3820" stroke-width="2"/>
        <ellipse cx="100" cy="146" rx="28" ry="30" fill="#B07A52"/>
        <ellipse cx="82" cy="182" rx="12" ry="6" fill="#5E3820"/><ellipse cx="118" cy="182" rx="12" ry="6" fill="#5E3820"/>
        <ellipse cx="56" cy="136" rx="8" ry="15" fill="#7A4A2E" stroke="#5E3820" stroke-width="1.5" transform="rotate(18 56 136)"/>`,
      head: `
        <circle cx="68" cy="40" r="7" fill="#6E4428"/><circle cx="132" cy="40" r="7" fill="#6E4428"/>
        <ellipse cx="100" cy="68" rx="42" ry="34" fill="#94603D" stroke="#5E3820" stroke-width="2"/>
        <path d="M90 37q4-11 9-1q4-10 10 0" fill="#6E4428"/>
        <ellipse cx="100" cy="83" rx="26" ry="15" fill="#7A4A2E"/>
        <ellipse cx="92" cy="79" rx="2.6" ry="2" fill="#2A170C"/><ellipse cx="108" cy="79" rx="2.6" ry="2" fill="#2A170C"/>
        <path d="M94 89q6 4 12 0" stroke="#2A170C" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M75 52l11-3M114 49l11 3" stroke="#4A2C18" stroke-width="2" stroke-linecap="round"/>
        ${eyes([[82, 62], [118, 62]], 4)}`,
      paw: `<ellipse cx="138" cy="142" rx="8" ry="8" fill="#7A4A2E" stroke="#5E3820" stroke-width="1.5"/>`
    },
    axolotl: {
      anchors: { head: [100, 44, 1], eyes: [100, 76, 1.18], ears: [100, 80, 1.15], neck: [100, 116, 0.82], back: [100, 140, 0.75], hand: [128, 146, 0.9], lap: [100, 160, 0.85] },
      body: `
        <path d="M128 150q40-6 48-36q4 30-40 50z" fill="#F4A6C0" stroke="#D97A9A" stroke-width="2"/>
        <ellipse cx="100" cy="146" rx="36" ry="32" fill="#F7B3C9" stroke="#D97A9A" stroke-width="2"/>
        <ellipse cx="100" cy="153" rx="22" ry="20" fill="#FBD3E0"/>
        <ellipse cx="84" cy="176" rx="9" ry="5" fill="#EE93B1"/><ellipse cx="116" cy="176" rx="9" ry="5" fill="#EE93B1"/>
        <ellipse cx="68" cy="148" rx="7" ry="11" fill="#F4A6C0" stroke="#D97A9A" stroke-width="1.5" transform="rotate(25 68 148)"/>`,
      head: `
        <g fill="#E77A9E" stroke="#C85A80" stroke-width="1.5" class="c-gills">
          <path d="M54 66q-22-16-30-6q10 4 30 14z"/><path d="M50 80q-28-4-32 8q12 0 32-2z"/><path d="M54 94q-22 10-24 22q10-6 26-16z"/>
          <path d="M146 66q22-16 30-6q-10 4-30 14z"/><path d="M150 80q28-4 32 8q-12 0-32-2z"/><path d="M146 94q22 10 24 22q-10-6-26-16z"/>
        </g>
        <ellipse cx="100" cy="80" rx="54" ry="38" fill="#F7B3C9" stroke="#D97A9A" stroke-width="2"/>
        <circle cx="90" cy="52" r="2" fill="#E58AAA"/><circle cx="104" cy="49" r="2.4" fill="#E58AAA"/><circle cx="116" cy="54" r="1.8" fill="#E58AAA"/>
        <path d="M84 92q16 12 32 0" stroke="#7A2F4B" stroke-width="2.2" fill="none" stroke-linecap="round"/>
        ${eyes([[74, 76], [126, 76]], 5)}${blush([[62, 90], [138, 90]])}`,
      paw: `<ellipse cx="130" cy="152" rx="6" ry="6" fill="#F4A6C0" stroke="#D97A9A" stroke-width="1.5"/>`
    },
    llama: {
      anchors: { head: [100, 32, 0.54], eyes: [100, 52, 0.42], ears: [100, 50, 0.56], neck: [100, 96, 0.56], back: [100, 138, 0.9], lap: [52, 176, 0.7] },
      body: `
        <rect x="68" y="154" width="9" height="28" rx="4" fill="#8B6A4E"/><rect x="88" y="158" width="9" height="24" rx="4" fill="#8B6A4E"/>
        <rect x="106" y="158" width="9" height="24" rx="4" fill="#8B6A4E"/><rect x="126" y="154" width="9" height="28" rx="4" fill="#8B6A4E"/>
        <ellipse cx="150" cy="134" rx="6" ry="11" fill="#A47D5B" transform="rotate(20 150 134)"/>
        <ellipse cx="100" cy="146" rx="50" ry="26" fill="#C79E77" stroke="#8B6A4E" stroke-width="2"/>
        <ellipse cx="120" cy="142" rx="18" ry="11" fill="#F1E6D6"/>
        <rect x="86" y="70" width="28" height="74" rx="14" fill="#C79E77" stroke="#8B6A4E" stroke-width="2"/>`,
      head: `
        <path d="M87 36q-10-18 0-26q6 10 5 26z" fill="#A47D5B" stroke="#8B6A4E" stroke-width="1.5"/>
        <path d="M113 36q10-18 0-26q-6 10-5 26z" fill="#A47D5B" stroke="#8B6A4E" stroke-width="1.5"/>
        <ellipse cx="100" cy="56" rx="22" ry="27" fill="#F1E6D6" stroke="#8B6A4E" stroke-width="2"/>
        <path d="M80 46q20-22 40 0q-10-8-20-6q-10-2-20 6z" fill="#A47D5B"/>
        <ellipse cx="100" cy="72" rx="12" ry="9" fill="#E2D2BE"/>
        <path d="M96 70q4 3 8 0M100 73v3M96 78q4 3 8 0" stroke="#5B4636" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        <path d="M86 47l-3-3M114 47l3-3" stroke="#3E2C20" stroke-width="1.4" stroke-linecap="round"/>
        ${eyes([[91, 52], [109, 52]], 3.4)}`
    },
    macaw: {
      anchors: { head: [100, 32, 0.74], eyes: [100, 57, 0.64], ears: [100, 60, 0.72], neck: [100, 90, 0.74], back: [100, 114, 0.8], hand: [118, 164, 0.8], lap: [62, 168, 0.75] },
      body: `
        <rect x="36" y="176" width="128" height="7" rx="3.5" fill="#8B6A4E"/>
        <path d="M92 150l-10 44 18-4z" fill="#1F6FD1" stroke="#164F9A" stroke-width="1.5"/><path d="M104 150l2 46 12-8z" fill="#164F9A"/>
        <g class="c-wing-l"><ellipse cx="66" cy="118" rx="14" ry="34" fill="#1F6FD1" stroke="#164F9A" stroke-width="2" transform="rotate(12 66 118)"/></g>
        <g class="c-wing-r"><ellipse cx="134" cy="118" rx="14" ry="34" fill="#1F6FD1" stroke="#164F9A" stroke-width="2" transform="rotate(-12 134 118)"/></g>
        <ellipse cx="100" cy="118" rx="36" ry="48" fill="#2B7DE0" stroke="#164F9A" stroke-width="2"/>
        <ellipse cx="100" cy="130" rx="24" ry="36" fill="#F6C343"/>
        <path d="M86 170l-4 8m4-8l2 9m-2-9 7 6M114 170l4 8m-4-8-2 9m2-9-7 6" stroke="#3C3C3C" stroke-width="2.5" stroke-linecap="round"/>`,
      head: `
        <circle cx="100" cy="60" r="30" fill="#2B7DE0" stroke="#164F9A" stroke-width="2"/>
        <path d="M78 42q22-20 44 0q-22-8-44 0z" fill="#3DAA4A"/>
        <ellipse cx="86" cy="62" rx="11" ry="13" fill="#fff"/><ellipse cx="114" cy="62" rx="11" ry="13" fill="#fff"/>
        <path d="M80 66h8M80 70h7M112 66h8M113 70h7" stroke="#222" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M92 68q8-6 16 0q-2 16-8 18q-6-2-8-18z" fill="#222"/>
        ${eyes([[86, 58], [114, 58]], 3.6)}`,
      paw: `<path d="M114 166l4-4 4 4" stroke="#3C3C3C" stroke-width="2.5" fill="none" stroke-linecap="round"/>`
    }
  };

  // `local`: drawn around (0,0) and placed at the species' anchor for the slot.
  // `global`: drawn in species coordinates (clothing, backgrounds, effects).
  const ITEM_ART = {
    "round-glasses": { local: `<g fill="rgba(255,255,255,.28)" stroke="#2A2A2A" stroke-width="2.5"><circle cx="-22" cy="0" r="11"/><circle cx="22" cy="0" r="11"/><path d="M-11-1q11-6 22 0" fill="none"/></g>` },
    "study-headphones": { local: `<path d="M-50 0q50-74 100 0" fill="none" stroke="#3C3F58" stroke-width="6" stroke-linecap="round"/><rect x="-60" y="-10" width="16" height="28" rx="7" fill="#5B6CF0" stroke="#3C3F58" stroke-width="2"/><rect x="44" y="-10" width="16" height="28" rx="7" fill="#5B6CF0" stroke="#3C3F58" stroke-width="2"/>` },
    "school-backpack": { local: `<rect x="-48" y="-42" width="96" height="72" rx="20" fill="#E0664F" stroke="#A8432F" stroke-width="2"/><rect x="-26" y="-50" width="52" height="16" rx="8" fill="#C85A45" stroke="#A8432F" stroke-width="2"/>` },
    "notebook": { local: `<g transform="rotate(-10)"><rect x="-12" y="-15" width="24" height="30" rx="3" fill="#5B8DEF" stroke="#2F5DB8" stroke-width="1.8"/><path d="M-7-7h14M-7-2h14M-7 3h10" stroke="#fff" stroke-width="1.4"/></g>` },
    "focus-sparkles": { global: `<g class="c-sparkles" fill="#FFE27A" stroke="#E9B949" stroke-width="1">${[[30, 40], [170, 52], [24, 120], [178, 130], [150, 18]].map(([x, y]) => `<path d="M${x} ${y - 7}l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>`).join("")}</g>` },
    "bg-study-room": { global: `<rect width="200" height="200" fill="#F1E3D3"/><rect y="168" width="200" height="32" fill="#D9BFA0"/><rect x="128" y="22" width="52" height="46" rx="4" fill="#BFE3F2" stroke="#9C7B5C" stroke-width="3"/><path d="M154 22v46M128 45h52" stroke="#9C7B5C" stroke-width="2"/><rect x="14" y="70" width="46" height="5" fill="#9C7B5C"/><rect x="18" y="52" width="8" height="18" fill="#E0664F"/><rect x="27" y="56" width="7" height="14" fill="#5B8DEF"/><rect x="35" y="50" width="9" height="20" fill="#3DAA4A"/>` },
    "bg-mountains": { global: `<rect width="200" height="200" fill="#CFE6F5"/><path d="M-10 170 50 70l40 60 30-40 90 80z" fill="#8FA9B8"/><path d="M50 70l-14 23 10-4 6 6 8-8 6 4z" fill="#fff"/><path d="M120 90l-12 16 8-3 5 5 6-6 6 3z" fill="#fff"/><rect y="168" width="200" height="32" fill="#9DBA7E"/>` },
    "bg-night-sky": { global: `<rect width="200" height="200" fill="#26304F"/><circle cx="160" cy="36" r="16" fill="#F6EFC9"/><circle cx="166" cy="31" r="14" fill="#26304F"/>${[[20, 30], [60, 18], [96, 40], [130, 70], [30, 90], [180, 100], [70, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="#fff"/>`).join("")}<rect y="168" width="200" height="32" fill="#1B2238"/>` },

    "ruana": { global: `<path d="M42 122q58-26 116 0l8 38q-66 22-132 0z" fill="#7E2F2A" stroke="#5A1F1B" stroke-width="2"/><path d="M38 140q62 18 124 0M36 150q64 18 128 0" stroke="#E8C27A" stroke-width="3" fill="none"/><path d="M84 112q16 12 32 0" stroke="#5A1F1B" stroke-width="3" fill="none"/>` },
    "aguadeno-hat": { local: `<ellipse cx="0" cy="-4" rx="64" ry="10" fill="#F3EBD3" stroke="#B9A57A" stroke-width="2"/><path d="M-30-6q2-36 30-38q28 2 30 38z" fill="#F7F0DC" stroke="#B9A57A" stroke-width="2"/><rect x="-30" y="-17" width="60" height="9" fill="#222"/>` },
    "vueltiao-hat": { local: `<ellipse cx="0" cy="-4" rx="64" ry="11" fill="#F2E6C8" stroke="#2A2A2A" stroke-width="2"/><ellipse cx="0" cy="-4" rx="52" ry="8" fill="none" stroke="#2A2A2A" stroke-width="2"/><ellipse cx="0" cy="-4" rx="40" ry="6" fill="none" stroke="#2A2A2A" stroke-width="2"/><path d="M-28-6q2-32 28-34q26 2 28 34z" fill="#F2E6C8" stroke="#2A2A2A" stroke-width="2"/><path d="M-26-16h52M-22-26h44M-14-34h28" stroke="#2A2A2A" stroke-width="2.5"/>` },
    "coffee-cup": { local: `<path d="M-12-8h22v10a11 11 0 0 1-22 0z" fill="#fff" stroke="#6B4A33" stroke-width="2"/><path d="M10-4q8 0 6 7q-2 4-7 3" fill="none" stroke="#6B4A33" stroke-width="2"/><ellipse cx="-1" cy="-8" rx="11" ry="2.5" fill="#6B4A33"/><g class="c-steam" fill="none" stroke="#B8A99A" stroke-width="1.6" stroke-linecap="round"><path d="M-5-14q-3-5 0-9"/><path d="M3-14q-3-5 0-9"/></g>` },
    "mochila-bag": { local: `<rect x="-80" y="-12" width="36" height="42" rx="11" fill="#F6C343" stroke="#7A4E1F" stroke-width="2"/><path d="M-80 0l9 6 9-6 9 6 9-6M-80 14l9 6 9-6 9 6 9-6" stroke="#E94F37" stroke-width="3" fill="none"/><path d="M-78 24h32" stroke="#2E86AB" stroke-width="3"/>` },
    "tricolor-scarf": { local: `<path d="M-44-6q44 18 88 0v12q-44 18-88 0z" fill="#FCD116" stroke="#B89500" stroke-width="1.5"/><path d="M-44 2q44 18 88 0" stroke="#003893" stroke-width="3" fill="none"/><path d="M-44 6q44 18 88 0" stroke="#CE1126" stroke-width="2.5" fill="none"/><path d="M18 8l8 26 10-2-6-24z" fill="#FCD116" stroke="#B89500" stroke-width="1.5"/>` },
    "orange-hat": { local: `<circle cx="0" cy="-14" r="16" fill="#F39A2B" stroke="#C8741A" stroke-width="2"/><path d="M0-30q8-8 14-2q-8 4-14 2z" fill="#4CAF50"/>` },

    "marigold-crown": { local: `${[-44, -26, -8, 10, 28, 46].map((x, i) => `<g transform="translate(${x} ${i % 2 ? -4 : 0})"><circle r="9" fill="${i % 2 ? "#F97316" : "#F59E0B"}"/><circle r="5" fill="${i % 2 ? "#FB923C" : "#FBBF24"}"/><circle r="2.4" fill="#B45309"/></g>`).join("")}` },
    "sarape-scarf": { local: `<path d="M-46-6q46 18 92 0v14q-46 18-92 0z" fill="#E94F8B"/><path d="M-46-1q46 18 92 0" stroke="#1FA2A6" stroke-width="3" fill="none"/><path d="M-46 4q46 18 92 0" stroke="#F6C343" stroke-width="3" fill="none"/><path d="M-30 18v6M-15 21v6M0 22v6M15 21v6M30 18v6" stroke="#7A3BAF" stroke-width="2"/>` },
    "taco": { local: `<path d="M-17 6a17 15 0 0 1 34 0z" fill="#F4C46A" stroke="#C9922F" stroke-width="2"/><path d="M-14-1q3-4 6 0t6 0 6 0 6 0 6 0" stroke="#4CAF50" stroke-width="3" fill="none"/><circle cx="-6" cy="-3" r="2.4" fill="#E53935"/><circle cx="5" cy="-4" r="2.4" fill="#E53935"/>` },
    "bg-papel-picado": { global: `<rect width="200" height="200" fill="#FFF4E6"/><path d="M0 18q100 20 200 0" stroke="#7A5A3A" stroke-width="1.5" fill="none"/>${["#E94F8B", "#1FA2A6", "#F6C343", "#7A3BAF", "#F97316", "#3DAA4A"].map((color, i) => `<g transform="translate(${8 + i * 33} ${20 + Math.sin(i / 1.6) * 6})"><path d="M0 0h26v26l-4-4-5 4-4-4-4 4-5-4-4 4z" fill="${color}"/><circle cx="13" cy="10" r="3.5" fill="#FFF4E6"/></g>`).join("")}<rect y="168" width="200" height="32" fill="#F2DEC4"/>` },

    "mate-set": { local: `<rect x="-30" y="-28" width="12" height="42" rx="4" fill="#2F6F4F" stroke="#1E4A34" stroke-width="1.5"/><rect x="-29" y="-32" width="10" height="6" rx="2" fill="#B0B0B0"/><circle cx="2" cy="4" r="11" fill="#7A5A3A" stroke="#4E3824" stroke-width="2"/><ellipse cx="2" cy="-5" rx="8" ry="2.5" fill="#4F7A2E"/><path d="M3-6l8-18" stroke="#C0C0C0" stroke-width="2.5" stroke-linecap="round"/>` },
    "celeste-scarf": { local: `<path d="M-44-6q44 18 88 0v12q-44 18-88 0z" fill="#fff" stroke="#5E8FB8" stroke-width="1.5"/>${[-30, -10, 10, 30].map((x) => `<rect x="${x - 5}" y="-2" width="9" height="14" fill="#74ACDF" transform="skewX(-8)"/>`).join("")}<path d="M20 8l7 24 10-2-6-22z" fill="#74ACDF" stroke="#5E8FB8" stroke-width="1.5"/>` },
    "boina": { local: `<g transform="rotate(-8)"><ellipse cx="0" cy="-8" rx="42" ry="13" fill="#2E3A59" stroke="#1C2438" stroke-width="2"/><path d="M-36-6q36 10 72 0" stroke="#1C2438" stroke-width="2" fill="none"/><rect x="-2" y="-26" width="4" height="7" rx="2" fill="#1C2438"/></g>` },
    "striped-jersey": { global: (uid) => `<clipPath id="${uid}-jersey"><path d="M56 110q44-14 88 0l6 56q-50 14-100 0z"/></clipPath><path d="M56 110q44-14 88 0l6 56q-50 14-100 0z" fill="#fff" stroke="#5E8FB8" stroke-width="2"/><g clip-path="url(#${uid}-jersey)" fill="#74ACDF">${[60, 84, 108, 132].map((x) => `<rect x="${x}" y="96" width="12" height="80"/>`).join("")}</g>` },


    "green-yellow-bandana": { local: `<path d="M-36-4q36 10 72 0l-36 32z" fill="#2E9E4F" stroke="#1E6E36" stroke-width="2"/><path d="M-30 0q30 8 60 0" stroke="#F6C343" stroke-width="3" fill="none"/>` },
    "tropical-flower": { local: `<g transform="translate(16 -6)">${[0, 72, 144, 216, 288].map((angle) => `<ellipse cx="0" cy="-9" rx="6" ry="10" fill="#F25C8E" transform="rotate(${angle})"/>`).join("")}<circle r="4" fill="#F6C343"/></g>` },
    "pandeiro": { local: `<circle r="13" fill="#F3E3C3" stroke="#8B5A2B" stroke-width="3.5"/>${[0, 60, 120, 180, 240, 300].map((angle) => `<circle cx="${Math.cos(angle * Math.PI / 180) * 13}" cy="${Math.sin(angle * Math.PI / 180) * 13}" r="2.4" fill="#C9C9C9"/>`).join("")}` },

    "lluchu-hat": { local: `<path d="M-34 0q0-40 34-42q34 2 34 42z" fill="#1F8A70" stroke="#145C4B" stroke-width="2"/><path d="M-33-12h66" stroke="#F2C14E" stroke-width="6"/><path d="M-28-12l5-4 5 4-5 4zM-8-12l5-4 5 4-5 4zM12-12l5-4 5 4-5 4z" fill="#E74C3C"/><path d="M-34 0l-4 22 12-6zM34 0l4 22-12-6z" fill="#E74C3C" stroke="#145C4B" stroke-width="1.5"/><path d="M-36 22l-2 12M36 22l2 12" stroke="#F2C14E" stroke-width="2.5"/><path d="M0-42l-4-8h8z" fill="#E74C3C"/>` },
    "aguayo-shawl": { global: `<path d="M56 128h88l8 28H48z" fill="#D7263D" stroke="#8A1828" stroke-width="2"/><path d="M54 134h92M52 140h96M50 146h100M49 152h102" stroke-width="3" fill="none" stroke="#F46036"/><path d="M53 137h94M51 149h98" stroke="#2E294E" stroke-width="2.5"/><path d="M52 143h96" stroke="#1B998B" stroke-width="2.5"/>` },
    "chuspa-pouch": { local: `<path d="M-14-6q14 20 28 0" stroke="#2E294E" stroke-width="2.5" fill="none"/><rect x="-10" y="8" width="20" height="18" rx="2" fill="#D7263D" stroke="#8A1828" stroke-width="1.5"/><path d="M-10 14h20M-10 20h20" stroke="#1B998B" stroke-width="2.5"/><path d="M-8 26v6M-3 26v6M2 26v6M7 26v6" stroke="#F46036" stroke-width="1.6"/>` }
  };

  const STATE_PROPS = {
    book: `<g class="c-prop c-prop-book"><path d="M-22-4q11-6 22 0q11-6 22 0v18q-11-6-22 0q-11-6-22 0z" fill="#fff" stroke="#6B5B73" stroke-width="2"/><path d="M0-4v18" stroke="#6B5B73" stroke-width="1.5"/></g>`,
    zzz: `<g class="c-prop c-prop-zzz" fill="none" stroke="#6E7BB8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M150 30h10l-10 10h10"/><path d="M166 14h7l-7 7h7"/></g>`,
    confetti: `<g class="c-prop c-prop-confetti">${[["#F25C8E", 40, 30], ["#F6C343", 160, 26], ["#5B8DEF", 26, 70], ["#3DAA4A", 176, 76], ["#F97316", 100, 14]].map(([color, x, y]) => `<rect x="${x}" y="${y}" width="6" height="10" rx="2" fill="${color}" transform="rotate(25 ${x} ${y})"/>`).join("")}</g>`
  };

  function placeLocal(art, anchor) {
    const [x, y, scale] = anchor;
    return `<g transform="translate(${x} ${y}) scale(${scale})">${art}</g>`;
  }

  function fallbackBadge(anchor) {
    const [x, y] = anchor || [100, 100];
    return `<g class="c-missing" transform="translate(${x} ${y})"><circle r="8" fill="#fff" stroke="#999" stroke-dasharray="3 2"/><text y="4" text-anchor="middle" font-size="11" fill="#777">?</text></g>`;
  }

  function itemLayer(itemId, speciesId, uid) {
    const art = ITEM_ART[itemId];
    const species = SPECIES_ART[speciesId];
    const item = app.companions.getItem(itemId);
    if (!item) return "";
    if (!art) {
      console.warn(`No artwork for item "${itemId}"; showing a placeholder.`);
      return fallbackBadge(species.anchors[item.slot]);
    }
    if (art.global) return `<g class="c-item c-item-${item.slot}">${typeof art.global === "function" ? art.global(uid) : art.global}</g>`;
    const anchor = species.anchors[item.slot];
    if (!anchor) return fallbackBadge();
    return `<g class="c-item c-item-${item.slot}">${placeLocal(art.local, anchor)}</g>`;
  }

  /** Full SVG markup for a companion wearing `equipped` (slot → itemId). */
  function render(speciesId, equipped, options) {
    const species = SPECIES_ART[speciesId] || SPECIES_ART.capybara;
    const id = SPECIES_ART[speciesId] ? speciesId : "capybara";
    const uid = `c${++renderCount}`;
    const layer = (slot) => (equipped[slot] ? itemLayer(equipped[slot], id, uid) : "");
    const label = options?.label || "";
    return `<svg class="companion" viewBox="0 0 200 200" data-species="${id}" data-state="${options?.state || "idle"}" role="img" aria-label="${app.dom.esc(label)}">
      <clipPath id="${uid}-frame"><rect width="200" height="200" rx="28"/></clipPath>
      <g clip-path="url(#${uid}-frame)">
        ${equipped.background ? layer("background") : `<rect width="200" height="200" fill="var(--companion-bg, transparent)"/>`}
        <ellipse cx="100" cy="186" rx="64" ry="7" fill="rgba(0,0,0,.12)"/>
        <g class="c-figure">
          ${layer("back")}
          <g class="c-body">${species.body}</g>
          ${layer("body")}
          ${layer("neck")}
          <g class="c-head">${species.head}${layer("eyes")}${layer("head")}${layer("ears")}</g>
          ${layer("hand")}${species.paw || ""}
          ${species.anchors.lap ? placeLocal(STATE_PROPS.book, species.anchors.lap) : ""}
        </g>
        ${layer("effect")}
        ${STATE_PROPS.zzz}${STATE_PROPS.confetti}
      </g>
    </svg>`;
  }

  function preview(itemId, speciesId) {
    const item = app.companions.getItem(itemId);
    return render(speciesId, item ? { [item.slot]: itemId } : {}, { state: "idle" });
  }

  app.companionArt = { render, preview, hasArt: (itemId) => Boolean(ITEM_ART[itemId]) };
})();
