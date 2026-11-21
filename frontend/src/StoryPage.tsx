import { useLayoutEffect, useRef, useState, type FormEvent, type ReactNode, type Ref } from 'react'
import type { NodeOption, StoryNode } from './api.ts'
import type { Theme } from './themes.ts'

const MAX_CUSTOM = 100 // matches ChooseRequest in backend/app/schemas.py
const PASSAGE_SIZES = [18, 17, 16] // px; 16 is the floor (SPEC-3 R23), past it the passage scrolls
const INK_STEP_MS = 220 // between sentences inking in; the choices follow the last one

// The passage in sentences (keeping every character, so line breaks still show). Anything odd: one piece.
function sentences(text: string): string[] {
  const parts = text.match(/[^.!?…]*[.!?…]+["'”’)\]]*\s*|[^.!?…]+$/g) ?? [text]
  return parts.join('') === text ? parts : [text]
}

// Paper styles (SPEC-3 "The page"). Only page-* tokens on the paper (TH10).
const paperRing = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-page-accent'
const row =
  'flex min-h-14 w-full items-center gap-3 rounded-xl border-2 border-page-edge bg-white/40 py-1 pr-1 pl-4 text-left text-page-ink'
const key =
  'grid size-11 flex-none place-items-center rounded-lg border-2 border-page-edge bg-page font-story text-lg font-semibold text-page-accent transition'
// Hover or focus fills the key with page-accent (written out in full so Tailwind finds the classes).
const keyFillsWithRow =
  'group-enabled:group-hover:border-page-accent group-enabled:group-hover:bg-page-accent group-enabled:group-hover:text-page group-focus-visible:border-page-accent group-focus-visible:bg-page-accent group-focus-visible:text-page'
const keyFillsItself =
  'enabled:hover:border-page-accent enabled:hover:bg-page-accent enabled:hover:text-page focus-visible:border-page-accent focus-visible:bg-page-accent focus-visible:text-page'
const primaryButton = `min-h-11 rounded-xl bg-page-accent px-6 font-semibold text-page disabled:cursor-not-allowed disabled:opacity-50 ${paperRing}`
const secondaryButton = `min-h-11 rounded-xl border-2 border-page-edge px-5 font-semibold text-page-ink transition hover:border-page-accent disabled:cursor-not-allowed disabled:opacity-50 ${paperRing}`

type Props = {
  theme: Theme
  node: StoryNode
  busy: boolean // a choice, turn or generation is running: every control is disabled (R17)
  error: string | null
  custom: string
  onCustomChange: (text: string) => void
  onPick: (option: NodeOption) => void
  onCustom: () => void
  onStartOver: () => void
  onHome: () => void
  headingRef?: Ref<HTMLHeadingElement>
  action?: ReactNode // drawn in the action box instead of the plain text (the quill writing it)
  waitingText?: string // the blank page while Grok writes: this line instead of the passage and choices
  inkIn?: boolean // a page just written: the passage inks in sentence by sentence, then the choices fade in
}

// One page of the book, drawn from props only (no fetching): header, the action that led here, the
// passage, then the choices or the ending. It fills the fixed page height (D15).
export default function StoryPage(props: Props) {
  const { theme, node, busy, error, custom, onCustomChange, onPick, onCustom, onStartOver, onHome, headingRef } = props
  const { action, waitingText, inkIn = false } = props
  const passageRef = useRef<HTMLDivElement>(null)
  const [passageSize, setPassageSize] = useState(PASSAGE_SIZES[0])

  // R23: fit, never grow. Step the passage down 18 → 17 → 16px until it fits its box; past 16px it
  // scrolls. Runs before paint, and again whenever the box changes size (width, an error line appearing)
  // or a font finishes loading (Lora arriving late changes the text's size but not the box's, and
  // fonts.ready can resolve before Lora has even been requested).
  useLayoutEffect(() => {
    const el = passageRef.current
    if (!el) return
    let active = true
    el.scrollTop = 0 // a new page starts at the top, even if the last one was scrolled
    const fit = () => {
      if (!active) return
      let size = PASSAGE_SIZES[0]
      for (size of PASSAGE_SIZES) {
        el.style.fontSize = `${size}px`
        if (el.scrollHeight <= el.clientHeight) break
      }
      setPassageSize(size)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    void document.fonts.ready.then(fit)
    document.fonts.addEventListener('loadingdone', fit)
    return () => {
      active = false
      observer.disconnect()
      document.fonts.removeEventListener('loadingdone', fit)
    }
  }, [node.id, node.content])

  function submitCustom(e: FormEvent) {
    e.preventDefault()
    if (custom.trim() !== '' && !busy) onCustom()
  }

  const pieces = inkIn ? sentences(node.content) : [node.content]
  // The choices (or the ending) fade in after the last sentence.
  const after = inkIn ? 'animate-ink-in motion-reduce:animate-none' : ''
  const afterDelay = inkIn ? { animationDelay: `${pieces.length * INK_STEP_MS + 200}ms` } : undefined

  return (
    <div className="flex h-full flex-col gap-4 py-6 pr-5 pl-6 sm:pr-10 sm:pl-12">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-page-edge/45 pb-2">
        <p className="font-display text-2xl tracking-wide text-page-accent">{node.story_title}</p>
        <h2 ref={headingRef} tabIndex={-1} className="flex items-center gap-3 font-semibold text-page-muted focus:outline-none">
          Page {node.level} of {node.max_level}
          <span aria-hidden="true" className="flex gap-1">
            {Array.from({ length: node.max_level }, (_, i) => (
              <span key={i} className={`size-2 rounded-full ${i < node.level ? 'bg-page-accent' : 'bg-page-edge/35'}`} />
            ))}
          </span>
        </h2>
      </div>

      {/* page 1 shows the player's idea (D9) */}
      <div className="flex-none rounded-lg bg-page-shade px-4 py-2 font-story text-lg leading-[1.55] text-page-ink">
        {action ?? node.choice_text ?? node.story_idea}
      </div>

      <div
        ref={passageRef}
        style={{ fontSize: passageSize }}
        className={`min-h-0 max-w-prose flex-1 overflow-y-auto font-story leading-[1.65] whitespace-pre-line text-page-ink ${paperRing}`}
      >
        {waitingText ? (
          <p className="text-page-muted italic">{waitingText}</p>
        ) : inkIn ? (
          pieces.map((piece, i) => (
            <span
              key={i}
              className="animate-ink-in motion-reduce:animate-none"
              style={{ animationDelay: `${i * INK_STEP_MS}ms` }}
            >
              {piece}
            </span>
          ))
        ) : (
          node.content
        )}
      </div>

      {waitingText ? null : node.is_ending ? (
        <div className={`flex-none text-center ${after}`} style={afterDelay}>
          <p className="font-display text-5xl tracking-wide text-page-accent">The End</p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={onStartOver} disabled={busy} className={primaryButton}>
              Start over
            </button>
            <button type="button" onClick={onHome} disabled={busy} className={secondaryButton}>
              Home
            </button>
          </div>
        </div>
      ) : (
        // D16/D17: three rows of the same shape, text left, key right. No heading, no "taken" line.
        <ul className={`grid flex-none grid-cols-[minmax(0,1fr)] gap-2.5 ${after}`} style={afterDelay}>
          {node.options.map((option) => (
            <li key={option.slot}>
              <button
                type="button"
                onClick={() => onPick(option)}
                disabled={busy}
                className={`group ${row} transition hover:border-page-accent disabled:cursor-not-allowed ${paperRing}`}
              >
                {option.slot === 'custom' && <span className="sr-only">A player's path: </span>}
                {/* "explored" sits under the text on phones, so the text keeps the row's width */}
                <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:gap-3">
                  <span className="sm:flex-1">{option.text}</span>
                  {option.child_id !== null && (
                    <span className="text-sm font-semibold whitespace-nowrap text-page-success">explored</span>
                  )}
                </span>
                <span
                  aria-hidden="true"
                  className={`${key} ${keyFillsWithRow}`}
                >
                  {option.slot === 'custom' ? '✦' : option.slot.toUpperCase()}
                </span>
              </button>
            </li>
          ))}
          {node.can_add_custom && (
            <li>
              <form
                onSubmit={submitCustom}
                className={`${row} focus-within:border-page-accent focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-page-accent`}
              >
                <label htmlFor="custom-action" className="sr-only">
                  Or write your own action
                </label>
                <input
                  id="custom-action"
                  value={custom}
                  onChange={(e) => onCustomChange(e.target.value)}
                  maxLength={MAX_CUSTOM}
                  placeholder={theme.copy.customPlaceholder}
                  aria-describedby="custom-count"
                  autoComplete="off"
                  disabled={busy}
                  className="min-h-11 min-w-0 flex-1 bg-transparent text-base text-page-ink placeholder:text-page-muted placeholder:italic focus:outline-none"
                />
                <span id="custom-count" className="flex-none text-sm text-page-muted tabular-nums">
                  {custom.length > 0 && `${custom.length}/${MAX_CUSTOM}`}
                </span>
                <button
                  type="submit"
                  aria-label="Do it"
                  disabled={busy || custom.trim() === ''}
                  className={`${key} ${keyFillsItself} focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  ✦
                </button>
              </form>
            </li>
          )}
        </ul>
      )}

      {error && (
        <p role="alert" className="flex-none text-page-danger">
          {error}
        </p>
      )}
    </div>
  )
}
