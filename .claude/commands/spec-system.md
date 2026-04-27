Create a new system spec.

Ask the user:
1. Which application does this system belong to?
2. What is the system name?
3. What does it own / what is its responsibility?
4. What are its public interfaces (APIs, events, data contracts)?
5. What other systems does it depend on?

Then:
- Create docs/specs/systems/<app-name>/<system-name>.md using the System Spec template from CLAUDE.md
- Register the system in the parent application spec's systems table
- Read parent Platform and App specs and populate the Inherited Binding Decisions table
  with every Binding=Yes decision that applies to this system

Run the full 5-step spec process (Interview → Draft → Binding Decisions → AI Review Questions → Approval gate) as described in CLAUDE.md.

Plan format (when creating the plan at implementation start):
The plan file must include an ## Implementation Patterns section placed before the task
table. For each phase or major task, document the specific patterns, classes, and
conventions intended — so they can be validated against the actual implementation before
the task is marked Done.
