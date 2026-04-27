# Tech Standards

## Language & Runtime

**Language:** TypeScript
**Platform:** Node.js
**Build System:** TBD (likely tsc + a bundler; to be decided in app specs)

## Frameworks & Libraries

_To be decided in application specs. Expected:_
- CLI framework (e.g., Commander, oclif)
- Local web server for Dashboard (e.g., Express, Fastify)
- Frontend framework for Dashboard (e.g., React, Svelte)

## Storage

**Primary storage:** File-based (no database for v1)
- **Events/sessions:** JSONL (newline-delimited JSON), one file per logical stream
- **Configuration:** JSON files
- **Retention:** 90 days hot, then archive

## Testing

**Framework:** TBD (likely Vitest or Jest)
**Location:** TBD
**Coverage requirement:** TBD

## Code Style

**Formatter:** TBD (likely Prettier)
**Linter:** TBD (likely ESLint)
**Max line length:** TBD
**Indentation:** TBD

## Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|

_To be defined when first application code is written._

## Git Workflow

**Branch format:** `feature/<name>`, `bugfix/<description>`, `docs/<update>`
**Primary branch:** `main`
**Commit style:** Imperative mood ("Add X", "Fix Y", "Refactor Z")
