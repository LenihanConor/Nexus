import type { DashboardView } from "./types.js";

const views: DashboardView[] = [];

export function registerView(view: DashboardView): void {
  const existing = views.findIndex((v) => v.id === view.id);
  if (existing >= 0) {
    views[existing] = view;
  } else {
    views.push(view);
  }
  views.sort((a, b) => a.order - b.order);
}

export function getRegisteredViews(): DashboardView[] {
  return [...views];
}
