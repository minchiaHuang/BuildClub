import { PlatformLogo } from '../PlatformToggles'
import { PUB_PLATFORM_NAME, badgeOf, postNote } from '../../lib/publish'
import type { Post, Snapshot } from '../../lib/publish'
import { formatDay } from '../../lib/dates'
import { t } from '../../lib/i18n'
import { StatusBadge } from './StatusBadge'
import { ResultsEntry } from './ResultsEntry'

interface Props {
  post: Post
  simulated: boolean
  latest: Snapshot | null
  retrying: boolean
  onRetry: () => void
  onSaved: () => void
}

// One platform's post: logo, state, what happened, and the numbers once it is out.
export function PlatformPublishRow({ post, simulated, latest, retrying, onRetry, onSaved }: Props) {
  const badge = badgeOf(post, simulated)
  const note = postNote(post, simulated)
  const name = PUB_PLATFORM_NAME[post.platform]
  const when =
    post.status === 'scheduled' && post.scheduledAt
      ? t('cut.pub.scheduledFor', { when: `${formatDay(post.scheduledAt * 1000)} ${new Date(post.scheduledAt * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` })
      : post.publishedAt
        ? formatDay(post.publishedAt * 1000)
        : null
  return (
    <li className="pub-row">
      <div className="pub-row-head">
        <span className="pub-row-name">
          <PlatformLogo platform={post.platform} size={18} />
          <strong>{name}</strong>
        </span>
        <StatusBadge {...badge} />
        {when && <span className="muted small">{when}</span>}
      </div>
      {note && <p className="small pub-note">{note}</p>}
      {post.status === 'failed' && (
        <div className="pub-failed">
          <p className="error small" role="alert">
            {post.error || t('cut.pub.failedFallback')}
          </p>
          <button type="button" className="btn btn-ghost btn-sm" disabled={retrying} onClick={onRetry}>
            {retrying ? t('cut.pub.trying') : t('cut.common.tryAgain')}
          </button>
        </div>
      )}
      {post.status === 'published' && <ResultsEntry postId={post.id} platformName={name} latest={latest} onSaved={onSaved} />}
    </li>
  )
}
