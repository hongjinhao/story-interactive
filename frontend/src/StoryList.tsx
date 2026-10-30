import { useEffect, useState } from 'react'
import { api, type Story } from './api.ts'

type Props = { onOpen: (nodeId: number) => void }

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

// Previous tales, newest first (the API's order).
export default function StoryList({ onOpen }: Props) {
  const [stories, setStories] = useState<Story[] | null>(null) // null = still loading
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api<Story[]>('/api/stories')
      .then(setStories)
      .catch((err: Error) => setError(err.message))
  }, [])

  return (
    <section aria-labelledby="tales-heading" className="mt-12">
      <h2 id="tales-heading" className="font-spooky text-3xl tracking-wide text-pumpkin">
        Tales already told
      </h2>

      {error && (
        <p role="alert" className="mt-4 text-blood">
          Couldn't load past tales: {error}
        </p>
      )}
      {!error && stories === null && <p className="mt-4 text-mist">Gathering the tales…</p>}
      {stories?.length === 0 && (
        <p className="mt-4 text-mist italic">No tales haunt this place yet… summon the first one above.</p>
      )}

      {stories && stories.length > 0 && (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {stories.map((story) => (
            <li key={story.id}>
              <button
                type="button"
                onClick={() => onOpen(story.root_node_id)}
                className="group h-full w-full rounded-2xl border border-crypt-edge bg-crypt p-5 text-left transition hover:border-pumpkin hover:shadow-[0_0_18px] hover:shadow-pumpkin/30 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pumpkin"
              >
                <span className="block font-story text-lg font-semibold group-hover:text-pumpkin">
                  {story.title}
                </span>
                <span className="mt-1 line-clamp-2 block text-mist">{story.idea}</span>
                <span className="mt-3 block text-sm text-mist">
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
