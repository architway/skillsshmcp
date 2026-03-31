/**
 * Raw skill object from the skills.sh search API.
 * Verified shape from: GET https://skills.sh/api/search?q=<query>
 *
 * IMPORTANT: The API does NOT return `description`, `stars`, or `updatedAt`.
 * These fields were hallucinated by research models and verified missing via live API testing.
 */
export interface RawSkillResult {
  /** Full identifier, e.g., "github/awesome-copilot/git-commit" */
  id: string;
  /** Skill slug, e.g., "git-commit" — NOTE: may NOT match actual directory name in repo */
  skillId: string;
  /** Display name, e.g., "git-commit" */
  name: string;
  /** Download/install count from skills.sh telemetry */
  installs: number;
  /** Source repo in {owner}/{repo} format, e.g., "github/awesome-copilot" */
  source: string;
}

/**
 * Full API response wrapper from skills.sh search endpoint.
 * Endpoint: GET https://skills.sh/api/search?q=<query>&limit=<n>
 */
export interface SearchAPIResponse {
  query: string;
  searchType: string; // typically "fuzzy"
  skills: RawSkillResult[];
  count: number;
  duration_ms: number;
}

/**
 * Cleaned, ranked skill returned to the AI after Module C processing.
 * Only contains the fields needed for the AI to make a selection.
 */
export interface RankedSkill {
  skillId: string;
  name: string;
  installs: number;
  source: string;
}
