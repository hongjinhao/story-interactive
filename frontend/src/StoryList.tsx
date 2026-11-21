import { useEffect, useState } from 'react'
import { api, type Story } from './api.ts'
import type { Theme } from './themes.ts'

type Props = { theme: Theme; onOpen: (nodeId: number) => void }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// Previous tales in this theme's story bank, newest first (the API's order).
export default function StoryList({ theme, onOpen }: Props) {
  const [stories, setStories] = useState<Story[] | null>(null) // null = still loading
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // App remounts this list (key={theme.id}) when the theme changes, so it starts empty each time.
    let ignore = false // unmounted before this answer arrived: don't show the other bank
    api<Story[]>(`/api/stories?theme=${theme.id}`)
      .then((list) => !ignore && setStories(list))
      .catch((err: Error) => !ignore && setError(err.message))
    return () => {
      ignore = true
    }
  }, [theme.id])

  return (
    <section aria-labelledby="tales-heading" className="mt-12">
      <h2 id="tales-heading" className="font-display text-3xl tracking-wide text-accent">
        {theme.copy.listHeading}
      </h2>

      {error && (
        <p role="alert" className="mt-4 text-danger">
          Couldn't load past tales: {error}
        </p>
      )}
      {!error && stories === null && <p className="mt-4 text-muted">{theme.copy.listLoading}</p>}
      {stories?.length === 0 && (
        <p className="mt-4 text-muted italic">{theme.copy.emptyList}</p>
      )}

      {stories && stories.length > 0 && (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {stories.map((story) => (
            <li key={story.id}>
              <button
                type="button"
                onClick={() => onOpen(story.root_node_id)}
                className="group h-full w-full rounded-2xl border border-edge bg-surface p-5 text-left transition hover:border-accent hover:shadow-[0_0_18px] hover:shadow-accent/30 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="block font-story text-lg font-semibold group-hover:text-accent">
                  {story.title}
                </span>
                <span className="mt-1 line-clamp-2 block text-muted">{story.idea}</span>
                <span className="mt-3 block text-sm text-muted">
                  {formatDate(story.created_at)} · {story.max_level} levels
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
