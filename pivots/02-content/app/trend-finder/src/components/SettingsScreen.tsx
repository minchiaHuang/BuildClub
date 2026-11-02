import type { Client } from '../types'
import { ClientFields } from './ClientFields'

interface Props {
  client: Client
  onChange: (patch: Partial<Client>) => void
}

export function SettingsScreen({ client, onChange }: Props) {
  return (
    <section className="settings">
      <header className="page-head">
        <span className="eyebrow">{client.name} · Client settings</span>
        <h1>About this client</h1>
        <p className="muted">Used for the search suggestions, the "Can they film this?" check and the monthly target. Changes save as you type.</p>
      </header>

      <ClientFields client={client} onChange={onChange} />
    </section>
  )
}
