import React from 'react'
import { tokenizeWithImages } from '../../lib/utils/tokenize-with-images'

interface ResponseWithImagesProps {
  text: string
  imageUrls?: string[]
}

/**
 * Renders a Gemini response, replacing "Image N" references with the
 * actual cropped image at that position in the text. Falls back to
 * plain text when no images were provided.
 */
export function ResponseWithImages({ text, imageUrls = [] }: ResponseWithImagesProps) {
  const tokens = tokenizeWithImages(text, imageUrls)
  const hasInlineImages = tokens.some((t) => t.type === 'image')

  return (
    <div>
      {/*
        Fallback: if the response has images attached but Gemini's text didn't
        use the recognized "Image N" phrasing, render every input image as a
        block at the top so they're always visible alongside the text.
      */}
      {!hasInlineImages && imageUrls.length > 0 && (
        <div className="space-y-2 mb-3 pb-3 border-b border-gray-200">
          {imageUrls.map((url, i) => (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={i}
              src={url}
              alt={`Input ${i + 1}`}
              className="block w-full max-h-72 rounded-lg border border-gray-200 object-contain bg-white"
            />
          ))}
        </div>
      )}

      <div className="whitespace-pre-wrap break-words text-gray-700">
        {tokens.map((t, i) =>
          t.type === 'text' ? (
            <span key={i}>{t.content}</span>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={i}
              src={t.url}
              alt={`Image ${t.n}`}
              className="block my-2 w-full max-h-72 rounded-lg border border-gray-200 object-contain bg-white"
            />
          )
        )}
      </div>
    </div>
  )
}
