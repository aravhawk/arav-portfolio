// Copy the pinned worker codecs from three. Only the lab's dedicated worker loads these files.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
const libs = 'node_modules/three/examples/jsm/libs';
const dest = 'public/scene/lake/codecs';
await mkdir(dest, { recursive: true });
for (const ext of ['js', 'wasm']) {
  await copyFile(`${libs}/basis/basis_transcoder.${ext}`, `${dest}/basis_transcoder.${ext}`);
}
const mesh = await readFile(`${libs}/meshopt_decoder.module.js`, 'utf8');
await writeFile(`${dest}/meshopt.js`, mesh.replace('export { MeshoptDecoder };', 'self.MeshoptDecoder = MeshoptDecoder;'));
await copyFile(`${libs}/basis/README.md`, `${dest}/basis-LICENSE.txt`);
