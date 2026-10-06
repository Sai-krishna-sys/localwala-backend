/**
 * LocalWala – Local Commerce & Delivery Platform
 *
 * computeLottieArtworkBounds — deterministic, conservative computation of a
 * Lottie animation's visible artwork bounds.
 *
 * This is the SINGLE source of truth for the geometry contract consumed by
 * BOTH renderers (Flutter app and Admin preview). The Admin must never
 * independently re-derive these bounds from the Lottie JSON — it always
 * consumes the metadata this module produces (as persisted in lottieMeta and
 * exposed through the v2 intent).
 *
 * Design rules:
 *  - Composition.width/height come from the Lottie `w`/`h` (always safe).
 *  - Visible layers are walked and their bounds transformed into composition
 *    pixel coordinates (y-down, same as Lottie).
 *  - Static transforms are fully supported (position, scale, rotation, anchor,
 *    nested/group transforms, precomp).
 *  - If ANY visual layer cannot be computed reliably (animated transform,
 *    unsupported shape/type, mask/matte/expression), we do NOT invent bounds:
 *    we fall back to the full composition rectangle (the safest supported
 *    result). Null/guide/audio/camera layers are skipped without triggering a
 *    fallback.
 *  - The final bounds are clamped to the composition rectangle.
 */

const TRANSPARENT = 0.000001; // effectively-invisible threshold for fill opacity

// ---------------------------------------------------------------------------
// 2D affine helpers (y-down, matching Lottie).
// A matrix is a 6-element array in column-major? We use a simple 2x3
// [a, b, c, d, e, f] representing:
//   x' = a*x + c*y + e
//   y' = b*x + d*y + f
// ---------------------------------------------------------------------------
const IDENTITY = () => [1, 0, 0, 1, 0, 0];

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const translate = (tx, ty) => [1, 0, 0, 1, tx, ty];
const scale = (sx, sy) => [sx, 0, 0, sy, 0, 0];
const rotate = (deg) => {
  const rad = ((deg % 360) * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, -s, c, 0, 0];
};

const applyPoint = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

// Transform an axis-aligned rect (local space) into a bounds using the matrix.
const transformRect = (m, left, top, right, bottom) => {
  const pts = [
    applyPoint(m, left, top),
    applyPoint(m, right, top),
    applyPoint(m, left, bottom),
    applyPoint(m, right, bottom),
  ];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
};

// ---------------------------------------------------------------------------
// Transform value parsing (Lottie `ks`).
// Returns the static value, or null if the property is animated/uncomputable.
// ---------------------------------------------------------------------------
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

const staticScalar = (prop) => {
  if (!prop) return 0;
  const k = prop.k;
  if (isNumber(k)) return k;
  if (Array.isArray(k) && k.length >= 1 && isNumber(k[0])) return k[0];
  return null; // animated
};

const staticPair = (prop) => {
  if (!prop) return [0, 0];
  const k = prop.k;
  if (Array.isArray(k) && k.length >= 2 && isNumber(k[0]) && isNumber(k[1])) return [k[0], k[1]];
  return null; // animated or malformed
};

// Layer transform matrix from a Lottie `ks` object. Returns null if any
// property is animated/malformed (=> triggers safe fallback).
const layerMatrix = (ks) => {
  if (!ks || typeof ks !== 'object') return IDENTITY();
  const a = staticPair(ks.a);
  const p = staticPair(ks.p);
  const s = staticPair(ks.s);
  const r = staticScalar(ks.r);
  if (a === null || p === null || s === null || r === null) return null;

  const [ax, ay] = a;
  const [px, py] = p;
  const sx = (Math.abs(s[0]) < TRANSPARENT ? 0 : s[0]) / 100;
  const sy = (Math.abs(s[1]) < TRANSPARENT ? 0 : s[1]) / 100;

  // Lottie order: translate(position) * rotate * scale * translate(-anchor)
  // i.e. anchor is applied first, then scale, then rotate, then position.
  let m = IDENTITY();
  m = mul(m, translate(px, py));
  m = mul(m, rotate(r));
  m = mul(m, scale(sx, sy));
  m = mul(m, translate(-ax, -ay));
  return m;
};

// ---------------------------------------------------------------------------
// Shape bounds (local space). shapeBounds(item, parentMatrix) -> [l,t,r,b] or null
// ---------------------------------------------------------------------------
const applyMatrixToRect = (m, l, t, r, b) => {
  if (!m) return null;
  const [x0, y0, x1, y1] = transformRect(m, l, t, r, b);
  return [x0, y0, x1, y1];
};

