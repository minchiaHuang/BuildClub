import { useEffect, useState } from 'react'
import type { Client } from '../types'
import { uniqueClientId } from '../lib/clientId'
import { ClientFields } from './ClientFields'

interface Props {
  existingIds: string[]
  onAdd: (c: Client) => void
  // Left out for the first client, which can't be skipped.
  onCancel?: () => void
  first?: boolean
}

const blank: Client = { id: '', name: '', niche: '', audience: '', monthlyTarget: 8, examples: [], topics: [], cannot: [] }

export function NewClientForm({ existingIds, onAdd, onCancel, first }: Props) {
  const [draft, setDraft] = useState<Client>(blank)
  const name = draft.name.trim()

  // Focus starts on the first field; when the dialog closes it goes back to the sidebar control that opened it
  // (the menu item itself is gone by then, so: the phone's menu button, or the client switcher).
  useEffect(() => {
    document.getElementById('client-name')?.focus()
    if (first) return
    return () => {
      const bar = document.querySelector<HTMLElement>('.mobile-bar')
      const target = bar && getComputedStyle(bar).display !== 'none' ? bar.querySelector<HTMLElement>('.icon-btn') : document.querySelector<HTMLElement>('.switcher-btn')
      target?.focus()
    }
  }, [first])

  useEffect(() => {
    if (!onCancel) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return
    const clean = (list: string[] | undefined) => (list ?? []).map((t) => t.trim()).filter(Boolean)
    onAdd({
      ...draft,
      id: uniqueClientId(name, existingIds),
      name,
      niche: draft.niche.trim(),
      audience: draft.audience.trim(),
      examples: clean(draft.examples),
      topics: clean(draft.topics),
    })
  }

  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onCancel?.()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="new-client-title" onSubmit={submit}>
        <h2 id="new-client-title">{first ? 'Add your first client' : 'Add client'}</h2>
        <ClientFields client={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
        <div className="modal-actions">
          {onCancel && (
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              Cancel
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={!name}>
            Add client
          </button>
        </div>
      </form>
    </div>
  )
}
