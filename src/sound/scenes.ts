/**
 * What each scene of the home page sounds like: one line a scene, beside
 * the registry it follows (src/scene/flight/scenes.ts, by `id`). A new
 * scene gets its sound here and nowhere else; tests/sound/scenes.test.ts
 * fails until it has one.
 *
 * Every number is 0 to 1 and says how much of a thing the picture shows,
 * not a gain: mapping.ts turns them into what the graph is told.
 */
export interface SceneSound {
  /** The wind over the place: 0 still air, 1 a hard blow. */
  wind: number;
  /** Snow blown along the ground in the picture: the wind's lighter, higher band. */
  drift: number;
  /** A channel of open water running past: low and close. */
  run: number;
  /** Water falling through a gap: fuller and brighter. */
  fall: number;
  /** Still open water lapping at an edge of ice. */
  lap: number;
  /** How much the ice speaks here: 0 seldom, 1 the open lake. */
  ice: number;
}

export const SOUND: Record<string, SceneSound> = {
  // The name in ice at the lake's edge: open dark water against the shore, the whole lake's ice behind.
  lake: { wind: 0.55, drift: 0.25, run: 0, fall: 0, lap: 0.55, ice: 1 },
  // The wall of slabs and the gap in it, water going through.
  infiniview: { wind: 0.5, drift: 0.35, run: 0.1, fall: 0.7, lap: 0, ice: 0.6 },
  // Open snow, one channel leaving to the right, spindrift across it.
  statement: { wind: 0.62, drift: 0.55, run: 0.4, fall: 0, lap: 0, ice: 0.3 },
  // The channel and its branches coming down a slope.
  'open-source': { wind: 0.5, drift: 0.35, run: 0.6, fall: 0, lap: 0, ice: 0.3 },
  // Three slabs standing in the channel.
  'kilo-bench': { wind: 0.48, drift: 0.3, run: 0.5, fall: 0, lap: 0, ice: 0.5 },
  // The beam across the channel.
  'agent-bridge': { wind: 0.5, drift: 0.3, run: 0.55, fall: 0, lap: 0, ice: 0.4 },
  // Round pools of still water in drifting snow.
  ollama: { wind: 0.48, drift: 0.5, run: 0, fall: 0, lap: 0.4, ice: 0.35 },
  // The channel splitting three ways.
  'cc-switch': { wind: 0.52, drift: 0.4, run: 0.6, fall: 0, lap: 0, ice: 0.3 },
  // The grid of blocks standing in a pool: the ice has the most to say after the lake.
  tensorpow: { wind: 0.5, drift: 0.25, run: 0, fall: 0, lap: 0.45, ice: 0.9 },
  // One block at a bend of the channel.
  rydar: { wind: 0.58, drift: 0.45, run: 0.48, fall: 0, lap: 0, ice: 0.35 },
  // Many small channels meeting the wide one.
  interests: { wind: 0.5, drift: 0.4, run: 0.7, fall: 0, lap: 0, ice: 0.3 },
  // The last block fallen, wide calm water behind it.
  ending: { wind: 0.47, drift: 0.2, run: 0, fall: 0, lap: 0.6, ice: 0.25 },
};

/** A scene with no line of its own yet: the wind alone. */
export const BARE: SceneSound = { wind: 0.5, drift: 0.3, run: 0, fall: 0, lap: 0, ice: 0.3 };
