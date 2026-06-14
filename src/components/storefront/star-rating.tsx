/*
 * Read-only star meter. Pure presentational (no hooks, no "use client") so it
 * renders in both server and client trees. `value` may be fractional (e.g. an
 * average of 4.3); each star fills proportionally via a clipped overlay.
 */

function Star({ fill, size }: { fill: number; size: number }) {
  // fill is 0..1 for this single star.
  const clip = Math.max(0, Math.min(1, fill));
  return (
    <span
      className="relative inline-block"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <StarGlyph size={size} className="text-border" />
      <span
        className="absolute inset-0 overflow-hidden"
        style={{ width: `${clip * 100}%` }}
      >
        <StarGlyph size={size} className="text-primary" />
      </span>
    </span>
  );
}

function StarGlyph({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 2.5l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 18.4l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95z" />
    </svg>
  );
}

export function StarRating({
  value,
  size = 16,
  className,
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${className ?? ""}`}
      role="img"
      aria-label={`${value.toFixed(1)} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} fill={value - i} size={size} />
      ))}
    </span>
  );
}
