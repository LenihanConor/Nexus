---
name: research-ideate
description: Run the ideate stage of a research session — generate 5–10 candidate features from explore findings
tags: [research, ideate, planning]
user_invocable: true
agent_invocable: true
---

# Research: Ideate Stage

Generate a bounded list of concrete candidate features or experiments from an existing `explore.md`.

## Usage

```
/research-ideate <topic_slug>
```

## Instructions for Claude

### 1. Resolve the Session

If no slug is provided:
- List all subfolders in `docs/research/`
- Ask: "Which research session do you want to ideate for?"

Check that `docs/research/<slug>/explore.md` exists. If it does not:
- Print: "explore.md not found for docs/research/<slug>/. Run /research-explore <slug> first."
- Stop.

If `docs/research/<slug>/ideate.md` already exists:
- Warn: "ideate.md already exists for this session. Regenerate? (yes/no)"
- Wait for confirmation before overwriting.

### 2. Read Context

Read:
- `docs/research/<slug>/explore.md`
- @.claude/steering/structure.md (to verify existing system/module landscape)

### 3. Generate Candidates

Produce 5–10 concrete candidates. For each:

- It must have a clear home in the platform's application/system hierarchy (existing or named new)
- It must be plausibly buildable given current platform constraints
- It must comply with all binding platform decisions
- Size it as S (≤1 week), M (1–3 weeks), L (1–2 months), or XL (>2 months)
- The set should span at least 3 different sizes — avoid all-small or all-large lists
- Primary value must clearly state what changes for the user or the platform

### 4. Write ideate.md

Create `docs/research/<slug>/ideate.md` using this exact structure:

```markdown
# Research: Ideate — <Topic>

**Input:** docs/research/<slug>/explore.md

## Candidates

### Candidate 1: <Name>
**Home application/system:** <e.g., MyApp / AuthSystem / new PaymentSystem>
**Size:** S / M / L / XL
**Description:** [1–2 paragraphs]
**Primary value:** [One sentence]

[Repeat for each candidate]

## Coverage Map
[Brief note on how the candidates span the design axes and scope range from explore.md]
```

### 5. Report

Print:
```
ideate.md written to docs/research/<slug>/ — <N> candidates generated.
Next step: /research-evaluate <slug>
```
