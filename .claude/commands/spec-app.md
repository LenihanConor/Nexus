Create a new application spec.

Ask the user:
1. What is the application name?
2. What does it do, and who is it for?
3. What are its main systems (rough list is fine)?
4. Which platform shared modules or packages does it use?
5. What is explicitly out of scope?

Then:
- Create docs/specs/applications/<app-name>.md using the Application Spec template from CLAUDE.md
- Create docs/specs/systems/<app-name>/ directory
- Create docs/specs/features/<app-name>/ directory
- Register the new application in docs/specs/platform/PLATFORM.md applications table

Run the full 5-step spec process (Interview → Draft → Binding Decisions → AI Review Questions → Approval gate) as described in CLAUDE.md.
