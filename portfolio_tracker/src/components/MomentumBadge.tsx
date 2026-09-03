import type { Momentum } from "../types/Momentum";

const styles = {
  positive: "border-green-200 bg-green-50 text-green-700",
  neutral: "border-amber-200 bg-amber-50 text-amber-700",
  negative: "border-red-200 bg-red-50 text-red-700",
};

const dots = {
  positive: "bg-green-500",
  neutral: "bg-amber-400",
  negative: "bg-red-500",
};

export default function MomentumBadge({ momentum }: { momentum?: Momentum | null }) {
  if (!momentum) {
    return <span className="text-xs font-medium text-gray-400" title="Not enough recent price data">Unavailable</span>;
  }

  const label = momentum.status[0].toUpperCase() + momentum.status.slice(1);

  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 text-xs font-semibold ${styles[momentum.status]}`}
      title={`${momentum.explanation} Momentum score: ${momentum.score}.`}
      aria-label={`${label} momentum. ${momentum.explanation}`}
    >
      <span className={`h-2 w-2 rounded-full ${dots[momentum.status]}`} aria-hidden="true" />
      {label}
    </span>
  );
}