const shapeRec = (item, matrix) => {
  if (!item || typeof item !== 'object') return null;
  const ty = item.ty;
  let m = matrix || IDENTITY();

  if (ty === 'tr') {
    // group transform — multiply onto the stack (null => fallback)
    const child = layerMatrix(item);
    return child ? mul(m, child) : null;
  }

  if (ty === 'gr') {
    // group: children each carry their own transform; the group's own `tr`
    // is applied within. We recurse children with the current matrix and the
    // group transform is handled by the 'tr' child inside `it`.
    return shapeItems(item.it || [], m);
  }

  if (ty === 'rc') {
    const p = staticPair(item.p);
    const s = staticPair(item.s);
    const r = staticScalar(item.r);
    if (!p || !s || r === null) return null;
    const [cx, cy] = p;
    const [w, h] = s;
    const rad = Math.abs(r);
    const l = cx - w / 2;
    const t = cy - h / 2;
    const rr = Math.min(rad, w / 2, h / 2);
    return applyMatrixToRect(m, l + 0, t + 0, l + w, t + h);
  }

  if (ty === 'el') {
    const p = staticPair(item.p);
    const s = staticPair(item.s);
    if (!p || !s) return null;
    const [cx, cy] = p;
    let [rxx, ryy] = s;
    const d = staticScalar(item.d);
    if (d === null) return null;
    // Lottie ellipse s is [rx, ry]; for horizontal/vertical only.
    if (Math.abs(rxx) < TRANSPARENT) rxx = 0;
    if (Math.abs(ryy) < TRANSPARENT) ryy = 0;
    const w = Math.abs(rxx) * 2;
    const h = Math.abs(ryy) * 2;
    return applyMatrixToRect(m, cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
  }

  if (ty === 'sr') {
    // star/polygon: opaque bounds. Use the outer radius to form a conservative
    // bounding square around the center (rotated within the matrix anyway).
    const p = staticPair(item.p);
    const or = staticScalar(item.or);
    const ir = staticScalar(item.ir);
    const pt = staticScalar(item.pt);
    if (!p || or === null || ir === null || pt === null) return null;
    const [cx, cy] = p;
    const R = Math.max(Math.abs(or), Math.abs(ir)) + 1;
    return applyMatrixToRect(m, cx - R, cy - R, cx + R, cy + R);
  }

  // fill/stroke/mask merge/trim/round/null carry no geometry themselves
  if (['fl', 'st', 'mm', 'tm', 'rd', 'gf', 'gs', 'gv', 'sh', 'rp', 'op'].includes(ty)) return null;
  if (ty === 'st') return null;
  return null;
};

const shapeItems = (items, matrix) => {
  // Sum of transformed shapes. Returns null if any shape is uncomputable OR
  // if the group has a stroke that would extend bounds (conservative).
  let mtx = matrix || IDENTITY();
  let acc = null;
  for (const it of items) {
    if (it.ty === 'tr') {
      const child = layerMatrix(it);
      if (child === null) return null;
      mtx = mul(mtx, child); // group transform applied to subsequent siblings
      continue;
    }
    const b = shapeRec(it, mtx);
    if (b === null) {
      // A null is a non-geometric child; OK. But if it's a shape type we
      // can't compute => fallback.
      if (['rc', 'el', 'sr', 'gr', 'sh'].includes(it.ty)) return null;
      continue;
    }
    acc = union(acc, b);
  }
  return acc;
};

// ---------------------------------------------------------------------------
// Text layer bounds (conservative estimate using character count + size).
// Returns null => fallback to composition.
// ---------------------------------------------------------------------------
const textBounds = (layer, matrix) => {
  const doc = layer.t && layer.t.d && layer.t.d.k && layer.t.d.k[0];
  if (!doc) return null;
  const text = (doc.t || '');

  // Font size (px). Sources vary by lottie version: s.size / s.fs / numeric s.
  const style = doc.s;
  let size = null;
  if (isNumber(style)) {
    size = style;
  } else if (style && typeof style === 'object') {
    const v = style.size != null ? style.size : (style.fs != null ? style.fs : style.fontSize);
    if (isNumber(v)) size = v;
  }
  if (size === null || size <= 0) return null;

  const n = text.length || 1;
  // Conservative estimate: ~0.66em avg glyph width (monospace-ish bound).
  const w = Math.max(size, n * size * 0.66);
  const h = size * 1.2;

  // Text baseline origin is handled by the layer transform (matrix includes
  // position/anchor). We bound from origin assuming a cap-height box.
  const local = [0, 0, w, h];
  return applyMatrixToRect(matrix, local[0], local[1], local[2], local[3]);
};

// ---------------------------------------------------------------------------
// Union + clamp helpers
// ---------------------------------------------------------------------------
const union = (a, b) => {
  if (!a) return b ? [...b] : null;
  if (!b) return [...a];
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
};

const clampRect = (rect, w, h) => {
  const l = Math.max(0, Math.floor(Math.min(rect[0], w)));
  const t = Math.max(0, Math.floor(Math.min(rect[1], h)));
  const r = Math.min(Math.floor(Math.max(rect[2], 0)), w);
  const b = Math.min(Math.floor(Math.max(rect[3], 0)), h);
  return { left: l, top: t, right: r, bottom: b };
};

// ---------------------------------------------------------------------------
// Asset / layer walking
// ---------------------------------------------------------------------------
const SKIP = Symbol('skip');
const findAsset = (assets, id) => {
  if (!assets || !id) return null;
  return assets.find((a) => a && a.id === id) || null;
};

// Walk layers in `layers`, in this coordinate space, with `assets` available
// for precomp resolution. Returns an array of bounds, or null if any visual
// layer is uncomputable (=> whole composition fallback).
const layerLocalBox = (layers, width, height, assets) => {
  let acc = null;
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object') continue;
    const res = layerBounds(layer, IDENTITY(), assets, width, height);
    if (res === null) return null; // uncomputable visual layer => full fallback
    if (res === SKIP) continue; // non-geometric layer => skip
    acc = union(acc, res);
  }
  return acc;
};

