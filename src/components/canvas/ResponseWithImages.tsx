import React from 'react'
import { tokenizeWithImages } from '../../lib/utils/tokenize-with-images'

interface ResponseWithImagesProps {
  text: string
  imageUrls?: string[]
}

export function ResponseWithImages({ text, imageUrls = [] }: ResponseWithImagesProps) {
  const tokens = tokenizeWithImages(text, imageUrls)
  const hasInlineImages = tokens.some((t) => t.type === 'image')

  return (
    <div>
      {!hasInlineImages && imageUrls.length > 0 && (
        <div className="space-y-2 mb-3 pb-3 border-b border-gray-200">
          {imageUrls.map((url, i) => (

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
