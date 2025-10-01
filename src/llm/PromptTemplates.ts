/**
 * Prompt Templates
 *
 * Reusable prompt templates for LLM operations.
 */

/**
 * Build prompt for query enhancement
 */
export function buildEnhanceQueryPrompt(query: string): string {
  return `You are a search query expert. Analyze and enhance this search query.

Original query: "${query}"

Provide:
1. Enhanced query (expanded with relevant terms)
2. 3 alternative query suggestions
3. User's likely search intent
4. Confidence score (0-1)

Format response as JSON:
{
  "enhancedQuery": "...",
  "suggestions": ["...", "...", "..."],
  "intent": "...",
  "confidence": 0.85
}`;
}

/**
 * Build prompt for result summarization
 */
export function buildSummarizeResultsPrompt(results: any[]): string {
  const resultsText = results
    .map((r, i) => {
      const title = r.title || 'Untitled';
      const content = r.content ? r.content.substring(0, 200) : 'No content';
      return `${i + 1}. ${title}: ${content}...`;
    })
    .join('\n\n');

  return `You are a search result summarizer. Analyze these search results and provide a concise summary.

Search Results:
${resultsText}

Provide:
1. Executive summary (2-3 sentences)
2. Key points (3-5 bullet points)
3. Main themes
4. Confidence score (0-1)

Format response as JSON:
{
  "summary": "...",
  "keyPoints": ["...", "...", "..."],
  "themes": ["...", "..."],
  "confidence": 0.9
}`;
}

/**
 * Validate prompt length
 */
export function validatePromptLength(prompt: string, maxLength: number = 4000): boolean {
  return prompt.length <= maxLength;
}
