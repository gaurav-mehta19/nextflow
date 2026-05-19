/**
 * Splits a Gemini response into text and image tokens.
 *
 * Matches references like:
 *   - "Image 1", "image 2", "Image #1"
 *   - "(Image 1)", "**(Image 1)**", "**Image 1**"
 *   - "(Image 1 - can be used as a carousel or multi-image post)"
 *   - "**(Image 1 — wide banner crop)**"
 *
 * Each match is mapped to `imageUrls[N-1]`. If that index doesn't exist
 * (e.g. response says "Image 5" but only 2 images were sent), the match
 * stays as plain text so we never render the wrong image.
 */

export type ResponseToken =
  | { type: 'text'; content: string }
  | { type: 'image'; url: string; n: number }

// Two alternatives, joined:
//   A. **( Image N <any non-)/non-newline desc> )**   — consumes parenthesized refs incl. descriptions
//   B. ** Image N **                                    — bare reference without parens
const IMAGE_REF_REGEX =
  /\*{0,2}\(\s*Image\s*#?\s*(\d+)[^)\n]*\)\*{0,2}|\*{0,2}Image\s*#?\s*(\d+)\*{0,2}/gi

export function tokenizeWithImages(text: string, imageUrls: string[]): ResponseToken[] {
  if (!text) return []
  if (!imageUrls || imageUrls.length === 0) {
    return [{ type: 'text', content: text }]
  }

  const tokens: ResponseToken[] = []
  let lastIndex = 0

  for (const match of text.matchAll(IMAGE_REF_REGEX)) {
    const matchStart = match.index ?? 0
    const matchEnd = matchStart + match[0].length
    // Digit is in group 1 (parenthesized variant) or group 2 (bare variant)
    const refNum = Number(match[1] ?? match[2])
    if (!refNum) continue
    const url = imageUrls[refNum - 1]

    // No valid URL for this index → leave the match as text and continue.
    if (!url) continue

    // Push any text before this match.
    if (matchStart > lastIndex) {
      tokens.push({ type: 'text', content: text.slice(lastIndex, matchStart) })
    }
    tokens.push({ type: 'image', url, n: refNum })
    lastIndex = matchEnd
  }

  // Tail text after the last match.
  if (lastIndex < text.length) {
    tokens.push({ type: 'text', content: text.slice(lastIndex) })
  }

  // If we never replaced anything, return the whole text as a single token.
  return tokens.length > 0 ? tokens : [{ type: 'text', content: text }]
}
