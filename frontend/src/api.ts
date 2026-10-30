// The API client, the frontend's db.py. Components call api()/post() and never fetch directly.

export type Story = {
  id: number
  title: string
  idea: string
  max_level: number
  root_node_id: number
  created_at: string
}

export type NodeOption = {
  slot: 'a' | 'b' | 'custom'
  text: string
  child_id: number | null // null until someone takes this choice
}

export type StoryNode = {
  id: number
  story_id: number
  story_title: string
  parent_id: number | null
  level: number
  max_level: number
  content: string
  is_ending: boolean
  options: NodeOption[] // a, b, then custom if one exists; [] on an ending
  can_add_custom: boolean
}

export class ApiError extends Error {
  status: number // 0 when the server couldn't be reached

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type ValidationIssue = { loc: (string | number)[]; msg: string }

// FastAPI errors are {detail: "message"}, or for a 422 {detail: [{loc, msg}, ...]}.
function errorMessage(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((issue: ValidationIssue) => {
        const field = issue.loc.filter((part) => part !== 'body').join('.')
        const msg = issue.msg.replace(/^Value error, /, '')
        return field ? `${field}: ${msg}` : msg
      })
      .join('; ')
  }
  return `Something went wrong (HTTP ${status}).`
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, init)
  } catch {
    throw new ApiError(0, 'Could not reach the server. Is the backend running?')
  }
  if (res.status === 204) return undefined as T
  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, errorMessage(res.status, body))
  return body as T
}

export function post<T>(path: string, data: unknown): Promise<T> {
  return api<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}
