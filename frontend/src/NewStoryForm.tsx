import { useState, type FormEvent, type KeyboardEvent } from 'react'
import type { Theme } from './themes.ts'

const MAX_IDEA = 300 // matches StoryCreate in backend/app/schemas.py

type Props = {
  theme: Theme
  initialIdea: string // the idea back from a failed create (SPEC-3 R19), or ''
  onStart: (idea: string) => void // the book screen creates the story (D13)
}

// Collects the idea only. Submitting hands it to the book, which writes it on the cover while the story
// is created.
export default function NewStoryForm({ theme, initialIdea, onStart }: Props) {
  const [idea, setIdea] = useState(initialIdea)

  const blank = idea.trim() === ''

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!blank) onStart(idea.trim())
  }

  // Enter summons the tale; Shift+Enter still adds a line break.
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      e.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <section className="rounded-2xl border border-edge bg-surface p-5 sm:p-8">
      <h2 className="font-display text-3xl tracking-wide text-accent">Begin a new tale</h2>
      <p className="mt-2 text-muted">{theme.copy.intro}</p>

      <form onSubmit={submit} className="mt-6">
        <label htmlFor="idea" className="block font-semibold">
          Your story idea
        </label>
        <textarea
          id="idea"
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX_IDEA}
          rows={3}
          placeholder={theme.copy.ideaPlaceholder}
          aria-describedby="idea-count"
          // back from a failed create: straight into the box to change the idea or try again
          autoFocus={initialIdea !== ''}
          className="mt-2 w-full resize-y rounded-xl border-2 border-field bg-bg px-4 py-3 text-base placeholder:text-muted placeholder:italic focus:border-accent focus:ring-4 focus:ring-accent/30 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span id="idea-count" className="text-sm text-muted">
            {idea.length}/{MAX_IDEA}
          </span>
          <button
            type="submit"
            disabled={blank}
            className="min-h-11 rounded-xl bg-accent px-6 font-semibold text-bg transition hover:shadow-[0_0_18px] hover:shadow-accent/50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
          >
            {theme.copy.createButton}
          </button>
        </div>
      </form>
    </section>
  )
}
