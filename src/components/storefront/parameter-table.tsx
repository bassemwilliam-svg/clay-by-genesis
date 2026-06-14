import type { Prisma } from "@prisma/client";

type ParamSpec = {
  type?: string;
  min?: number;
  max?: number;
  default?: unknown;
  options?: unknown[];
};

function isParamSpec(v: unknown): v is ParamSpec {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function rangeOrOptions(spec: ParamSpec): string {
  if (Array.isArray(spec.options)) return spec.options.map(String).join(", ");
  if (typeof spec.min === "number" || typeof spec.max === "number") {
    return `${spec.min ?? "-"} – ${spec.max ?? "-"}`;
  }
  return "-";
}

// parameterManifest is untyped JSON authored in admin, so render defensively.
export function ParameterTable({ manifest }: { manifest: Prisma.JsonValue }) {
  if (!isParamSpec(manifest)) return null;
  const entries = Object.entries(manifest as Record<string, unknown>).filter(
    ([, v]) => isParamSpec(v),
  ) as [string, ParamSpec][];

  if (entries.length === 0) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Parameter</th>
            <th className="px-4 py-2.5 font-medium">Type</th>
            <th className="px-4 py-2.5 font-medium">Range / options</th>
            <th className="px-4 py-2.5 font-medium">Default</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([name, spec]) => (
            <tr key={name} className="border-t border-border">
              <td className="px-4 py-2.5 font-mono text-xs">{name}</td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {spec.type ?? "-"}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {rangeOrOptions(spec)}
              </td>
              <td className="px-4 py-2.5 text-muted-foreground">
                {spec.default != null ? String(spec.default) : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
