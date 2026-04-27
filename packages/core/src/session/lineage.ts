import type { SessionRecord, SessionLineage, SessionTreeNode } from "@nexus/shared";
import { getAllSessions, getSession } from "./store.js";

const MAX_DEPTH = 20;

export async function getLineage(sessionId: string): Promise<SessionLineage> {
  const target = await getSession(sessionId);
  if (!target) throw new Error(`Session ${sessionId} not found`);

  const allSessions = await getAllSessions();
  const byId = new Map(allSessions.map((s) => [s.id, s]));

  const pathToTarget: SessionRecord[] = [];
  let current: SessionRecord | undefined = target;
  let depth = 0;
  while (current) {
    pathToTarget.unshift(current);
    if (!current.parent_id || depth >= MAX_DEPTH) break;
    current = byId.get(current.parent_id);
    depth++;
  }

  const root = pathToTarget[0]!;

  const children = allSessions.filter((s) => s.parent_id === sessionId);

  const descendants: SessionRecord[] = [];
  const queue = [sessionId];
  while (queue.length > 0) {
    const parentId = queue.shift()!;
    for (const s of allSessions) {
      if (s.parent_id === parentId && s.id !== sessionId) {
        descendants.push(s);
        queue.push(s.id);
      }
    }
  }

  return { root, path_to_target: pathToTarget, children, descendants };
}

export async function getCorrelationGroup(
  correlationId: string,
): Promise<SessionRecord[]> {
  const allSessions = await getAllSessions();
  return allSessions
    .filter((s) => s.correlation_id === correlationId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function buildSessionTree(sessions: SessionRecord[]): SessionTreeNode | null {
  if (sessions.length === 0) return null;

  const byId = new Map(sessions.map((s) => [s.id, s]));
  const childMap = new Map<string | null, SessionRecord[]>();

  for (const s of sessions) {
    const parentId = s.parent_id;
    if (!childMap.has(parentId)) childMap.set(parentId, []);
    childMap.get(parentId)!.push(s);
  }

  const roots = sessions.filter((s) => !s.parent_id || !byId.has(s.parent_id));
  if (roots.length === 0) return null;

  function buildNode(session: SessionRecord): SessionTreeNode {
    const children = (childMap.get(session.id) ?? [])
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(buildNode);
    return { session, children };
  }

  return buildNode(roots[0]!);
}
