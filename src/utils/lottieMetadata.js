const { computeLottieArtworkBounds } = require('./lottieArtwork');
const { fetchFileAsJson } = require('./fetchFile');

const resolveLottieUrls = (param) => {
  const urls = [];
  if (param.animationType === 'lottie' && param.animationUrl) {
    urls.push(param.animationUrl);
  }
  if (Array.isArray(param.slides)) {
    for (const slide of param.slides) {
      if (slide.animationType === 'lottie' && slide.animationUrl) urls.push(slide.animationUrl);
    }
  }
  if (Array.isArray(param.animations)) {
    for (const anim of param.animations) {
      if (anim.type === 'lottie' && anim.url) urls.push(anim.url);
    }
  }
  return urls;
};

const computeMetaFromJson = (json) => {
  if (!json || typeof json !== 'object') return null;
  const result = computeLottieArtworkBounds(json);
  if (!result || !result.composition || result.composition.width <= 0 || result.composition.height <= 0) return null;
  return {
    composition: {
      width: result.composition.width,
      height: result.composition.height,
      aspect: result.composition.aspect,
    },
    artworkBounds: result.artworkBounds || { left: 0, top: 0, right: result.composition.width, bottom: result.composition.height },
    computedAt: new Date(),
  };
};

const attachLottieMetadata = async (headerDoc) => {
  try {
    const urls = resolveLottieUrls(headerDoc);
    if (!urls.length) return;
    const primaryUrl = urls[0];
    const json = await fetchFileAsJson(primaryUrl);
    const meta = computeMetaFromJson(json);
    if (meta) {
      headerDoc.lottieMeta = meta;
      await headerDoc.save();
    }
  } catch (err) {
    console.warn('[lottieMetadata] non-fatal: failed to compute metadata', err.message);
  }
};

module.exports = { attachLottieMetadata, computeMetaFromJson, resolveLottieUrls };
