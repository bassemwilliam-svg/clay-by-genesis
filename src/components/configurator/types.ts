/*
 * The live-configurator parameter model.
 *
 * These parameters are a 1:1 mirror of the public interface exposed by the
 * real Houdini Digital Asset that backs this demo, * `Abdallah::construction_tank_sys::1.0` (a construction / flare-tower tank
 * system). The HDA parameter names are noted against each field so the same
 * manifest can later drive the per-asset configurator and a true headless
 * Houdini cook, only the manifest source changes.
 *
 * HDA reference interface:
 *   t3          float  "Overall_height"   range 1..100
 *   floor_num   int    "Floor Numbers"    range 1..50
 *   is_floor    toggle "Has Floors"
 *   side_rails  int    "Side Rails"       range 0..10
 *   segs        int    "Ladder Seg"       range 1..50
 *   tilt        float  "Tilt"             range 0..100
 *   tilt2       menu   "Tilt ?"           tilt | no tilt
 *   ladder_width float "Ladder Width"     range 0..1
 *   t2          vec3   "Ladder Offset"
 */
export type Finish = "concrete" | "galvanized" | "painted" | "weatheredSteel";

export type ConfiguratorParams = {
  /** HDA `t3`, overall tower height, in scene units. */
  overallHeight: number;
  /** HDA `is_floor`, whether intermediate platforms are generated. */
  hasFloors: boolean;
  /** HDA `floor_num`, number of platform levels up the tower. */
  floors: number;
  /** HDA `side_rails`, guard-rail bands on each platform's railing. */
  sideRails: number;
  /** HDA `segs`, rung count on the access ladder. */
  ladderSegs: number;
  /** HDA `tilt` / `tilt2`, ladder lean from vertical, in degrees (0 = no tilt). */
  ladderTilt: number;
  /** Surfacing, material family for the tank + steelwork. */
  finish: Finish;
  /** 0–1: rust + grime; drives surface roughness and tint. */
  weathering: number;
};

export const FINISHES: Record<
  Finish,
  { label: string; hex: string; metalness: number; roughness: number }
> = {
  concrete: { label: "Cement", hex: "#b9b2a6", metalness: 0.02, roughness: 0.92 },
  galvanized: { label: "Galvanized", hex: "#b8bcc2", metalness: 0.85, roughness: 0.38 },
  painted: { label: "Painted", hex: "#6f7d86", metalness: 0.2, roughness: 0.62 },
  weatheredSteel: { label: "Weathered", hex: "#8a5a3c", metalness: 0.4, roughness: 0.82 },
};

export const DEFAULT_PARAMS: ConfiguratorParams = {
  overallHeight: 9,
  hasFloors: true,
  floors: 8,
  sideRails: 1,
  ladderSegs: 10,
  ladderTilt: 8,
  finish: "concrete",
  weathering: 0.3,
};

export const LIMITS = {
  overallHeight: { min: 5, max: 16 },
  floors: { min: 1, max: 12 },
  sideRails: { min: 0, max: 4 },
  ladderSegs: { min: 4, max: 24 },
  ladderTilt: { min: 0, max: 20 },
  weathering: { min: 0, max: 1 },
} as const;
