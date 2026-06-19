

export type ResponseToken =
  | { type: 'text'; content: string }
  | { type: 'image'; url: string; n: number }

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

    const refNum = Number(match[1] ?? match[2])
    if (!refNum) continue
    const url = imageUrls[refNum - 1]

    if (!url) continue

    if (matchStart > lastIndex) {
      tokens.push({ type: 'text', content: text.slice(lastIndex, matchStart) })
    }
    tokens.push({ type: 'image', url, n: refNum })
    lastIndex = matchEnd
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', content: text }]
}
