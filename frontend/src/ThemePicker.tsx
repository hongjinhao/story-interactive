import { useRef, type KeyboardEvent } from 'react'
import type { ThemeId } from './api.ts'
import { THEMES, type Theme } from './themes.ts'

type Props = { value: ThemeId; onChange: (theme: Theme) => void }

// A quiet row of theme silhouettes at the top of the home page (SPECS-2.md "Page"). It's a radio
// group: Tab reaches the selected icon, the arrow keys move and select, like native radio buttons.
export default function ThemePicker({ value, onChange }: Props) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(e: KeyboardEvent, index: number) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (step === undefined) return
    e.preventDefault()
    const next = (index + step + THEMES.length) % THEMES.length
    onChange(THEMES[next])
    buttons.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label="Story theme" className="flex justify-center gap-2">
      {THEMES.map((theme, i) => {
        const selected = theme.id === value
        const name = `${theme.label} stories`
        return (
          <button
            key={theme.id}
            ref={(el) => {
              buttons.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={name}
            title={name}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(theme)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`flex size-11 flex-col items-center justify-center rounded-xl transition focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              selected ? 'text-accent' : 'text-muted opacity-70 hover:opacity-100'
            }`}
          >
            <theme.PickerIcon className="size-6" />
            {/* the selection isn't shown by colour alone */}
            <span aria-hidden="true" className={`mt-0.5 size-1 rounded-full ${selected ? 'bg-accent' : ''}`} />
          </button>
        )
      })}
    </div>
  )
}
