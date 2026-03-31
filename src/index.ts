import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { searchPipeline, fetchSkillContent } from './engine.js';

// ─────────────────────────────────────────────────────────
// Server Setup
// ─────────────────────────────────────────────────────────

const server = new McpServer({
  name: 'skillmcp',
  version: '1.0.0',
});

// ─────────────────────────────────────────────────────────
// Tool 1: search_skills_online
// ─────────────────────────────────────────────────────────

server.tool(
  'search_skills_online',
  `Search the skills.sh registry for coding skills and patterns. Provide 1-4 kebab-case search keywords as variations of what you're looking for (e.g., ["react", "react-best-practices", "react-patterns", "frontend-react"]). The server searches all variations concurrently and returns the Top 3 matching skills ranked by popularity. Use this when you need an architectural pattern, best practice, or coding skill but don't know the exact skill name.`,
  {
    keywords: z
      .array(z.string().min(1).max(100))
      .min(1)
      .max(4)
      .describe(
        'Array of 1-4 kebab-case search keyword variations for the desired skill'
      ),
  },
  async ({ keywords }) => {
    try {
      const results = await searchPipeline(keywords);

      if (results.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No skills found. Please revise your search keywords with broader kebab-case terms.',
            },
          ],
        };
      }

      // Format as readable numbered list
      const lines = results.map(
        (skill, i) =>
          `${i + 1}. ${skill.name} (${skill.installs.toLocaleString()} installs) — source: ${skill.source}`
      );

      const output = [
        `Found ${results.length} skill${results.length > 1 ? 's' : ''}:`,
        '',
        ...lines,
        '',
        'To use a skill, call fetch_skill_content with the skill name (skillId) and source from above.',
      ].join('\n');

      return {
        content: [{ type: 'text' as const, text: output }],
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown search error';
      console.error('[SkillMCP] search_skills_online error:', message);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Search failed: ${message}`,
          },
        ],
      };
    }
  }
);

// ─────────────────────────────────────────────────────────
// Tool 2: fetch_skill_content
// ─────────────────────────────────────────────────────────

server.tool(
  'fetch_skill_content',
  `Fetch the complete SKILL.md content for a specific skill. Provide the skillId and source from search_skills_online results.

CRITICAL RULES AFTER RECEIVING CONTENT:
1. Your VERY FIRST line of output to the user MUST be: 🛠️ [Active Skill: <skill-name>]
2. If you see this badge in chat history, the skill is already active — use this tool to reload if you lost context.
3. If the user says the code FAILED or wants a completely different approach, DO NOT reload this skill. Run a fresh search_skills_online and pick a DIFFERENT skill.`,
  {
    skillId: z
      .string()
      .min(1)
      .describe(
        "The skillId from search results (e.g., 'git-commit')"
      ),
    source: z
      .string()
      .min(1)
      .describe(
        "The source from search results (e.g., 'github/awesome-copilot')"
      ),
  },
  async ({ skillId, source }) => {
    try {
      const content = await fetchSkillContent(source, skillId);

      return {
        content: [{ type: 'text' as const, text: content }],
      };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown fetch error';
      console.error('[SkillMCP] fetch_skill_content error:', message);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Failed to fetch skill: ${message}`,
          },
        ],
      };
    }
  }
);

// ─────────────────────────────────────────────────────────
// Transport & Startup
// ─────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[SkillMCP] Server running on stdio transport');
