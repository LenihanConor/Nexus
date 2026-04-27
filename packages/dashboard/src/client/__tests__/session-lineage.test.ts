import { describe, it, expect } from "vitest";
import type { SessionRecord, SessionTreeNode } from "@nexus/shared";

function makeSession(id: string, overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id,
    project: "C:/GitHub/Test",
    agent_type: "claude-code",
    task_description: `Task ${id}`,
    status: "running",
    parent_id: null,
    correlation_id: "corr-root",
    agent_pid: null,
    user_id: "testuser",
    created_at: "2026-04-27T10:00:00Z",
    updated_at: "2026-04-27T10:00:00Z",
    ended_at: null,
    duration_ms: null,
    exit_code: null,
    snapshots: [],
    metadata: {},
    ...overrides,
  };
}

const MAX_DEPTH = 20;

function buildSessionTree(sessions: SessionRecord[], targetId: string): {
  root: SessionTreeNode;
  pathToTarget: string[];
} | null {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const target = byId.get(targetId);
  if (!target) return null;

  let root = target;
  const pathToTarget: string[] = [target.id];
  const visited = new Set<string>([target.id]);
  while (root.parent_id && byId.has(root.parent_id) && !visited.has(root.parent_id)) {
    root = byId.get(root.parent_id)!;
    pathToTarget.unshift(root.id);
    visited.add(root.id);
  }

  const childrenMap = new Map<string, SessionRecord[]>();
  for (const s of sessions) {
    if (s.correlation_id === root.correlation_id && s.parent_id) {
      const list = childrenMap.get(s.parent_id) ?? [];
      list.push(s);
      childrenMap.set(s.parent_id, list);
    }
  }

  function buildNode(session: SessionRecord, depth: number): SessionTreeNode {
    if (depth >= MAX_DEPTH) return { session, children: [] };
    const kids = (childrenMap.get(session.id) ?? [])
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    return {
      session,
      children: kids.map((k) => buildNode(k, depth + 1)),
    };
  }

  return { root: buildNode(root, 0), pathToTarget };
}

describe("buildSessionTree", () => {
  it("returns null for unknown session", () => {
    expect(buildSessionTree([], "nonexistent")).toBeNull();
  });

  it("builds single-node tree for session with no parent or children", () => {
    const sessions = [makeSession("s1")];
    const result = buildSessionTree(sessions, "s1");
    expect(result).not.toBeNull();
    expect(result!.root.session.id).toBe("s1");
    expect(result!.root.children).toEqual([]);
    expect(result!.pathToTarget).toEqual(["s1"]);
  });

  it("builds tree with parent and children", () => {
    const sessions = [
      makeSession("root", { correlation_id: "corr-1" }),
      makeSession("child1", { parent_id: "root", correlation_id: "corr-1", created_at: "2026-04-27T10:01:00Z" }),
      makeSession("child2", { parent_id: "root", correlation_id: "corr-1", created_at: "2026-04-27T10:02:00Z" }),
    ];
    const result = buildSessionTree(sessions, "child1");
    expect(result!.root.session.id).toBe("root");
    expect(result!.root.children).toHaveLength(2);
    expect(result!.root.children[0]!.session.id).toBe("child1");
    expect(result!.root.children[1]!.session.id).toBe("child2");
    expect(result!.pathToTarget).toEqual(["root", "child1"]);
  });

  it("navigates up to root through multiple parents", () => {
    const sessions = [
      makeSession("grandparent", { correlation_id: "corr-1" }),
      makeSession("parent", { parent_id: "grandparent", correlation_id: "corr-1" }),
      makeSession("child", { parent_id: "parent", correlation_id: "corr-1" }),
    ];
    const result = buildSessionTree(sessions, "child");
    expect(result!.root.session.id).toBe("grandparent");
    expect(result!.pathToTarget).toEqual(["grandparent", "parent", "child"]);
    expect(result!.root.children).toHaveLength(1);
    expect(result!.root.children[0]!.children).toHaveLength(1);
  });

  it("sorts children by created_at", () => {
    const sessions = [
      makeSession("root", { correlation_id: "corr-1" }),
      makeSession("b", { parent_id: "root", correlation_id: "corr-1", created_at: "2026-04-27T12:00:00Z" }),
      makeSession("a", { parent_id: "root", correlation_id: "corr-1", created_at: "2026-04-27T10:00:00Z" }),
      makeSession("c", { parent_id: "root", correlation_id: "corr-1", created_at: "2026-04-27T11:00:00Z" }),
    ];
    const result = buildSessionTree(sessions, "root");
    const childIds = result!.root.children.map((c) => c.session.id);
    expect(childIds).toEqual(["a", "c", "b"]);
  });

  it("respects max depth limit", () => {
    const sessions: SessionRecord[] = [];
    for (let i = 0; i <= 25; i++) {
      sessions.push(makeSession(`s${i}`, {
        parent_id: i > 0 ? `s${i - 1}` : null,
        correlation_id: "corr-1",
        created_at: `2026-04-27T10:${String(i).padStart(2, "0")}:00Z`,
      }));
    }
    const result = buildSessionTree(sessions, "s25");
    let node = result!.root;
    let depth = 0;
    while (node.children.length > 0) {
      node = node.children[0]!;
      depth++;
    }
    expect(depth).toBeLessThanOrEqual(MAX_DEPTH);
  });

  it("only includes sessions with matching correlation_id in tree", () => {
    const sessions = [
      makeSession("root", { correlation_id: "corr-1" }),
      makeSession("child", { parent_id: "root", correlation_id: "corr-1" }),
      makeSession("unrelated", { parent_id: "root", correlation_id: "corr-other" }),
    ];
    const result = buildSessionTree(sessions, "root");
    expect(result!.root.children).toHaveLength(1);
    expect(result!.root.children[0]!.session.id).toBe("child");
  });

  it("handles circular parent references without infinite loop", () => {
    const sessions = [
      makeSession("a", { parent_id: "b", correlation_id: "corr-1" }),
      makeSession("b", { parent_id: "a", correlation_id: "corr-1" }),
    ];
    const result = buildSessionTree(sessions, "a");
    expect(result).not.toBeNull();
  });

  it("includes cross-project sessions with same correlation_id", () => {
    const sessions = [
      makeSession("root", { project: "ProjectA", correlation_id: "corr-1" }),
      makeSession("child", { parent_id: "root", project: "ProjectB", correlation_id: "corr-1" }),
    ];
    const result = buildSessionTree(sessions, "root");
    expect(result!.root.children).toHaveLength(1);
    expect(result!.root.children[0]!.session.project).toBe("ProjectB");
  });
});

describe("buildSessionTree pathToTarget", () => {
  it("path for root target is just [root]", () => {
    const sessions = [
      makeSession("root", { correlation_id: "corr-1" }),
      makeSession("child", { parent_id: "root", correlation_id: "corr-1" }),
    ];
    const result = buildSessionTree(sessions, "root");
    expect(result!.pathToTarget).toEqual(["root"]);
  });

  it("path for deeply nested target includes all ancestors", () => {
    const sessions = [
      makeSession("a", { correlation_id: "corr-1" }),
      makeSession("b", { parent_id: "a", correlation_id: "corr-1" }),
      makeSession("c", { parent_id: "b", correlation_id: "corr-1" }),
      makeSession("d", { parent_id: "c", correlation_id: "corr-1" }),
    ];
    const result = buildSessionTree(sessions, "d");
    expect(result!.pathToTarget).toEqual(["a", "b", "c", "d"]);
  });
});
