const { test } = require('node:test');
const assert = require('node:assert');
const { computeLottieArtworkBounds } = require('../src/utils/lottieArtwork.js');

const solid = (w, h, p, opts = {}) => ({
  ty: 1, w, h,
  ks: { o: { k: opts.op ?? 100 }, p: { k: p }, a: { k: opts.a ?? [0, 0] }, s: { k: opts.s ?? [100, 100] }, r: { k: opts.r ?? 0 } },
  ...opts.extra,
});

const expectBounds = (json, exp, { aspect, tol = 1 } = {}) => {
  const r = computeLottieArtworkBounds(json);
  if (aspect !== undefined) assert.strictEqual(r.composition.aspect, aspect);
  assert.ok(r.artworkBounds, 'expected artworkBounds');
  assert.ok(Math.abs(r.artworkBounds.left - exp.left) <= tol, `left ${r.artworkBounds.left} != ~${exp.left}`);
  assert.ok(Math.abs(r.artworkBounds.top - exp.top) <= tol, `top ${r.artworkBounds.top} != ~${exp.top}`);
  assert.ok(Math.abs(r.artworkBounds.right - exp.right) <= tol, `right ${r.artworkBounds.right} != ~${exp.right}`);
  assert.ok(Math.abs(r.artworkBounds.bottom - exp.bottom) <= tol, `bottom ${r.artworkBounds.bottom} != ~${exp.bottom}`);
};

const expectFullCanvas = (json, { w, h, aspect } = {}) => {
  const r = computeLottieArtworkBounds(json);
  if (aspect !== undefined) assert.strictEqual(r.composition.aspect, aspect);
  if (w !== undefined && h !== undefined) {
    assert.ok(r.artworkBounds && r.artworkBounds.left === 0 && r.artworkBounds.top === 0
      && r.artworkBounds.right === w && r.artworkBounds.bottom === h, `expected full canvas but got ${JSON.stringify(r.artworkBounds)}`);
  }
};

test('artwork filling the entire canvas', () => {
  expectBounds({ w: 2062, h: 2062, layers: [solid(2062, 2062, [0, 0])] }, { left: 0, top: 0, right: 2062, bottom: 2062 }, { aspect: 1 });
});

test('transparent left/right margins', () => {
  expectBounds({ w: 100, h: 100, layers: [solid(40, 40, [30, 30])] }, { left: 30, top: 30, right: 70, bottom: 70 });
});

test('transparent top/bottom margins', () => {
  expectBounds({ w: 100, h: 100, layers: [solid(100, 20, [0, 40])] }, { left: 0, top: 40, right: 100, bottom: 60 });
});

test('centered artwork', () => {
  expectBounds({ w: 100, h: 100, layers: [solid(50, 50, [25, 25])] }, { left: 25, top: 25, right: 75, bottom: 75 });
});

test('rotated artwork (center anchor)', () => {
  expectBounds({ w: 100, h: 100, layers: [solid(40, 40, [50, 50], { a: [20, 20], r: 45 })] }, { left: 21, top: 21, right: 78, bottom: 78 }, { tol: 2 });
});

test('scaled artwork', () => {
  expectBounds({ w: 100, h: 100, layers: [solid(20, 20, [0, 0], { s: [200, 200] })] }, { left: 0, top: 0, right: 40, bottom: 40 });
});

test('shape layer (rect)', () => {
  const shapeRect = { ty: 4, ks: { o: { k: 100 }, p: { k: [0, 0] }, a: { k: [0, 0] }, s: { k: [100, 100] }, r: { k: 0 } }, shapes: [{ ty: 'gr', it: [
    { ty: 'rc', p: { k: [50, 50] }, s: { k: [40, 20] }, r: { k: 0 } },
    { ty: 'tr', o: { k: 100 }, p: { k: [0, 0] }, a: { k: [0, 0] }, s: { k: [100, 100] }, r: { k: 0 } },
  ] }] };
  expectBounds({ w: 100, h: 100, layers: [shapeRect] }, { left: 30, top: 40, right: 70, bottom: 60 });
});