// Compute a single layer's bounds in comp coords.
// Returns: number[] bounds | SKIP (non-geometric) | null (uncomputable).
const layerBounds = (layer, inheritedMatrix, assets, width, height) => {
  const ty = layer.ty;
  const m = layerMatrix(layer.ks);
  if (m === null) return null; // animated/unsupported transform => fallback
  const mat = mul(inheritedMatrix, m);

  // Non-geometric layer types — skip, never trigger fallback.
  if (ty === 3 || ty === 6 || ty === 7 || ty === 8 || ty === 9 || ty === 10 || ty === 13) {
    return SKIP;
  }
  if (ty !== 0 && ty !== 1 && ty !== 2 && ty !== 4 && ty !== 5) {
    return null; // unknown visual layer type => trigger full fallback
  }

  // Opacity ~0 => effectively invisible => skip.
  const opacity = staticScalar(layer.ks && layer.ks.o);
  if (opacity !== null && Math.abs(opacity) < TRANSPARENT) return null;

  // Reject layers whose masks/mattes/expressions we cannot honor.
  if (layer.hasMask || (layer.masksProperties && layer.masksProperties.length)) return null;
  if (layer.tt) return null; // matte type
  if (layer.mt) return null; // matte target
  if (layer.x) return null; // expressions
  if (layer.ao === 1) return null; // auto-orient

  if (ty === 1 || ty === 2) {
    // solid / image layer: geometry is an axis-aligned rect in layer space.
    const lw = Number(layer.w);
    const lh = Number(layer.h);
    if (!isNumber(lw) || !isNumber(lh) || lw <= 0 || lh <= 0) return null;
    return applyMatrixToRect(mat, 0, 0, lw, lh);
  }

  if (ty === 0) {
    // precomp: recurse into the referenced asset's layers.
    const asset = findAsset(assets, layer.refId);
    if (!asset || !Array.isArray(asset.layers)) return null;
    const aw = Number(asset.w);
    const ah = Number(asset.h);
    if (!isNumber(aw) || !isNumber(ah) || aw <= 0 || ah <= 0) return null;
    const inner = layerLocalBox(asset.layers, aw, ah, assets);
    if (inner === null) return null;
    return applyMatrixToRect(mat, inner[0], inner[1], inner[2], inner[3]);
  }

  if (ty === 4) {
    // shape layer: shapes are defined in the layer's local space.
    const shapeBox = shapeItems(layer.shapes || [], IDENTITY());
    if (shapeBox === null) return null;
    return applyMatrixToRect(mat, shapeBox[0], shapeBox[1], shapeBox[2], shapeBox[3]);
  }

  if (ty === 5) {
    return textBounds(layer, mat);
  }

  return null;
};

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
const computeLottieArtworkBounds = (json) => {
  const composition = { width: 0, height: 0, aspect: 1 };
  let artworkBounds = null;

  try {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (!data || typeof data !== 'object') throw new Error('Not a Lottie object');

    const cw = Number(data.w);
    const ch = Number(data.h);
    if (!isNumber(cw) || !isNumber(ch) || cw <= 0 || ch <= 0) throw new Error('Invalid composition size');

    composition.width = cw;
    composition.height = ch;
    composition.aspect = ch > 0 ? cw / ch : 1;

    const assets = Array.isArray(data.assets) ? data.assets : [];
    const box = layerLocalBox(Array.isArray(data.layers) ? data.layers : [], cw, ch, assets);

    if (box === null) {
      artworkBounds = { left: 0, top: 0, right: cw, bottom: ch };
    } else if (box) {
      artworkBounds = clampRect(box, cw, ch);
      if (artworkBounds.right <= artworkBounds.left || artworkBounds.bottom <= artworkBounds.top) {
        artworkBounds = { left: 0, top: 0, right: cw, bottom: ch };
      }
    } else {
      artworkBounds = { left: 0, top: 0, right: cw, bottom: ch };
    }
  } catch (err) {
    // Malformed / unparseable => composition-only, null bounds.
    artworkBounds = null;
  }

  return { composition, artworkBounds };
};

module.exports = { computeLottieArtworkBounds };
