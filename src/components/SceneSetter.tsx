'use client';

import { useEffect } from 'react';
import { stage, GROUNDS, type Scene } from '@/stage/stage';
import { scenes, projectScene } from '@/lib/site';

/** Tells the drop what to be on this route. `name` is a key of `scenes`, or `project:<slug>`. */
export default function SceneSetter({ name }: { name: string }) {
  useEffect(() => {
    const scene: Scene = name.startsWith('project:') ? projectScene(name.slice(8)) : ((scenes as Record<string, Scene>)[name] ?? scenes.work);
    stage.setScene(scene);
    const html = document.documentElement;
    html.dataset.ground = scene.ground;
    html.dataset.tone = GROUNDS[scene.ground].tone;
  }, [name]);
  return null;
}
