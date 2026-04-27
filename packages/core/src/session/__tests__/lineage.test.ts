import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setNexusDir } from "../../audit/emitter.js";
import { resetSessionStoreDirCache } from "../store.js";
import { createSession } from "../lifecycle.js";
import { getLineage, getCorrelationGroup, buildSessionTree } from "../lineage.js";

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `nexus-lineage-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
  setNexusDir(tempDir);
  resetSessionStoreDirCache();
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("getLineage", () => {
  it("returns lineage for a root session", async () => {
    const root = await createSession({
      project: "C:/GitHub/Test",
      agent_type: "claude-code",
      task_description: "Root task",
    });

    const lineage = await getLineage(root.id);
    expect(lineage.root.id).toBe(root.id);
    expect(lineage.path_to_target).toHaveLength(1);
    expect(lineage.children).toHaveLength(0);
    expect(lineage.descendants).toHaveLength(0);
  });

  it("traces ancestors and finds descendants", async () => {
    const root = await createSession({
      project: "C:/GitHub/Test",
      agent_type: "claude-code",
      task_description: "Root",
    });

    const child = await createSession({
      project: "C:/GitHub/Test",
      agent_type: "claude-code",
      task_description: "Child",
      parent_id: root.id,
    });

    const grandchild = await createSession({
      project: "C:/GitHub/Test",
      agent_type: "claude-code",
      task_description: "Grandchild",
      parent_id: child.id,
    });

    const lineage = await getLineage(child.id);
    expect(lineage.root.id).toBe(root.id);
    expect(lineage.path_to_target).toHaveLength(2);
    expect(lineage.path_to_target[0]!.id).toBe(root.id);
    expect(lineage.path_to_target[1]!.id).toBe(child.id);
    expect(lineage.children).toHaveLength(1);
    expect(lineage.children[0]!.id).toBe(grandchild.id);
    expect(lineage.descendants).toHaveLength(1);
  });

  it("throws for nonexistent session", async () => {
    await expect(getLineage("nonexistent")).rejects.toThrow("not found");
  });
});

describe("getCorrelationGroup", () => {
  it("finds all sessions in a correlation group", async () => {
    const root = await createSession({
      project: "C:/GitHub/Test",
      agent_type: "claude-code",
      task_description: "Root",
    });

    await createSession({
      project: "C:/GitHub/Test",
      agent_type: "claude-code",
      task_description: "Child 1",
      parent_id: root.id,
    });

    await createSession({
      project: "C:/GitHub/Test",
      agent_type: "aider",
      task_description: "Child 2",
      parent_id: root.id,
    });

    const group = await getCorrelationGroup(root.correlation_id);
    expect(group).toHaveLength(3);
  });
});

describe("buildSessionTree", () => {
  it("builds a tree from flat session list", async () => {
    const root = await createSession({
      project: "C:/GitHub/Test",
      agent_type: "claude-code",
      task_description: "Root",
    });

    const child1 = await createSession({
      project: "C:/GitHub/Test",
      agent_type: "claude-code",
      task_description: "Child 1",
      parent_id: root.id,
    });

    const child2 = await createSession({
      project: "C:/GitHub/Test",
      agent_type: "claude-code",
      task_description: "Child 2",
      parent_id: root.id,
    });

    const tree = buildSessionTree([root, child1, child2]);
    expect(tree).not.toBeNull();
    expect(tree!.session.id).toBe(root.id);
    expect(tree!.children).toHaveLength(2);
  });

  it("returns null for empty list", () => {
    expect(buildSessionTree([])).toBeNull();
  });
});
