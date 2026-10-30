// Grade presets for the pack-opening spectacle: C(COMMON) < B < A < S < SS < SSS(SECRET RARE).
// One table drives everything: app.js sets #scene[data-grade] + CSS variables from it (apply), effects.js reads the same table for
// particles / WebGL rays / sound, grade-fx.css and card-shine.css style from the variables. Cards without a grade count as SSS.
// effects.js and app.js read this through globalThis.GradeFX (no import) so they keep working when it is missing: they fall back to the
// SSS look and timings. Colors are [r,g,b]. Particle counts are for a power-1 burst, hard-capped in effects.js.
export const GRADE_ORDER = ['C', 'B', 'A', 'S', 'SS', 'SSS'];

export const GRADE_FX = {
  C: {
    label: 'COMMON', rgb: [158, 200, 122], light: [232, 245, 214], deep: [86, 138, 72],
    // ms: charge-up, tear -> release, -> card rises, rise (= spin) length, glare clears -> result
    timing: {charge: 550, tear: 750, emerge: 1050, reveal: 950, settle: 1000},
    rays: {gain: 0, prism: 0, resid: 0}, burst: {count: 16, speed: 150, size: 1.6, life: .6, star: 0}, dust: 0,
    palette: [[158, 200, 122], [232, 245, 214]],
    rings: 0, shake: 0, spin: 0, dark: 0, bloom: .45, banner: 2200,
    shine: {rgb: [236, 241, 232], alpha: .2, dur: 7.5, foil: 0},
    sound: {notes: [987.77, 1318.51], gap: .09, delay: .08, level: .05, tail: .75, charge: .45, impact: .3, suspense: 0, whoosh: .45, boom: 0, sting: false}
  },
  B: {
    label: 'UNCOMMON', rgb: [88, 160, 236], light: [214, 236, 255], deep: [44, 98, 176],
    timing: {charge: 700, tear: 850, emerge: 1200, reveal: 1050, settle: 1150},
    rays: {gain: .22, prism: 0, resid: 0}, burst: {count: 36, speed: 200, size: 1.8, life: .7, star: .2}, dust: 0,
    palette: [[88, 160, 236], [214, 236, 255], [150, 200, 255]],
    rings: 1, shake: 0, spin: 0, dark: 0, bloom: .6, banner: 2500,
    shine: {rgb: [200, 226, 255], alpha: .24, dur: 6.8, foil: .04},
    sound: {notes: [783.99, 1046.5, 1318.51], gap: .09, delay: .12, level: .05, tail: 1.05, charge: .6, impact: .5, suspense: .4, whoosh: .6, boom: 0, sting: false}
  },
  A: {
    label: 'RARE', rgb: [226, 108, 120], light: [255, 224, 220], deep: [160, 48, 60],
    timing: {charge: 850, tear: 950, emerge: 1350, reveal: 1150, settle: 1300},
    rays: {gain: .45, prism: 0, resid: .6}, burst: {count: 60, speed: 250, size: 2, life: .8, star: .3}, dust: 0,
    palette: [[226, 108, 120], [255, 224, 220], [255, 170, 160]],
    rings: 1, shake: 0, spin: 1, dark: 0, bloom: .75, banner: 2900,
    shine: {rgb: [255, 205, 190], alpha: .28, dur: 6.2, foil: .08},
    sound: {notes: [659.25, 880, 1108.73, 1318.51], gap: .1, delay: .2, level: .045, tail: 1.35, charge: .75, impact: .7, suspense: .6, whoosh: .75, boom: .25, sting: false}
  },
  S: {
    label: 'SUPER RARE', rgb: [166, 124, 240], light: [236, 224, 255], deep: [100, 50, 200],
    timing: {charge: 1000, tear: 1050, emerge: 1450, reveal: 1250, settle: 1400},
    rays: {gain: .75, prism: 0, resid: .8}, burst: {count: 90, speed: 300, size: 2.4, life: .9, star: .5}, dust: 0,
    palette: [[166, 124, 240], [236, 224, 255], [190, 200, 255], [215, 170, 255]],
    rings: 2, shake: 2.5, spin: 1, dark: .2, bloom: .9, banner: 3300,
    shine: {rgb: [214, 190, 255], alpha: .31, dur: 5.6, foil: .11},
    sound: {notes: [523.25, 659.25, 783.99, 1046.5, 1318.51], gap: .095, delay: .3, level: .045, tail: 1.65, charge: .85, impact: .85, suspense: .8, whoosh: .9, boom: .5, sting: false}
  },
  SS: {
    label: 'ULTRA RARE', rgb: [255, 152, 60], light: [255, 226, 184], deep: [210, 96, 26],
    timing: {charge: 1200, tear: 1100, emerge: 1550, reveal: 1300, settle: 1450},
    rays: {gain: 1, prism: 0, resid: 1}, burst: {count: 130, speed: 360, size: 2.8, life: 1, star: .5}, dust: 8,
    palette: [[255, 152, 60], [255, 226, 184], [255, 190, 110], [255, 120, 70]],
    rings: 4, shake: 6, spin: 2, dark: .55, bloom: 1, banner: 3800,
    shine: {rgb: [255, 196, 120], alpha: .34, dur: 5, foil: .14},
    sound: {notes: [440, 554.37, 659.25, 880, 1108.73, 1318.51], gap: .09, delay: .4, level: .042, tail: 2, charge: 1, impact: 1, suspense: 1, whoosh: 1, boom: .8, sting: false}
  },
  SSS: {
    label: 'SECRET RARE', rgb: [250, 204, 110], light: [255, 243, 207], deep: [224, 164, 58],
    timing: {charge: 1200, tear: 1150, emerge: 1600, reveal: 1300, settle: 1500},
    rays: {gain: 1.1, prism: .5, resid: 1}, burst: {count: 150, speed: 380, size: 3, life: 1.15, star: .6}, dust: 36,
    palette: [[250, 204, 110], [255, 243, 207], [90, 255, 221], [229, 168, 255], [255, 219, 123]],
    rings: 5, shake: 7, spin: 3, dark: .8, bloom: 1, banner: 4300,
    shine: {rgb: [255, 226, 160], alpha: .36, dur: 4.4, foil: .17},
    sound: {notes: [392, 587.33, 783.99, 1174.66, 1567.98, 2349.32, 3135.96], gap: .1, delay: .45, level: .04, tail: 2.1, charge: 1, impact: 1, suspense: 1, whoosh: 1, boom: 1, sting: true}
  }
};

