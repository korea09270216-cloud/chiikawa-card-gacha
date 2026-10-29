// Inner markup of `.bundle-tilt` for one pack: a CSS 3D cuboid (front/back/left/right/top/bottom).
// Geometry, textures and lighting live in box3d.css. The pose (yaw/pitch) sits on `.box3d`, never on
// `.bundle-tilt`, because effects.js overwrites the tilt element's inline transform every frame.
//
// Optional per-pack textures: pack.boxFaces = {front,left,right,top} (image URLs, same face proportions:
// front 720x1046, sides 352x1046, top 720x352). Without it the default secret-box textures are used.
const FACE_KEYS = ['front', 'back', 'left', 'right', 'top', 'bottom'];

export function boxMarkup(pack, escapeHTML = (value) => String(value)) {
  const faces = pack?.boxFaces || {};
  const vars = FACE_KEYS.filter((key) => faces[key])
    .map((key) => `--bx-${key}:url(&quot;${escapeHTML(faces[key])}&quot;)`).join(';');
  const style = vars ? ` style="${vars}"` : '';
  return `<span class="box3d" aria-hidden="true"${style}>`
    + '<span class="bx-face bx-front"><span class="bx-gloss"></span></span>'
    + '<span class="bx-face bx-back"></span>'
    + '<span class="bx-face bx-left"></span>'
    + '<span class="bx-face bx-right"></span>'
    + '<span class="bx-face bx-top"></span>'
    + '<span class="bx-face bx-bottom"></span>'
    + '</span><span class="bx-floor" aria-hidden="true"></span>';
}
