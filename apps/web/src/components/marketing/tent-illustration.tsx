/**
 * Procedural isometric tent drawn as SVG (original illustration). Used on the
 * marketing site; the real app uses the three.js viewer.
 */
type Props = {
  modules: number;
  /** number of bays (from the front) whose visible side wall is transparent */
  transparentBays?: number;
  /** bays without roof, counted from the back */
  openRoofBays?: number;
  width?: number;
  className?: string;
  title?: string;
  showHuman?: boolean;
  /** keep the framing of a tent this long, so the drawing does not rescale while modules change */
  frameModules?: number;
  /** outlines one element in the brand colour (used by the animated demo) */
  highlight?: { type: "side"; bay: number } | { type: "roof"; bay: number } | null;
  /** extra SVG drawn on top; receives the projection (x along length, y up, z across) */
  overlay?: (project: (x: number, y: number, z: number) => [number, number]) => React.ReactNode;
};

const C = Math.cos(Math.PI / 6);
const S = Math.sin(Math.PI / 6);

export function TentIllustration({ modules, transparentBays = 0, openRoofBays = 0, width = 15, className, title = "Carpa en perspectiva", showHuman = true, frameModules, highlight, overlay }: Props) {
  const m = 5;
  const L = modules * m;
  const hw = width / 2;
  const eave = 3;
  const ridge = 5.4;
  const k = 9; // px per metre
  // iso projection: x = length axis, z = width axis, y = up
  const P = (x: number, y: number, z: number): [number, number] => [(x - z) * C * k, (x + z) * S * k - y * k];
  const pts = (arr: [number, number, number][]) => arr.map((p) => P(...p).map((v) => v.toFixed(1)).join(",")).join(" ");

  const profile: [number, number][] = [
    [-hw, eave],
    [0, ridge],
    [hw, eave],
  ];

  const minX = P(0, ridge, hw)[0] - 20;
  const FL = Math.max(L, (frameModules ?? modules) * m);
  const maxX = P(FL + 3, ridge, -hw)[0] + 20;
  const minY = P(0, ridge + 1.5, -hw)[1] - 10;
  const maxY = P(FL + 2, 0, hw + 2)[1] + 12;

  const bays = Array.from({ length: modules }, (_, i) => i);
  return (
    <svg viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} className={className} role="img" aria-label={title}>
      <title>{title}</title>
      {/* ground shadow */}
      <polygon points={pts([[-1, 0, -hw - 1], [L + 1, 0, -hw - 1], [L + 1, 0, hw + 1], [-1, 0, hw + 1]])} fill="currentColor" opacity="0.06" />
      {/* back wall (right side, z = -hw) */}
      {bays.map((i) => (
        <polygon key={`b${i}`} points={pts([[i * m, 0, -hw], [(i + 1) * m, 0, -hw], [(i + 1) * m, eave, -hw], [i * m, eave, -hw]])} fill="#f1f1ef" stroke="#cfcfcb" strokeWidth="0.6" />
      ))}
      {/* roof panels: back slope first, then front slope */}
      {bays.map((i) =>
        i >= modules - openRoofBays
          ? null
          : profile.slice(0, -1).map((p, s) => {
              const q = profile[s + 1]!;
              const light = s < 2 ? "#f3f3f1" : "#e2e2de";
              return (
                <polygon
                  key={`r${i}-${s}`}
                  points={pts([[i * m, p[1], p[0]], [(i + 1) * m, p[1], p[0]], [(i + 1) * m, q[1], q[0]], [i * m, q[1], q[0]]])}
                  fill={light}
                  stroke="#c9c9c5"
                  strokeWidth="0.6"
                  style={{ transition: "opacity .4s" }}
                />
              );
            }),
      )}
      {/* porticos */}
      {Array.from({ length: modules + 1 }, (_, i) => (
        <g key={`p${i}`} stroke="#3a3a38" strokeWidth="1.3" fill="none" strokeLinecap="round">
          <polyline points={pts([[i * m, 0, -hw], ...profile.map(([z, y]) => [i * m, y, z] as [number, number, number]), [i * m, 0, hw]])} />
        </g>
      ))}
      {/* front-left wall (z = +hw), facing the viewer */}
      {bays.map((i) => {
        const transparent = i < transparentBays;
        return (
          <g key={`f${i}`}>
            <polygon
              points={pts([[i * m, 0, hw], [(i + 1) * m, 0, hw], [(i + 1) * m, eave, hw], [i * m, eave, hw]])}
              fill={transparent ? "#bfe3f5" : "#ffffff"}
              fillOpacity={transparent ? 0.35 : 0.96}
              stroke={transparent ? "#7cb8d6" : "#c9c9c5"}
              strokeWidth="0.6"
              style={{ transition: "fill .5s, fill-opacity .5s" }}
            />
            {transparent && <polyline points={pts([[i * m + 0.6, 0.6, hw], [(i + 1) * m - 0.6, eave - 0.4, hw]])} stroke="#ffffff" strokeWidth="1" opacity="0.8" />}
          </g>
        );
      })}
      {/* visible end gable (x = L faces the viewer) */}
      <polygon points={pts(profile.map(([z, y]) => [L, y, z] as [number, number, number]))} fill="#fafaf9" stroke="#c9c9c5" strokeWidth="0.6" />
      <polygon points={pts([[L, 0, -hw], [L, 0, hw], [L, eave, hw], [L, eave, -hw]])} fill="#ffffff" stroke="#c9c9c5" strokeWidth="0.6" opacity="0.9" />
      {/* front pillars */}
      {Array.from({ length: modules + 1 }, (_, i) => (
        <line key={`c${i}`} x1={P(i * m, 0, hw)[0]} y1={P(i * m, 0, hw)[1]} x2={P(i * m, eave, hw)[0]} y2={P(i * m, eave, hw)[1]} stroke="#3a3a38" strokeWidth="1.4" />
      ))}
      {/* weights */}
      {Array.from({ length: modules + 1 }, (_, i) => {
        const [x, y] = P(i * m + 0.2, 0, hw + 0.7);
        return <rect key={`w${i}`} x={x - 4} y={y - 6} width="8" height="6" rx="1" fill="#9a9a95" />;
      })}
      {highlight?.type === "side" && highlight.bay < modules && (
        <polygon
          points={pts([[highlight.bay * m, 0, hw], [(highlight.bay + 1) * m, 0, hw], [(highlight.bay + 1) * m, eave, hw], [highlight.bay * m, eave, hw]])}
          fill="#f95f40"
          fillOpacity="0.12"
          stroke="#f95f40"
          strokeWidth="1.6"
        />
      )}
      {highlight?.type === "roof" && highlight.bay < modules && (
        <polygon
          points={pts([[highlight.bay * m, ridge, 0], [(highlight.bay + 1) * m, ridge, 0], [(highlight.bay + 1) * m, eave, hw], [highlight.bay * m, eave, hw]])}
          fill="#f95f40"
          fillOpacity="0.12"
          stroke="#f95f40"
          strokeWidth="1.6"
        />
      )}
      {/* human for scale */}
      {showHuman && (() => {
        const [x, y] = P(L + 2, 0, hw + 1.5);
        return (
          <g fill="#f95f40" aria-hidden>
            <circle cx={x} cy={y - 15.5} r="2.2" />
            <rect x={x - 2.2} y={y - 13} width="4.4" height="13" rx="2" />
          </g>
        );
      })()}
      {overlay?.(P)}
    </svg>
  );
}
