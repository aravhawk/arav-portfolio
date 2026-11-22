// Copy the pinned worker codecs from three. Only the lab's dedicated worker loads these files.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const libs = 'node_modules/three/examples/jsm/libs';
const dest = 'public/scene/lake/codecs';
await mkdir(dest, { recursive: true });
await copyFile(`${libs}/basis/basis_transcoder.js`, `${dest}/basis_transcoder.js`);
await writeFile(
  `${dest}/basis_transcoder.wasm.gz`,
  gzipSync(await readFile(`${libs}/basis/basis_transcoder.wasm`), { level: 9 }),
);
const mesh = await readFile(`${libs}/meshopt_decoder.module.js`, 'utf8');
await writeFile(
  `${dest}/meshopt.js`,
  mesh.replace('export { MeshoptDecoder };', 'self.MeshoptDecoder = MeshoptDecoder;'),
);
const notices = new URL('./lake/codec-licenses.txt', import.meta.url);
await copyFile(notices, `${dest}/basis-LICENSE.txt`);