const gradeOf = (grade) => GRADE_FX[grade] ? grade : 'SSS';
const css = (value) => Array.isArray(value) ? value.join(' ') : String(value);

// Select a grade on the scene: data attributes for CSS selectors, custom properties for numbers and colors.
function apply(scene, grade) {
  const id = gradeOf(grade), fx = GRADE_FX[id], style = scene.style, t = fx.timing;
  scene.dataset.grade = id;
  scene.dataset.rings = String(fx.rings);
  const vars = {
    '--g-rgb': css(fx.rgb), '--g-rgb2': css(fx.light), '--g-rgb3': css(fx.deep),
    '--t-charge': `${t.charge}ms`, '--t-tear': `${t.tear}ms`, '--t-emerge': `${t.emerge}ms`, '--t-reveal': `${t.reveal}ms`,
    '--spin': fx.spin, '--shake': `${fx.shake}px`, '--dark': fx.dark, '--bloom': fx.bloom, '--banner-dur': `${fx.banner}ms`,
    '--shine-rgb': css(fx.shine.rgb), '--shine-a': fx.shine.alpha, '--shine-dur': `${fx.shine.dur}s`, '--foil-a': fx.shine.foil
  };
  for (const name in vars) style.setProperty(name, vars[name]);
  const banner = scene.querySelector?.('#grade-banner');
  if (banner) {banner.querySelector('.gb-grade').textContent = id; banner.querySelector('.gb-name').textContent = fx.label;}
  return fx;
}
function clear(scene) {
  delete scene.dataset.grade;
  delete scene.dataset.rings;
  for (const name of [...scene.style]) if (/^--(g-rgb|t-|spin|shake|dark|bloom|banner-dur|shine-|foil-a)/.test(name)) scene.style.removeProperty(name);
}

// Decoration layers owned by this file (all aria-hidden): tunnel-vision vignette, prism sweep, lens streak, extra shock rings,
// a quiet grade banner and the skip button. app.js wires the skip button; everything else is pure CSS (grade-fx.css).
function mount() {
  const scene = document.querySelector('#scene');
  if (!scene || scene.querySelector('#grade-fx')) return;
  const layer = document.createElement('div');
  layer.id = 'grade-fx';layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<i class="gfx-vignette"></i><i class="gfx-prism"></i><i class="gfx-lens"></i><i class="gfx-ring gfx-ring-a"></i><i class="gfx-ring gfx-ring-b"></i>';
  const anchor = scene.querySelector('.shockwave');
  anchor ? anchor.after(layer) : scene.append(layer);
  const banner = document.createElement('div');
  banner.id = 'grade-banner';banner.className = 'grade-banner';banner.setAttribute('aria-hidden', 'true');
  banner.innerHTML = '<i class="gb-rule"></i><b class="gb-grade"></b><span class="gb-name"></span><i class="gb-rule"></i>';
  const skip = document.createElement('button');
  skip.id = 'skip-fx';skip.type = 'button';skip.className = 'quiet-button skip-fx';skip.innerHTML = '건너뛰기 <span aria-hidden="true">»</span>';
  scene.append(banner, skip);
}

const GradeFX = {table: GRADE_FX, order: GRADE_ORDER, gradeOf, timing: (grade) => GRADE_FX[gradeOf(grade)].timing, apply, clear};
globalThis.GradeFX = GradeFX;
if (typeof document !== 'undefined') mount();
