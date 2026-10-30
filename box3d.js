// Inner markup of `.bundle-tilt` for one pack: a CSS 3D cuboid (front/back/left/right/top/bottom).
// Geometry, textures and lighting live in box3d.css. The pose (yaw/pitch) sits on `.box3d`, never on
// `.bundle-tilt`, because effects.js overwrites the tilt element's inline transform every frame.
//
// pack.holo (data flag): adds `is-holo` and a `.bx-holo` rainbow-foil layer inside the front/left/right/top faces
// (CSS in box3d.css). Without the flag no holo element is emitted at all.
//
// Optional per-pack textures: pack.boxFaces = {front,left,right,top} (image URLs, same face proportions:
// front 720x1046, sides 352x1046, top 720x352). Without it the default secret-box textures are used.
//
// The box can open: `.bundle-choice.is-opening` (set by app.js) swings `.bx-lid` up around the back edge, lifts
// the foil pack `.bx-pack` (pack.wrapperImage) out through the opening and sinks `.bx-rig`. All of it is CSS in
// box3d.css; the dark `bx-in-*` planes are the inside of the walls, seen once the lid is up.
const FACE_KEYS = ['front', 'back', 'left', 'right', 'top', 'bottom'];

export function boxMarkup(pack, escapeHTML = (value) => String(value)) {
  const faces = pack?.boxFaces || {};
  const vars = FACE_KEYS.filter((key) => faces[key])
    .map((key) => `--bx-${key}:url(&quot;${escapeHTML(faces[key])}&quot;)`);
  if (pack?.wrapperImage) vars.push(`--bx-pack:url(&quot;${escapeHTML(pack.wrapperImage)}&quot;)`);
  const holo = pack?.holo ? '<span class="bx-holo"></span>' : '';
  const style = vars.length ? ` style="${vars.join(';')}"` : '';
  return `<span class="bx-rig${holo ? ' is-holo' : ''}" aria-hidden="true"><span class="box3d"${style}>`
    + '<span class="bx-face bx-in bx-in-back"></span>'
    + '<span class="bx-face bx-in bx-in-left"></span>'
    + '<span class="bx-face bx-in bx-in-right"></span>'
    + '<span class="bx-face bx-in bx-in-floor"></span>'
    + '<span class="bx-shaft"></span>'
    + '<span class="bx-glow"></span>'
    + '<span class="bx-pack"></span>'
    + `<span class="bx-face bx-front"><span class="bx-gloss"></span>${holo}</span>`
    + '<span class="bx-face bx-back"></span>'
    + `<span class="bx-face bx-left">${holo}</span>`
    + `<span class="bx-face bx-right">${holo}</span>`
    + `<span class="bx-lid"><span class="bx-face bx-top">${holo}</span><span class="bx-face bx-lid-in"></span></span>`
    + '<span class="bx-face bx-bottom"></span>'
    + '</span><span class="bx-floor"></span></span>';
}
