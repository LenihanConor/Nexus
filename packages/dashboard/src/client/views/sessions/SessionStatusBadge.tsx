const STATUS_CONFIG: Record<string, { symbol: string; classes: string }> = {
  running: { symbol: "●", classes: "bg-green-900 text-green-300" },
  paused: { symbol: "◐", classes: "bg-yellow-900 text-yellow-300" },
  completed: { symbol: "○", classes: "bg-gray-800 text-gray-400" },
  failed: { symbol: "✕", classes: "bg-red-900 text-red-300" },
  interrupted: { symbol: "⚠", classes: "bg-orange-900 text-orange-300" },
  stale: { symbol: "◌", classes: "bg-orange-900 text-orange-300" },
};

export function SessionStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? { symbol: "?", classes: "bg-gray-800 text-gray-400" };
  return (
    <span className={`px-2 py-0.5 rounded text-xs inline-flex items-center gap-1 ${config.classes}`}>
      <span>{config.symbol}</span>
      {status}
    </span>
  );
}

export function statusColor(status: string): string {
  return STATUS_CONFIG[status]?.classes ?? "bg-gray-800 text-gray-400";
}

export function statusSymbol(status: string): string {
  return STATUS_CONFIG[status]?.symbol ?? "?";
}
