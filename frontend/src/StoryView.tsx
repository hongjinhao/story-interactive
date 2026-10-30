import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, ApiError, post, type NodeOption, type Story, type StoryNode } from './api.ts'
import SpookyLoader from './SpookyLoader.tsx'

const MAX_CUSTOM = 100 // matches ChooseRequest in backend/app/schemas.py

const focusRing = 'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pumpkin'
const secondaryButton = `min-h-11 rounded-xl border-2 border-tomb px-5 font-semibold transition hover:border-pumpkin ${focusRing}`
const primaryButton = `min-h-11 rounded-xl bg-pumpkin px-6 font-semibold text-night transition hover:shadow-[0_0_18px] hover:shadow-pumpkin/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none ${focusRing}`

type Props = {
  nodeId: number
  onNavigate: (nodeId: number) => void
  onHome: () => void
}

export default function StoryView({ nodeId, onNavigate, onHome }: Props) {
  const [node, setNode] = useState<StoryNode | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [choosing, setChoosing] = useState(false)
  const [chooseError, setChooseError] = useState<string | null>(null)
  const [custom, setCustom] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    let ignore = false // a newer node was requested before this one arrived
    api<StoryNode>(`/api/nodes/${nodeId}`)
      .then((n) => {
        if (ignore) return
        setLoadError(null)
        setNode(n)
      })
      .catch((err: Error) => !ignore && setLoadError(err.message))
    return () => {
      ignore = true
    }
  }, [nodeId, reloadKey])

  // After every move, put focus on the new passage's heading for keyboard and screen-reader users.
  useEffect(() => {
    headingRef.current?.focus()
  }, [node?.id])

  function go(id: number) {
    setChooseError(null)
    setCustom('')
    onNavigate(id)
  }

  // An explored option already has its child: walk there with no request (R2).
  // Otherwise ask the backend, which generates the child.
  function pick(option: NodeOption) {
    if (option.child_id !== null) go(option.child_id)
    else void choose({ slot: option.slot })
  }

  async function choose(body: { slot: NodeOption['slot']; text?: string }) {
    if (!node || choosing) return
    setChoosing(true)
    setChooseError(null)
    try {
      const child = await post<StoryNode>(`/api/nodes/${node.id}/choose`, body)
      setNode(child)
      go(child.id)
    } catch (err) {
      setChooseError(err instanceof Error ? err.message : String(err))
      // 409: someone else just wrote this node's custom branch. Reload so it shows as an option.
      if (err instanceof ApiError && err.status === 409) setReloadKey((k) => k + 1)
    } finally {
      setChoosing(false)
    }
  }

  function submitCustom(e: FormEvent) {
    e.preventDefault()
    if (custom.trim() !== '') void choose({ slot: 'custom', text: custom })
  }

  async function startOver() {
    if (!node) return
    try {
      const story = await api<Story>(`/api/stories/${node.story_id}`)
      go(story.root_node_id)
    } catch (err) {
      setChooseError(err instanceof Error ? err.message : String(err))
    }
  }

  if (loadError) {
    return (
      <section className="rounded-2xl border border-crypt-edge bg-crypt p-5 sm:p-8">
        <p role="alert" className="text-blood">
          Couldn't open this part of the tale: {loadError}
        </p>
        <button type="button" onClick={onHome} className={`mt-4 ${secondaryButton}`}>
          Back to home
        </button>
      </section>
    )
  }
  if (!node) return <p className="text-center text-mist">Opening the tale…</p>

  const customOption = node.options.find((o) => o.slot === 'custom')
  const parentId = node.parent_id

  return (
    <article>
      <button type="button" onClick={onHome} className={`mb-6 ${secondaryButton}`}>
        ← Home
      </button>

      <section className="rounded-2xl border border-crypt-edge bg-crypt p-5 sm:p-8">
        <p className="font-spooky text-2xl tracking-wide text-pumpkin sm:text-3xl">{node.story_title}</p>
        <h2 ref={headingRef} tabIndex={-1} className="mt-1 flex items-center gap-3 text-mist focus:outline-none">
          Level {node.level} of {node.max_level}
          <span aria-hidden="true" className="flex gap-1">
            {Array.from({ length: node.max_level }, (_, i) => (
              <span key={i} className={`h-2 w-2 rounded-full ${i < node.level ? 'bg-pumpkin' : 'bg-crypt-edge'}`} />
            ))}
          </span>
        </h2>

        <p className="mt-5 max-w-prose font-story text-lg leading-[1.7] whitespace-pre-line">{node.content}</p>

        {node.is_ending ? (
          <div className="mt-8 text-center">
            <p className="font-spooky text-5xl tracking-wide text-pumpkin">The End</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={startOver} className={primaryButton}>
                Start over
              </button>
              <button type="button" onClick={onHome} className={secondaryButton}>
                Home
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8">
            <h3 className="font-semibold">What do you do?</h3>
            <ul className="mt-3 grid gap-3">
              {node.options.map((option) => (
                <li key={option.slot}>
                  <button
                    type="button"
                    onClick={() => pick(option)}
                    disabled={choosing}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-xl border-2 border-tomb bg-night px-4 py-3 text-left transition hover:border-pumpkin disabled:cursor-not-allowed ${focusRing}`}
                  >
                    <span aria-hidden="true" className="font-spooky text-xl text-pumpkin">
                      {option.slot === 'custom' ? '✦' : option.slot.toUpperCase()}
                    </span>
                    <span className="flex-1">{option.text}</span>
                    {option.slot === 'custom' && <span className="text-sm text-mist italic">a player's path</span>}
                    {option.child_id !== null && (
                      <span className="text-sm whitespace-nowrap text-slime">
                        <span aria-hidden="true">👣 </span>explored
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>

            {node.can_add_custom ? (
              <form onSubmit={submitCustom} className="mt-6">
                <label htmlFor="custom-action" className="block font-semibold">
                  Or write your own action
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <input
                    id="custom-action"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                    maxLength={MAX_CUSTOM}
                    placeholder="Whistle back at the raven…"
                    aria-describedby="custom-count"
                    disabled={choosing}
                    className="min-h-11 flex-1 rounded-xl border-2 border-tomb bg-night px-4 py-2 text-base placeholder:text-mist placeholder:italic focus:border-pumpkin focus:ring-4 focus:ring-pumpkin/30 focus:outline-none"
                  />
                  <button type="submit" disabled={custom.trim() === '' || choosing} className={primaryButton}>
                    Do it
                  </button>
                </div>
                <p id="custom-count" className="mt-2 text-sm text-mist">
                  {custom.length}/{MAX_CUSTOM}
                </p>
              </form>
            ) : (
              <div className="mt-6">
                <p className="font-semibold">Or write your own action</p>
                <p className="mt-2 text-mist">
                  Someone has already written their own path here
                  {customOption ? <>: “{customOption.text}”, listed above</> : null}. Each turn allows one.
                </p>
              </div>
            )}
          </div>
        )}

        {chooseError && (
          <p role="alert" className="mt-4 text-blood">
            {chooseError}
          </p>
        )}
      </section>

      {parentId !== null && (
        <button type="button" onClick={() => go(parentId)} className={`mt-6 ${secondaryButton}`}>
          ↑ Go back
        </button>
      )}

      {choosing && <SpookyLoader message="The tale unfolds…" />}
    </article>
  )
}
