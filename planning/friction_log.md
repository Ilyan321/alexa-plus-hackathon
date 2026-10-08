# Amazon Developer Tools Friction Log 📝

> **Note:** Submissions with friction logs earn up to a **10% judging bonus**. We document onboarding, SDK behaviors, documentation gaps, and developer experience feedback here.

---

### Entry Format
- **Task Attempted:** What were we trying to do?
- **Steps Taken:** How did we try to accomplish it?
- **Expected vs. Actual:** What should have happened vs. what actually occurred?
- **Severity Rating:** (Low / Medium / High / Critical)
- **Workaround:** How did we unblock ourselves?
- **Actionable Suggestion for Amazon Team:** Specific feedback or feature request.

---

### Log Entries

#### Log #001: Developer Onboarding & Environment Setup
- **Date:** October 9, 2026
- **Task Attempted:** Initializing Alexa+ MCP developer workspace and reviewing MCP spec requirements.
- **Steps Taken:** Evaluated Model Context Protocol (spec 2025-11-25+ Streamable HTTP) requirements for self-hosted Alexa+ agent endpoints.
- **Expected vs. Actual:** Expected a single unified starter template for Alexa+ self-hosted MCP servers; actual documentation requires custom boilerplate assembly for Streamable HTTP transports.
- **Severity Rating:** Medium
- **Workaround:** Structured custom MCP server architecture using lightweight Python/TypeScript streaming server.
- **Actionable Suggestion for Amazon Team:** Provide an official CLI quickstart generator (e.g. `npx create-alexa-mcp-server`) with built-in Streamable HTTP transport and test harnesses.
