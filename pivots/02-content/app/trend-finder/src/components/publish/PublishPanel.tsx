import { useCallback, useEffect, useState } from 'react'
import type { IdeaStatus } from '../../types'
import type { CutState } from '../../lib/cut'
import { getCut } from '../../lib/cut'
import { useManagerName } from '../../lib/appContext'
import { PlatformLogo } from '../PlatformToggles'
import {
  MAX_CAPTION,
  PUB_PLATFORMS,
  PUB_PLATFORM_NAME,
  getPublishMode,
  latestByPost,
  approvalLine,
  listPosts,
  missingApproval,
  publishIdea,
  retryPost,
} from '../../lib/publish'
import type { Post, PubPlatform, Snapshot } from '../../lib/publish'
import { PlatformPublishRow } from './PlatformPublishRow'

interface Props {
  ideaId: string
  status: IdeaStatus
  shotCount: number
}

// "Post the video": caption, platforms and an optional time for a finished video the manager approved.
// Posting is simulated unless the server is set up with a real publisher.
export function PublishPanel({ ideaId, status, shotCount }: Props) {
  const manager = useManagerName()
  const [cut, setCut] = useState<CutState | null>(null)
  const [simulated, setSimulated] = useState(true)
  const [posts, setPosts] = useState<Post[]>([])
  const [latest, setLatest] = useState<Record<string, Snapshot | null>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [picked, setPicked] = useState<PubPlatform[]>([])
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)
  const [retrying, setRetrying] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  const reload = useCallback(async () => {
    try {
      const [p, l] = await Promise.all([listPosts(ideaId), latestByPost(ideaId)])
      setPosts(p)
      setLatest(l)
      setLoadError(null)
    } catch (e) {
      setLoadError((e as Error).message)
    }
  }, [ideaId])

  useEffect(() => {
    let live = true
    setLoaded(false)
    void (async () => {
      const [c, m] = await Promise.allSettled([getCut(ideaId, shotCount), getPublishMode()])
      if (!live) return
      setCut(c.status === 'fulfilled' ? c.value : null)
      // If the server cannot say, assume simulated: the safe wording.
      setSimulated(m.status === 'fulfilled' ? m.value.simulated : true)
      await reload()
      if (live) setLoaded(true)
    })()
    return () => {
      live = false
    }
  }, [ideaId, shotCount, reload])

  if (!loaded) return null
  const missing = missingApproval(status, cut, manager)
  const approval = approvalLine(cut, manager)
  if (missing && !posts.length && status !== 'approved' && !cut?.output) {
    // Plans that are not approved yet only get the short explanation.
    return (
      <section className="block pub-panel">
        <h3>Post the video</h3>
        <p className="muted small pub-gate">{missing}</p>
      </section>
    )
  }

  const toggle = (p: PubPlatform) => setPicked((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
  const scheduleAt = when ? Math.floor(new Date(when).getTime() / 1000) : undefined
  const scheduleBad = scheduleAt !== undefined && (Number.isNaN(scheduleAt) || scheduleAt * 1000 <= Date.now())
  const canPublish = !missing && picked.length > 0 && !scheduleBad && !busy && caption.length <= MAX_CAPTION

  const publish = async () => {
    setError(null)
    setBusy(true)
    try {
      await publishIdea(ideaId, { caption, platforms: PUB_PLATFORMS.filter((p) => picked.includes(p)), scheduleAt })
      setPicked([])
      setWhen('')
      await reload()
    } catch (e) {
      setError((e as Error).message)
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const retry = async (id: string) => {
    setRetrying(id)
    try {
      await retryPost(id)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setRetrying(null)
      await reload()
    }
  }

  return (
    <section className="block pub-panel">
      <div className="pub-head">
        <h3>Post the video</h3>
        {simulated && <span className="pill pill-wait pub-badge">Simulated</span>}
      </div>
      {simulated && (
        <p className="small pub-sim">
          Simulated posting: nothing is sent to TikTok, Instagram or YouTube. The posts below only show how it will work.
        </p>
      )}

      {approval && <p className="small pub-approval">{approval}</p>}

      {missing ? (
        <p className="small pub-gate" role="status">
          {missing}
        </p>
      ) : (
        <div className="pub-form">
          <label className="pub-caption">
            <span className="small">Caption</span>
            <textarea rows={3} value={caption} maxLength={MAX_CAPTION} placeholder="Write the caption and hashtags" onChange={(e) => setCaption(e.target.value)} />
            <span className="muted small pub-count" aria-live="polite">
              {caption.length} / {MAX_CAPTION}
            </span>
          </label>

          <fieldset className="pub-platforms">
            <legend className="small">Where to post</legend>
            <div className="pub-platform-list">
              {PUB_PLATFORMS.map((p) => (
                <label key={p} className={`pub-platform${picked.includes(p) ? ' is-on' : ''}`}>
                  <input type="checkbox" checked={picked.includes(p)} onChange={() => toggle(p)} />
                  <PlatformLogo platform={p} size={18} />
                  <span>{PUB_PLATFORM_NAME[p]}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <label className="pub-when">
            <span className="small">Post at (optional)</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-invalid={scheduleBad || undefined} />
            {scheduleBad && (
              <span className="pub-field-error small" role="alert">
                Pick a time in the future, or leave it empty to post now.
              </span>
            )}
          </label>

          <div className="pub-actions">
            <button type="button" className="btn btn-primary" disabled={!canPublish} onClick={() => void publish()}>
              {busy ? 'Posting…' : simulated ? 'Publish (simulated)' : 'Publish'}
            </button>
            {picked.length === 0 && <span className="muted small">Pick at least one platform.</span>}
          </div>
        </div>
      )}

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loadError && (
        <p className="error" role="alert">
          {loadError}{' '}
          <button type="button" className="link-btn" onClick={() => void reload()}>
            Retry
          </button>
        </p>
      )}

      {posts.length > 0 && (
        <ul className="pub-rows">
          {posts.map((post) => (
            <PlatformPublishRow
              key={post.id}
              post={post}
              simulated={simulated}
              latest={latest[post.id] ?? null}
              retrying={retrying === post.id}
              onRetry={() => void retry(post.id)}
              onSaved={() => void reload()}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
