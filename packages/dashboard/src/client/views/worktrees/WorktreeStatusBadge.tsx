const STATUS_CONFIG: Record<string, { symbol: string; classes: string }> = {
  active: { symbol: "●", classes: "bg-green-900 text-green-300" },
  completed: { symbol: "◐", classes: "bg-blue-900 text-blue-300" },
  merged: { symbol: "○", classes: "bg-gray-800 text-gray-400" },
  conflict: { symbol: "✕", classes: "bg-red-900 text-red-300" },
  stale: { symbol: "◌", classes: "bg-orange-900 text-orange-300" },
  cleaned: { symbol: "—", classes: "bg-gray-800 text-gray-500" },
};

const DEFAULT_CONFIG = { symbol: "?", classes: "bg-gray-800 text-gray-400" };

export function WorktreeStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] ?? DEFAULT_CONFIG;
  return (
    <span className={`px-2 py-0.5 rounded text-xs inline-flex items-center gap-1 ${config.classes}`}>
      <span>{config.symbol}</span>
      {status}
    </span>
  );
}

export function worktreeStatusSymbol(status: string): string {
  return (STATUS_CONFIG[status] ?? DEFAULT_CONFIG).symbol;
}

export function worktreeStatusClasses(status: string): string {
  return (STATUS_CONFIG[status] ?? DEFAULT_CONFIG).classes;
}
