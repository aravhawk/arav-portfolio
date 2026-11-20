// Decode away from event delivery. Each transfer spans at most 128 scanlines.
let resume, suspended;
self.onmessage = async ({ data }) => {
  if ('paused' in data) {
    if (data.paused && !suspended)
      suspended = new Promise((resolve) => {
        resume = resolve;
      });
    if (!data.paused && suspended) {
      resume();
      suspended = null;
    }
    return;
  }
  const { urls } = data;
  try {
    await Promise.all(
      urls.map(async (url, slot) => {
        const start = performance.timeOrigin + performance.now();
        const response = await fetch(url);
        if (!response.ok) throw Error(response.status + ' ' + url);
        const blob = await response.blob();
        const end = performance.timeOrigin + performance.now();
        const options = { colorSpaceConversion: 'none', premultiplyAlpha: 'none' };
        if (suspended) await suspended;
        const image = await createImageBitmap(blob, options);
        const { width, height } = image;
        self.postMessage({ kind: 'size', slot, width, height, start, end, url, bytes: blob.size });
        for (let y = 0; y < height; y += 128) {
          if (suspended) await suspended;
          const strip = await createImageBitmap(image, 0, y, width, Math.min(128, height - y), options);
          self.postMessage({ kind: 'strip', slot, y, strip }, [strip]);
        }
        image.close();
      }),
    );
    self.postMessage({ kind: 'done' });
  } catch (error) {
    self.postMessage({ kind: 'error', message: String(error) });
  }
};
