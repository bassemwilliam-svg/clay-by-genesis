import { makeRng, r2, type Rng } from "@/lib/schematic";

/*
 * SchematicArt, the signature generative cover. A deterministic technical
 * "drawing" derived from a seed string (product slug), branched by product
 * type so each family reads differently: hard-surface wireframe for assets,
 * terrain contours for kits, a node graph for tools, an orbit for courses,
 * stacked frames for bundles. Pure SVG, server-rendered, static/ISR-safe.
 *
 * This is what makes the store look like an engineering catalog, not a shop.
 */

const W = 320;
const H = 240;

// Theme-driven so the generative covers track the cyan accent + dark mode.
const LINE = "var(--primary)";
const FAINT = "rgba(34,211,238,0.38)";
const INK = "rgba(100,116,139,0.42)";
const NODE_FILL = "var(--card)";

function ngon(cx: number, cy: number, rad: number, n: number, rot: number): string {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i * Math.PI * 2) / n;
    pts.push(`${r2(cx + rad * Math.cos(a))},${r2(cy + rad * Math.sin(a))}`);
  }
  return pts.join(" ");
}

type El = { key: string; node: React.ReactNode };

function hardSurface(rng: Rng): El[] {
  const cx = W / 2;
  const cy = H / 2;
  const sides = rng.pick([6, 8, 5]);
  const rings = rng.int(3, 4);
  const rot = rng.range(0, Math.PI);
  const els: El[] = [];
  // Bounding box.
  els.push({
    key: "box",
    node: (
      <rect
        x={40}
        y={28}
        width={W - 80}
        height={H - 56}
        fill="none"
        stroke={FAINT}
        strokeWidth={1}
        strokeDasharray="4 5"
      />
    ),
  });
  // Concentric rotated polygons.
  for (let i = 0; i < rings; i++) {
    const rad = 30 + i * rng.range(18, 26);
    els.push({
      key: `poly-${i}`,
      node: (
        <polygon
          points={ngon(cx, cy, rad, sides, rot + i * 0.18)}
          fill="none"
          stroke={i === rings - 1 ? LINE : FAINT}
          strokeWidth={i === rings - 1 ? 1.5 : 1}
        />
      ),
    });
  }
  // Radial spokes to the outer vertices.
  const outer = 30 + (rings - 1) * 22;
  for (let i = 0; i < sides; i++) {
    const a = rot + (rings - 1) * 0.18 + (i * Math.PI * 2) / sides;
    els.push({
      key: `spoke-${i}`,
      node: (
        <line
          x1={cx}
          y1={cy}
          x2={r2(cx + outer * Math.cos(a))}
          y2={r2(cy + outer * Math.sin(a))}
          stroke={INK}
          strokeWidth={0.75}
        />
      ),
    });
  }
  els.push({
    key: "core",
    node: <circle cx={cx} cy={cy} r={2.5} fill={LINE} />,
  });
  return els;
}

function contours(rng: Rng): El[] {
  const els: El[] = [];
  const lines = rng.int(6, 8);
  const phase = rng.range(0, Math.PI * 2);
  const amp = rng.range(10, 18);
  // Module gridlines (vertical).
  const cols = rng.int(5, 7);
  for (let c = 1; c < cols; c++) {
    const x = (W / cols) * c;
    els.push({
      key: `col-${c}`,
      node: <line x1={x} y1={20} x2={x} y2={H - 20} stroke={FAINT} strokeWidth={0.75} strokeDasharray="2 6" />,
    });
  }
  // Stacked contour polylines.
  for (let i = 0; i < lines; i++) {
    const baseY = 40 + (i * (H - 80)) / (lines - 1);
    const a = amp * (1 - i / (lines * 1.5));
    const pts: string[] = [];
    for (let x = 10; x <= W - 10; x += 12) {
      const y = baseY + Math.sin(x * 0.045 + phase + i * 0.6) * a;
      pts.push(`${r2(x)},${r2(y)}`);
    }
    els.push({
      key: `contour-${i}`,
      node: <polyline points={pts.join(" ")} fill="none" stroke={i % 3 === 0 ? LINE : FAINT} strokeWidth={i % 3 === 0 ? 1.4 : 1} />,
    });
  }
  // A couple of elevation crosshairs.
  for (let i = 0; i < 2; i++) {
    const x = rng.range(60, W - 60);
    const y = rng.range(50, H - 50);
    els.push({
      key: `xh-${i}`,
      node: (
        <g stroke={INK} strokeWidth={0.75}>
          <line x1={x - 5} y1={y} x2={x + 5} y2={y} />
          <line x1={x} y1={y - 5} x2={x} y2={y + 5} />
        </g>
      ),
    });
  }
  return els;
}

