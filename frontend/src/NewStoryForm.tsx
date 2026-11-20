import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { post, type Story } from './api.ts'
import SpookyLoader from './SpookyLoader.tsx'

const MAX_IDEA = 300 // matches StoryCreate in backend/app/schemas.py

type Props = { onOpen: (nodeId: number) => void }

export default function NewStoryForm({ onOpen }: Props) {
  const [idea, setIdea] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const blank = idea.trim() === ''

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (blank || saving) return
    setSaving(true)
    setError(null)
    try {
      const story = await post<Story>('/api/stories', { idea })
      onOpen(story.root_node_id) // this form unmounts, so no need to reset saving
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
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
      <p className="mt-2 text-muted">
        Describe an idea and the spirits will write the story, one choice at a time. Each tale lasts 5 to 10
        turns: pick one of two paths, or type your own.
      </p>

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
          placeholder="A lighthouse keeper hears knocking from beneath the waves…"
          aria-describedby={error ? 'idea-count idea-error' : 'idea-count'}
          className="mt-2 w-full resize-y rounded-xl border-2 border-field bg-bg px-4 py-3 text-base placeholder:text-muted placeholder:italic focus:border-accent focus:ring-4 focus:ring-accent/30 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <span id="idea-count" className="text-sm text-muted">
            {idea.length}/{MAX_IDEA}
          </span>
          <button
            type="submit"
            disabled={blank || saving}
            className="min-h-11 rounded-xl bg-accent px-6 font-semibold text-bg transition hover:shadow-[0_0_18px] hover:shadow-accent/50 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
          >
            Summon a tale
          </button>
        </div>
        {error && (
          <p id="idea-error" role="alert" className="mt-3 text-danger">
            {error}
          </p>
        )}
      </form>

      {saving && <SpookyLoader message="Summoning your tale…" />}
    </section>
  )
}
