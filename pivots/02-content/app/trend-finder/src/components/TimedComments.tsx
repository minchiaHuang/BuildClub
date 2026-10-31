import { useCallback, useEffect, useState } from 'react'
import type { MutableRefObject } from 'react'
import { MAX_COMMENT_LENGTH, addComment, formatAt, listComments, parseAt, sortByTime } from '../lib/comments.ts'
import type { Comment } from '../lib/comments.ts'
import { LinkClosed } from '../lib/share.ts'
import { me } from '../lib/auth'
import type { PlayerControl } from './BestVideo'

const NAME_KEY = 'remake.reviewer-name'
const storedName = () => {
  try {
    return localStorage.getItem(NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

interface Props {
  ideaId: string
  videoId: string
  // Set on the approver's page: comments go through the share link and the approver names themselves once.
  token?: string
  // The reference video's player, when it can report its time and jump (TikTok). Without it the time is typed.
  control?: MutableRefObject<PlayerControl | null>
  canSeek: boolean
  // Called when the link turns out to be closed.
  onClosed?: () => void
}

// Notes pinned to a second of the reference video. Both the team and the approver see the same list.
export function TimedComments({ ideaId, videoId, token, control, canSeek, onClosed }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loadError, setLoadError] = useState('')
  const [at, setAt] = useState('')
  const [text, setText] = useState('')
  const [name, setName] = useState(token ? storedName : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const fail = useCallback(
    (e: Error) => {
      if (e instanceof LinkClosed && onClosed) return onClosed()
      return e.message
    },
    [onClosed],
  )

  const load = useCallback(() => {
    listComments(ideaId, token)
      .then((c) => {
        setComments(sortByTime(c.filter((x) => x.videoId === videoId)))
        setLoadError('')
      })
      .catch((e: Error) => setLoadError(fail(e) ?? ''))
  }, [ideaId, videoId, token, fail])
  useEffect(load, [load])
  // The other side may have added something while this tab sat in the background.
  useEffect(() => {
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [load])

  // Staff comment under their own account name.
  useEffect(() => {
    if (token) return
    me().then((a) => setName(a.kind === 'signed-in' ? a.account.name || a.account.email : 'Team'))
  }, [token])

  const useNow = () => {
    const t = control?.current?.time()
    if (t == null) return setError("The player hasn't started yet. Press play first, or type the time.")
    setError('')
    setAt(formatAt(t))
  }

  const post = (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    const atSec = parseAt(at)
    if (atSec === null) return setError('Enter the time as m:ss, like 1:15.')
    if (!text.trim()) return setError('Write your comment first.')
    if (!name.trim()) return setError('Add your name first.')
    setBusy(true)
    setError('')
    addComment(ideaId, { videoId, atSec, text: text.trim(), author: name.trim() }, token)
      .then((c) => {
        if (token) {
          try {
            localStorage.setItem(NAME_KEY, name.trim())
          } catch {
            // The name is only a convenience; the comment is saved either way.
          }
        }
        setComments((cur) => sortByTime([...cur, c]))
        setText('')
        setAt('')
        setBusy(false)
      })
      .catch((err: Error) => {
        setBusy(false)
        setError(fail(err) ?? '')
      })
  }

  return (
    <section className="timed-comments" aria-label="Comments on the video">
      <h3 className="field-label">Comments on the video</h3>
      {loadError && (
        <p className="error" role="alert">
          {loadError}
        </p>
      )}
      {comments.length === 0 && !loadError && <p className="small muted">No comments yet. Pin one to a second of the video.</p>}
      {comments.length > 0 && (
        <ul className="tc-list">
          {comments.map((c) => (
            <li key={c.id} className="tc-item">
              {canSeek ? (
                <button type="button" className="tc-at tc-at-link" onClick={() => control?.current?.seek(c.atSec)} aria-label={`Jump to ${formatAt(c.atSec)}`}>
                  {formatAt(c.atSec)}
                </button>
              ) : (
                <span className="tc-at">{formatAt(c.atSec)}</span>
              )}
              <div className="tc-body">
                <span className="small muted">{c.author}</span>
                <p>{c.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form className="tc-form" onSubmit={post}>
        {token && !storedName() && (
          <label className="field">
            <span className="field-label">Your name</span>
            <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
        )}
        <div className="tc-row">
          <label className="field tc-time">
            <span className="field-label">At</span>
            <input value={at} placeholder="1:15" inputMode="numeric" onChange={(e) => setAt(e.target.value)} />
          </label>
          {canSeek && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={useNow}>
              Use player time
            </button>
          )}
        </div>
        <label className="field">
          <span className="field-label">Comment</span>
          <textarea rows={2} value={text} maxLength={MAX_COMMENT_LENGTH} onChange={(e) => setText(e.target.value)} />
        </label>
        <div className="tc-actions">
          <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
            Add comment
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  )
}