function nodeGraph(rng: Rng): El[] {
  const els: El[] = [];
  const cols = rng.int(3, 4);
  const rows = rng.int(2, 3);
  const nodes: { x: number; y: number }[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      if (rng.next() < 0.22) continue; // sparse network
      nodes.push({
        x: r2(50 + (c * (W - 100)) / (cols - 1) + rng.range(-10, 10)),
        y: r2(50 + (r * (H - 100)) / (rows - 1) + rng.range(-8, 8)),
      });
    }
  }
  // Edges: connect each node forward to a later node.
  for (let i = 0; i < nodes.length - 1; i++) {
    const t = Math.min(nodes.length - 1, i + rng.int(1, 2));
    const a = nodes[i];
    const b = nodes[t];
    const midX = r2((a.x + b.x) / 2);
    els.push({
      key: `edge-${i}`,
      node: <path d={`M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`} fill="none" stroke={FAINT} strokeWidth={1} />,
    });
  }
  // Nodes as small ported squares.
  nodes.forEach((n, i) => {
    els.push({
      key: `node-${i}`,
      node: (
        <g>
          <rect x={n.x - 9} y={n.y - 6} width={18} height={12} fill={NODE_FILL} stroke={LINE} strokeWidth={1.2} />
          <circle cx={n.x - 9} cy={n.y} r={1.6} fill={LINE} />
          <circle cx={n.x + 9} cy={n.y} r={1.6} fill={INK} />
        </g>
      ),
    });
  });
  return els;
}

function orbit(rng: Rng): El[] {
  const els: El[] = [];
  const cx = W / 2;
  const cy = H / 2;
  const rings = rng.int(3, 4);
  for (let i = 0; i < rings; i++) {
    const rad = 26 + i * rng.range(22, 30);
    els.push({
      key: `ring-${i}`,
      node: <circle cx={cx} cy={cy} r={r2(rad)} fill="none" stroke={i === 0 ? LINE : FAINT} strokeWidth={i === 0 ? 1.4 : 1} strokeDasharray={i === 0 ? undefined : "3 6"} />,
    });
    // Chapter nodes along the ring.
    const count = rng.int(2, 4);
    const off = rng.range(0, Math.PI * 2);
    for (let j = 0; j < count; j++) {
      const a = off + (j * Math.PI * 2) / count;
      els.push({
        key: `chap-${i}-${j}`,
        node: <circle cx={r2(cx + rad * Math.cos(a))} cy={r2(cy + rad * Math.sin(a))} r={3} fill={NODE_FILL} stroke={LINE} strokeWidth={1.4} />,
      });
    }
  }
  els.push({ key: "hub", node: <circle cx={cx} cy={cy} r={4} fill={LINE} /> });
  return els;
}

function stackedFrames(rng: Rng): El[] {
  const els: El[] = [];
  const count = rng.int(3, 4);
  for (let i = 0; i < count; i++) {
    const off = i * rng.range(12, 18);
    const x = 56 + off;
    const y = 40 + off;
    els.push({
      key: `frame-${i}`,
      node: (
        <rect
          x={x}
          y={y}
          width={W - 112 - off * 0.4}
          height={H - 80 - off * 0.4}
          fill={NODE_FILL}
          stroke={i === count - 1 ? LINE : FAINT}
          strokeWidth={i === count - 1 ? 1.5 : 1}
        />
      ),
    });
  }
  // Aggregate "+" marker.
  els.push({
    key: "plus",
    node: (
      <g stroke={LINE} strokeWidth={1.5}>
        <line x1={W - 56} y1={48} x2={W - 56} y2={64} />
        <line x1={W - 64} y1={56} x2={W - 48} y2={56} />
      </g>
    ),
  });
  return els;
}

function generate(type: string, rng: Rng): El[] {
  switch (type) {
    case "ENVIRONMENT_KIT":
      return contours(rng);
    case "PROCEDURAL_TOOL":
      return nodeGraph(rng);
    case "COURSE":
      return orbit(rng);
    case "BUNDLE":
      return stackedFrames(rng);
    case "GAME_ASSET":
    default:
      return hardSurface(rng);
  }
}

export function SchematicArt({
  seed,
  type,
  className,
}: {
  seed: string;
  type: string;
  className?: string;
}) {
  const rng = makeRng(`${type}:${seed}`);
  const els = generate(type, rng);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className={className}
      aria-hidden="true"
      role="presentation"
    >
      <g vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round">
        {els.map((e) => (
          <g key={e.key}>{e.node}</g>
        ))}
      </g>
    </svg>
  );
}
