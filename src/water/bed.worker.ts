import { BedPainter } from './bed';
import { signedDistance } from './sdf';
import { WORLD, paintWorld } from './world';

self.onmessage = ({ data }: MessageEvent<{ div: number; counts?: number[]; gate: number }>) => {
  const painter = new BedPainter(WORLD.w, WORLD.h, data.div);
  paintWorld(painter, data.counts, data.gate);
  const { mask, flow, clampTexels } = painter.rasters();
  const sd = signedDistance(mask, painter.w, painter.h, 4, 0, clampTexels);
  for (let i = 0; i < sd.length; i++) sd[i] *= data.div;
  (self as unknown as Worker).postMessage(painter.assemble(sd, flow), [sd.buffer, flow.buffer]);
};
