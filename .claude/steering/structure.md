# Codebase Structure

## Top-Level Layout

```
C:\GitHub\Nexus\
├── docs/
│   ├── specs/                    # Spec-driven development (Platform → App → System → Feature)
│   │   ├── platform/             # Platform spec (PLATFORM.md)
│   │   ├── applications/         # Application specs (nexus-core.md, nexus-dashboard.md)
│   │   ├── systems/              # System specs (one subfolder per app)
│   │   │   ├── nexus-core/       # Core systems (audit-trail, worktree-isolation, session-registry)
│   │   │   └── nexus-dashboard/  # Dashboard systems (TBD)
│   │   └── features/             # Feature specs (one subfolder per app/system)
│   │       ├── nexus-core/       # Core feature specs
│   │       └── nexus-dashboard/  # Dashboard feature specs
│   ├── research/                 # Research sessions (one subfolder per topic slug)
│   └── reference/                # Reference documentation
├── .claude/
│   ├── commands/                 # Slash commands
│   ├── skills/                   # Individual invocable skills
│   └── steering/                 # Tech and structure context (this file + tech.md)
└── CLAUDE.md                     # Primary AI guidance
```

_Application source directories will be added as implementation begins:_
```
├── packages/
│   ├── core/                     # Nexus Core — CLI and orchestration engine
│   ├── dashboard/                # Nexus Dashboard — local web UI
│   └── shared/                   # Shared types, event schema, utilities
```

## Shared vs App-Specific Code

**Shared Platform Code:**
- Location: `packages/shared/`
- Purpose: Event schema types, session data model, config loading, JSONL I/O utilities

**Application-Specific Code:**
- `packages/core/` — Nexus Core: CLI, audit trail, worktree isolation, session registry
- `packages/dashboard/` — Nexus Dashboard: local web server, UI components, data views

## Key Patterns

- **Append-only event log** — all systems emit structured events to JSONL files; the audit trail is the source of truth
- **Centralized storage** — all runtime data (events, sessions, worktree metadata) in `~/.nexus/`; Nexus is a global orchestrator across projects
- **File-based storage** — JSONL for streams (events, sessions), JSON for config; no database for v1
- **Git worktree isolation** — each concurrent agent task gets its own worktree to prevent file-level collisions
- **Monorepo with packages** — Core, Dashboard, and Shared live in one repo with clear boundaries
