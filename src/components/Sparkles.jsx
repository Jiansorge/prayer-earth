import React from 'react'

// A sprinkle of tiny twinkling stars for a page or modal. Drop it anywhere
// with a count that fits the space; it fills its nearest positioned parent.
export default function Sparkles({ count = 12, className = '' }) {
  return (
    <div className={`sparkles sparkles--local ${className}`} aria-hidden="true">
      {[...Array(count)].map((_, i) => (
        <span
          key={i}
          className={[
            'sp',
            i % 5 === 0 ? 'sp--big' : '',
            i % 4 === 0 ? 'sp--gold' : '',
            i % 3 === 0 ? 'sp--sway' : ''
          ].join(' ')}
          style={{
            '--sx': `${(i * 13 + 7) % 100}%`,
            '--sy': `${(i * 17 + 5) % 100}%`,
            '--sd': `${4 + ((i * 7) % 9)}s`,
            '--sdl': `${(i * 1.9) % 11}s`,
            '--ss': `${1 + (i % 3)}px`
          }}
        />
      ))}
    </div>
  )
}
