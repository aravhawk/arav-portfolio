/* Asset decoding stays on the lab worker. All uploaded levels are transferred. */
importScripts('codecs/meshopt.js', 'codecs/basis_transcoder.js');
async function bytes(file) {
  const response = await fetch(file);
  if (!response.ok) throw new Error(file + ' ' + response.status);
  if (file.endsWith('.gz'))
    return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return response.arrayBuffer();
}
self.onmessage = async ({ data }) => {
  try {
    const { theme, rgb, rgba } = data;
    const metadata = await (await fetch('mesh.json')).json();
    const textures = [
      'ground-' + theme,
      'body-day',
      'optics',
      'environment',
      null, // Native 4:4:4 radiance field at slot four.
      'portrait-' + theme,
      'approach-ground-' + theme,
      'approach-body-' + theme,
    ];
    const resources = textures.map((name) => name && bytes(name + '.ktx2'));
    const photographs = [
      [4, 'base-' + theme],
      [8, 'lake-uv-' + theme],
      [9, 'two-rows-' + theme],
      [10, 'lake-detail'],
      [11, 'lake-fractures'],
    ].map(async ([index, name]) => {
      const encoded = await bytes(name + '.avif');
      const bitmap = await createImageBitmap(new Blob([encoded], { type: 'image/avif' }), {
        colorSpaceConversion: 'none',
        premultiplyAlpha: 'none',
      });
      self.postMessage({ kind: 'bitmap', index, bitmap }, [bitmap]);
    });
    const [wasm, geometry, packedGrade] = await Promise.all([
      bytes('codecs/basis_transcoder.wasm.gz'),
      bytes('lake.meshopt.gz'),
      bytes('grade-' + theme + '.rgb.gz'),
    ]);
    const planes = new Uint8Array(packedGrade);
    const lut = new Uint8Array(planes.length);
    const entries = planes.length / 3;
    for (let c = 0; c < 3; c++) {
      let value = 0;
      for (let i = 0; i < entries; i++) {
        value = (value + planes[c * entries + i]) & 255;
        lut[3 * i + c] = value;
      }
    }
    const grade = lut.buffer;
    const [basis] = await Promise.all([BASIS({ wasmBinary: wasm }), self.MeshoptDecoder.ready]);
    basis.initializeBasis();
    let offset = 0;
    const draws = metadata.draws.map((info) => {
      const vertices = new Uint8Array(info.vertices * 8);
      const indices = new Uint8Array(info.indices * 2);
      self.MeshoptDecoder.decodeVertexBuffer(
        vertices,
        info.vertices,
        8,
        new Uint8Array(geometry, offset, info.vertexBytes),
      );
      offset += info.vertexBytes;
      self.MeshoptDecoder.decodeIndexBuffer(
        indices,
        info.indices,
        2,
        new Uint8Array(geometry, offset, info.indexBytes),
      );
      offset += info.indexBytes;
      return { info, vertices, indices };
    });
    self.postMessage({ kind: 'mesh', draws, metadata, grade }, [
      grade,
      ...draws.flatMap((d) => [d.vertices.buffer, d.indices.buffer]),
    ]);
    for (let index = 0; index < textures.length; index++) {
      if (!textures[index]) continue;
      const file = new basis.KTX2File(new Uint8Array(await resources[index]));
      try {
        if (!file.isValid() || !file.startTranscoding())
          throw new Error(textures[index] + ' is not valid Basis KTX2');
        const mode = file.getHasAlpha() ? rgba : rgb;
        const mips = [];
        for (let k = 0; k < file.getLevels(); k++) {
          const dst = new Uint8Array(file.getImageTranscodedSizeInBytes(k, 0, 0, mode[0]));
          if (!file.transcodeImage(dst, k, 0, 0, mode[0], 0, -1, -1)) throw new Error('KTX2 level ' + k);
          mips.push(dst);
        }
        self.postMessage(
          {
            kind: 'texture',
            index,
            format: mode[1],
            width: file.getWidth(),
            height: file.getHeight(),
            mips,
          },
          mips.map((m) => m.buffer),
        );
      } finally {
        file.close();
        file.delete();
      }
    }
    await Promise.all(photographs);
    self.postMessage({
      kind: 'done',
      resources: performance.getEntriesByType('resource').map((r) => ({
        name: r.name,
        start: performance.timeOrigin + r.startTime,
        end: performance.timeOrigin + r.responseEnd,
        bytes: r.encodedBodySize,
      })),
    });
  } catch (err) {
    self.postMessage({ kind: 'error', message: String(err) });
  }
};
