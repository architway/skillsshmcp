import { RawSkillResult, SearchAPIResponse, RankedSkill } from './types.js';

const SEARCH_API_BASE = 'https://skills.sh/api/search';
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com';
const SEARCH_TIMEOUT_MS = 5000;
const FETCH_TIMEOUT_MS = 10000;
const RESULTS_PER_KEYWORD = 15;
const TOP_N = 3;

// ─────────────────────────────────────────────────────────
// Module A: QueryExpansionEngine
// ─────────────────────────────────────────────────────────

/**
 * Validates and sanitizes the keyword array from the AI.
 * Each keyword is URI-encoded for safe URL construction.
 */
export function expandQuery(keywords: string[]): string[] {
  if (keywords.length === 0 || keywords.length > 4) {
    throw new Error(
      'Validation Failed: Must provide an array of 1-4 search variations.'
    );
  }

  return keywords.map((kw) => encodeURIComponent(kw.trim().toLowerCase()));
}

// ─────────────────────────────────────────────────────────
// Module B: VercelAPIClient
// ─────────────────────────────────────────────────────────

/**
 * Fires parallel search requests to skills.sh API.
 * Uses Promise.allSettled() so partial failures don't kill the pipeline.
 * Each request has a 5-second timeout via AbortController.
 */
export async function fetchFromAPI(
  encodedKeywords: string[]
): Promise<RawSkillResult[][]> {
  const requests = encodedKeywords.map(async (keyword) => {
    const url = `${SEARCH_API_BASE}?q=${keyword}&limit=${RESULTS_PER_KEYWORD}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        console.error(
          `[SkillMCP] Search API returned ${response.status} for keyword: ${keyword}`
        );
        return [];
      }

      const data = (await response.json()) as SearchAPIResponse;
      return data.skills ?? [];
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.error(
          `[SkillMCP] Search timed out after ${SEARCH_TIMEOUT_MS}ms for keyword: ${keyword}`
        );
      } else {
        console.error(`[SkillMCP] Search failed for keyword "${keyword}":`, err);
      }
      return [];
    } finally {
      clearTimeout(timeout);
    }
  });

  const settled = await Promise.allSettled(requests);

  return settled
    .filter(
      (r): r is PromiseFulfilledResult<RawSkillResult[]> =>
        r.status === 'fulfilled'
    )
    .map((r) => r.value);
}

// ─────────────────────────────────────────────────────────
// Module C: RankerAndDeduplicator
// ─────────────────────────────────────────────────────────

/**
 * Merges, deduplicates, ranks, and truncates search results.
 * Dedup strategy: when multiple entries share the same skillId,
 * keep the one with the highest installs count.
 */
export function rankAndDeduplicate(
  resultSets: RawSkillResult[][]
): RankedSkill[] {
  // 1. Flatten all result arrays into one
  const allResults = resultSets.flat();

  // 2. Deduplicate by skillId — keep highest installs
  const dedupMap = new Map<string, RawSkillResult>();
  for (const skill of allResults) {
    const existing = dedupMap.get(skill.skillId);
    if (!existing || skill.installs > existing.installs) {
      dedupMap.set(skill.skillId, skill);
    }
  }

  // 3. Sort by installs descending
  const sorted = Array.from(dedupMap.values()).sort(
    (a, b) => b.installs - a.installs
  );

  // 4. Truncate to Top N
  const topN = sorted.slice(0, TOP_N);

  // 5. Map to RankedSkill shape
  return topN.map((s) => ({
    skillId: s.skillId,
    name: s.name,
    installs: s.installs,
    source: s.source,
  }));
}

// ─────────────────────────────────────────────────────────
// Orchestrator: Full Search Pipeline
// ─────────────────────────────────────────────────────────

/**
 * Complete search pipeline: validate → fetch → rank → return Top 3.
 */
export async function searchPipeline(
  keywords: string[]
): Promise<RankedSkill[]> {
  const encoded = expandQuery(keywords);
  const resultSets = await fetchFromAPI(encoded);
  return rankAndDeduplicate(resultSets);
}

// ─────────────────────────────────────────────────────────
// SKILL.md Fetcher (for Tool 2)
// ─────────────────────────────────────────────────────────

/**
 * Builds the list of candidate URLs to try for a given skill.
 * Different repos use different directory structures, so we try multiple patterns.
 *
 * Verified patterns:
 *   - github/awesome-copilot uses: skills/{skillId}/SKILL.md
 *   - vercel-labs/agent-skills uses: skills/{dirName}/SKILL.md (dirName ≠ skillId)
 *   - Some repos use root-level: {skillId}/SKILL.md
 *   - Some use .github/skills/ or .claude/skills/
 *   - Legacy repos may use 'master' branch instead of 'main'
 */
function buildCandidateURLs(source: string, skillId: string): string[] {
  const branches = ['main', 'master'];
  const pathPatterns = [
    `skills/${skillId}/SKILL.md`,
    `${skillId}/SKILL.md`,
    `.github/skills/${skillId}/SKILL.md`,
    `.claude/skills/${skillId}/SKILL.md`,
  ];

  const urls: string[] = [];

  // Primary branch first (main), then fallback (master)
  for (const branch of branches) {
    for (const path of pathPatterns) {
      urls.push(`${GITHUB_RAW_BASE}/${source}/${branch}/${path}`);
    }
  }

  return urls;
}

/**
 * Checks if a response body looks like an HTML error page rather than markdown.
 */
function isHTMLErrorPage(content: string): boolean {
  const trimmed = content.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.startsWith('<html');
}

/**
 * Fetches the SKILL.md content for a specific skill.
 * Tries multiple URL patterns via a fallback chain.
 * Returns the raw markdown text on success.
 * Throws a descriptive error on failure.
 */
export async function fetchSkillContent(
  source: string,
  skillId: string
): Promise<string> {
  const candidateURLs = buildCandidateURLs(source, skillId);

  for (const url of candidateURLs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });

      if (!response.ok) {
        // This URL didn't work, try the next one
        continue;
      }

      const content = await response.text();

      // Guard against CDNs returning 200 with an HTML error page
      if (isHTMLErrorPage(content)) {
        console.error(
          `[SkillMCP] URL returned HTML instead of markdown: ${url}`
        );
        continue;
      }

      console.error(`[SkillMCP] Successfully fetched SKILL.md from: ${url}`);
      return content;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.error(`[SkillMCP] Fetch timed out for: ${url}`);
      }
      // Network error or timeout — try next URL
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }

  // All candidates failed
  throw new Error(
    `Could not fetch SKILL.md for '${skillId}' from '${source}'. ` +
      `Tried ${candidateURLs.length} URL patterns. ` +
      `The skill may use a non-standard repository structure.`
  );
}
