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
      'ground-day',
      'body-day',
      'optics',
      'environment',
      'base-' + theme,
      ...(data.portrait ? ['portrait-' + theme] : []),
    ];
    const resources = textures.map((name) => bytes(name + '.ktx2'));
    const [wasm, geometry, grade] = await Promise.all([
      bytes('codecs/basis_transcoder.wasm.gz'),
      bytes('lake.meshopt.gz'),
      bytes('grade-' + theme + '.rgb.gz'),
    ]);
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
