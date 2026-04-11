# SkillMCP

**JIT skill injection for AI coding agents.**

SkillMCP is an MCP server that connects your AI coding agent to the [skills.sh](https://skills.sh) registry. Instead of bloating your system prompt with dozens of pre-installed skills, SkillMCP lets the AI search for and inject only the skill it needs, exactly when it needs it — directly into the conversation.

Zero databases. Zero local storage. Just the right skill, at the right time.

## Why

The current workflow for AI coding skills is broken:

1. **Search friction** — You lose 10-15 minutes browsing skills.sh, evaluating options, copy-pasting markdown
2. **Context bloat** — Pre-installing many skills wastes your agent's context window on instructions it may never use
3. **Stale context** — Downloaded skills become outdated the moment the source repo updates

SkillMCP fixes all three. The AI searches, selects, and injects skills on demand — always fresh from source, never pre-loaded.

## Tools

| Tool | Description |
|---|---|
| `search_skills_online` | Search the skills.sh registry with 1-4 keyword variations. Returns Top 3 results ranked by popularity. |
| `fetch_skill_content` | Fetch the full `SKILL.md` content for a specific skill. Injects it directly into the conversation. |

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)

### Install

```bash
git clone https://github.com/architway/SkillMCP.git
cd SkillMCP
npm install
```

### Add to your AI agent

Pick your agent and add the config below.

#### Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "skillmcp": {
      "command": "npx",
      "args": ["-y", "tsx", "src/index.ts"],
      "cwd": "/absolute/path/to/SkillMCP"
    }
  }
}
```

#### Gemini CLI

Add to `.gemini/settings.json` in your project root:

```json
{
  "mcpServers": {
    "skillmcp": {
      "command": "npx",
      "args": ["-y", "tsx", "src/index.ts"],
      "cwd": "/absolute/path/to/SkillMCP"
    }
  }
}
```

#### Cursor / Windsurf

Add to `.cursor/mcp.json` or `.windsurf/mcp.json`:

```json
{
  "mcpServers": {
    "skillmcp": {
      "command": "npx",
      "args": ["-y", "tsx", "src/index.ts"],
      "cwd": "/absolute/path/to/SkillMCP"
    }
  }
}
```

#### VS Code (Copilot)

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "skillmcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "tsx", "src/index.ts"],
      "cwd": "/absolute/path/to/SkillMCP"
    }
  }
}
```

> **Note:** Replace `/absolute/path/to/SkillMCP` with the actual path where you cloned the repo.

## How It Works

```
You: "Search for React best practices"

  ┌─────────────────────────────────────────────────┐
  │ AI calls search_skills_online(["react",         │
  │   "react-best-practices", "react-patterns"])    │
  │                                                 │
  │   Module A: Validate & encode keywords          │
  │   Module B: Concurrent GET to skills.sh API     │
  │   Module C: Deduplicate → Rank → Top 3          │
  └─────────────────────────────────────────────────┘

AI: "Found 3 skills:
  1. react-best-practices (257,099 installs)
  2. react-native-skills (73,856 installs)
  3. react:components (24,838 installs)"

You: "Use the top one"

  ┌─────────────────────────────────────────────────┐
  │ AI calls fetch_skill_content(                   │
  │   "react-best-practices",                       │
  │   "vercel-labs/agent-skills")                   │
  │                                                 │
  │   Fetches raw SKILL.md from GitHub              │
  │   Tries multiple URL patterns (fallback chain)  │
  │   Injects full content into conversation        │
  └─────────────────────────────────────────────────┘

AI: "🛠️ [Active Skill: react-best-practices]
     Now applying the patterns from this skill..."
```

### The Tattoo System

SkillMCP uses zero databases for state management. Instead, it uses the chat transcript itself:

- When a skill is injected, the AI prints a badge: `🛠️ [Active Skill: <name>]`
- If the AI loses context, it sees the badge in chat history and knows which skill to reload
- If the approach fails, the AI skips that skill and searches for a different one

No SQLite. No JSON stores. Just the conversation as state.

## Architecture

Three modules built with TypeScript over stdio using the [MCP SDK](https://www.npmjs.com/package/@modelcontextprotocol/sdk):

**Module A** — `QueryExpansionEngine` — Validates and encodes 1-4 search keywords from the AI.

**Module B** — `VercelAPIClient` — Fires concurrent requests to `skills.sh/api/search` with 5-second timeouts. Uses `Promise.allSettled()` so partial failures don't kill the pipeline.

**Module C** — `RankerAndDeduplicator` — Merges results from all keywords, deduplicates by `skillId` (keeps highest installs), sorts by popularity, returns Top 3.

**SKILL.md Fetcher** — Resolves the raw GitHub URL for a skill's `SKILL.md` file. Tries multiple path patterns across `main` and `master` branches because different repos use different directory structures.

## Verified API Shape

The `skills.sh` search API returns this structure per skill (verified via live testing):

```json
{
  "id": "github/awesome-copilot/git-commit",
  "skillId": "git-commit",
  "name": "git-commit",
  "installs": 18722,
  "source": "github/awesome-copilot"
}
```

> **Note:** The API does not return `description`, `stars`, or `updatedAt`.

## License

MIT
