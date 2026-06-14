/** Money is stored as integer minor units; format for display only. */
export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

export function formatBytes(bytes: bigint | number | null): string {
  if (bytes == null) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = Number(bytes);
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }
  return `${n.toFixed(u === 0 ? 0 : 1)} ${units[u]}`;
}

/**
 * Sum-of-parts vs bundle price. Each member contributes its effective (post
 * discount) price, so the savings advertised match what the parts actually cost
 * à la carte today rather than an inflated list total. `savingsCents` floors at
 * zero so a bundle priced above its parts never shows a negative "saving".
 */
export function bundleSavings(
  members: { priceCents: number; discountCents: number | null }[],
  bundlePriceCents: number,
): { partsCents: number; savingsCents: number; savingsPct: number } {
  const partsCents = members.reduce(
    (sum, m) =>
      sum +
      (m.discountCents != null && m.discountCents < m.priceCents
        ? m.discountCents
        : m.priceCents),
    0,
  );
  const savingsCents = Math.max(0, partsCents - bundlePriceCents);
  const savingsPct =
    partsCents > 0 ? Math.round((savingsCents / partsCents) * 100) : 0;
  return { partsCents, savingsCents, savingsPct };
}

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  GAME_ASSET: "Game asset",
  ENVIRONMENT_KIT: "Environment kit",
  PROCEDURAL_TOOL: "Procedural tool",
  COURSE: "Course",
  BUNDLE: "Bundle",
};
