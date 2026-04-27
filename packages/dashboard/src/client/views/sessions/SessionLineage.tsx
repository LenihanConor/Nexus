import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useDashboard } from "../../hooks.js";
import { formatDuration } from "@nexus/shared";
import type { SessionRecord, SessionTreeNode } from "@nexus/shared";
import { SessionStatusBadge } from "./SessionStatusBadge.js";

const DEFAULT_DEPTH = 3;
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

export function SessionLineage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useDashboard();

  const result = useMemo(
    () => (id ? buildSessionTree(data.sessions, id) : null),
    [data.sessions, id],
  );

  if (!result) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="text-gray-400">Session not found</p>
        <Link to="/sessions" className="text-blue-400 hover:text-blue-300 text-sm">
          Back to sessions
        </Link>
      </div>
    );
  }

  const { root, pathToTarget } = result;
  const targetSession = data.sessions.find((s) => s.id === id);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => history.back()} className="text-gray-500 hover:text-gray-300 text-sm">
          &larr; Back
        </button>
        <h2 className="text-xl font-semibold text-gray-100">Session Lineage</h2>
      </div>

      {targetSession && (
        <div className="text-sm text-gray-500">
          Correlation: <span className="font-mono text-gray-400">{targetSession.correlation_id.slice(0, 12)}...</span>
          {" — "}
          {root.session.task_description}
        </div>
      )}

      <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
        <TreeNode node={root} depth={0} targetId={id!} pathToTarget={new Set(pathToTarget)} />
      </div>
    </div>
  );
}

function TreeNode({
  node,
  depth,
  targetId,
  pathToTarget,
}: {
  node: SessionTreeNode;
  depth: number;
  targetId: string;
  pathToTarget: Set<string>;
}) {
  const isTarget = node.session.id === targetId;
  const isOnPath = pathToTarget.has(node.session.id);
  const [expanded, setExpanded] = useState(depth < DEFAULT_DEPTH || isOnPath);
  const navigate = useNavigate();
  const hasChildren = node.children.length > 0;

  return (
    <div style={{ marginLeft: depth > 0 ? 24 : 0 }}>
      <div
        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm group ${
          isTarget
            ? "bg-blue-900/30 border border-blue-700"
            : "hover:bg-gray-800/50"
        }`}
        onClick={() => navigate(`/sessions/${node.session.id}`)}
      >
        {hasChildren && (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="text-gray-500 hover:text-gray-300 w-4 text-center flex-shrink-0"
          >
            {expanded ? "▾" : "▸"}
          </button>
        )}
        {!hasChildren && <span className="w-4 flex-shrink-0" />}

        <SessionStatusBadge status={node.session.status} />

        <span className={`truncate ${isTarget ? "text-white font-medium" : "text-gray-300"}`}>
          {node.session.task_description}
        </span>

        <span className="text-xs text-gray-600 ml-auto whitespace-nowrap">
          {node.session.agent_type}
          {node.session.project && (
            <> &middot; {node.session.project.split(/[/\\]/).pop()}</>
          )}
          {node.session.duration_ms != null && (
            <> &middot; {formatDuration(node.session.duration_ms)}</>
          )}
        </span>
      </div>

      {expanded && hasChildren && (
        <div className="border-l border-gray-800 ml-3">
          {node.children.map((child) => (
            <TreeNode
              key={child.session.id}
              node={child}
              depth={depth + 1}
              targetId={targetId}
              pathToTarget={pathToTarget}
            />
          ))}
        </div>
      )}
    </div>
  );
}