test('text layer', () => {
  const textLayer = { ty: 5, ks: { o: { k: 100 }, p: { k: [10, 10] }, a: { k: [0, 0] }, s: { k: [100, 100] }, r: { k: 0 } }, t: { d: { k: [{ s: { size: 20 }, f: 'Arial', t: 'HELLO' }] } } };
  const r = computeLottieArtworkBounds({ w: 200, h: 100, layers: [textLayer] });
  assert.ok(r.artworkBounds, 'text should compute bounds');
  assert.ok(r.artworkBounds.right > r.artworkBounds.left, 'text has width');
  assert.ok(r.artworkBounds.bottom > r.artworkBounds.top, 'text has height');
});

test('1:1 composition', () => {
  expectFullCanvas({ w: 2062, h: 2062, layers: [solid(2062, 2062, [0, 0])] }, { aspect: 1 });
});

test('16:9 composition', () => {
  expectFullCanvas({ w: 1920, h: 1080, layers: [solid(1920, 1080, [0, 0])] }, { aspect: 1920 / 1080 });
});

test('9:16 composition', () => {
  expectFullCanvas({ w: 1080, h: 1920, layers: [solid(1080, 1920, [0, 0])] }, { aspect: 1080 / 1920 });
});

test('malformed JSON', () => {
  const r = computeLottieArtworkBounds('this is not json{');
  assert.strictEqual(r.composition.width, 0);
  assert.strictEqual(r.artworkBounds, null);
});

test('invalid composition size', () => {
  const r = computeLottieArtworkBounds({ w: 0, h: 100, layers: [solid(50, 50, [0, 0])] });
  assert.strictEqual(r.artworkBounds, null);
});

test('unsupported layer type => full composition fallback', () => {
  expectFullCanvas({ w: 100, h: 100, layers: [{ ty: 99, ks: { o: { k: 100 }, p: { k: [0, 0] }, a: { k: [0, 0] }, s: { k: [100, 100] }, r: { k: 0 } } }] });
});

test('animated transform => full composition fallback', () => {
  const layer = solid(30, 30, [0, 0]);
  layer.ks.p = { k: [{ t: 0, s: [0, 0] }, { t: 10, s: [50, 50] }], a: 1 };
  expectFullCanvas({ w: 100, h: 100, layers: [layer] });
});

test('mask on layer => full composition fallback', () => {
  expectFullCanvas({ w: 100, h: 100, layers: [solid(30, 30, [0, 0], { extra: { masksProperties: [{ ty: 'a' }] } })] });
});

test('null/guide layer is skipped (no fallback)', () => {
  expectBounds({ w: 100, h: 100, layers: [
    { ty: 3, ks: { o: { k: 100 }, p: { k: [0, 0] }, a: { k: [0, 0] }, s: { k: [100, 100] }, r: { k: 0 } } },
    solid(40, 40, [0, 0]),
  ] }, { left: 0, top: 0, right: 40, bottom: 40 });
});

test('precomp layer (nested asset)', () => {
  const inner = { ty: 4, ks: { o: { k: 100 }, p: { k: [0, 0] }, a: { k: [0, 0] }, s: { k: [100, 100] }, r: { k: 0 } }, shapes: [{ ty: 'gr', it: [
    { ty: 'rc', p: { k: [25, 25] }, s: { k: [50, 50] }, r: { k: 0 } },
    { ty: 'tr', o: { k: 100 }, p: { k: [0, 0] }, a: { k: [0, 0] }, s: { k: [100, 100] }, r: { k: 0 } },
  ] }] };
  const comp = { w: 100, h: 100, layers: [
    { ty: 0, refId: 'pre', ks: { o: { k: 100 }, p: { k: [0, 0] }, a: { k: [0, 0] }, s: { k: [100, 100] }, r: { k: 0 } } },
  ], assets: [{ id: 'pre', w: 100, h: 100, layers: [inner] }] };
  // inner rect 50x50 centered at 25,25 => artwork [0,0,50,50]
  expectBounds(comp, { left: 0, top: 0, right: 50, bottom: 50 });
});
