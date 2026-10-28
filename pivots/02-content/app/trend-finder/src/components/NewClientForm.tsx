import { useEffect, useState } from 'react'
import type { Client } from '../types'
import { uniqueClientId } from '../lib/clientId'
import { ClientFields } from './ClientFields'

interface Props {
  existingIds: string[]
  onAdd: (c: Client) => void
  onCancel: () => void
}

const blank: Client = { id: '', name: '', niche: '', audience: '', monthlyTarget: 8, examples: [], topics: [], cannot: [] }

export function NewClientForm({ existingIds, onAdd, onCancel }: Props) {
  const [draft, setDraft] = useState<Client>(blank)
  const name = draft.name.trim()

  useEffect(() => {
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
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="new-client-title" onSubmit={submit}>
        <h2 id="new-client-title">Add client</h2>
        <ClientFields client={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!name}>
            Add client
          </button>
        </div>
      </form>
    </div>
  )
}
