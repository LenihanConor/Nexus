const CATEGORY_ICONS: Record<string, { icon: string; classes: string }> = {
  session: { icon: "◇", classes: "text-blue-400" },
  worktree: { icon: "◆", classes: "text-purple-400" },
  audit: { icon: "●", classes: "text-gray-400" },
};

const DEFAULT_ICON = { icon: "○", classes: "text-gray-500" };

function getCategory(eventType: string): string {
  const dot = eventType.indexOf(".");
  return dot > 0 ? eventType.slice(0, dot) : eventType;
}

export function EventTypeIcon({ eventType }: { eventType: string }) {
  const category = getCategory(eventType);
  const config = CATEGORY_ICONS[category] ?? DEFAULT_ICON;
  return <span className={config.classes}>{config.icon}</span>;
}

export function eventCategory(eventType: string): string {
  return getCategory(eventType);
}

export const EVENT_CATEGORIES = ["session", "worktree", "audit"] as const;
