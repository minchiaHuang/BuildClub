interface Props {
  // Called with the new client's id once it's saved.
  onCreated: (clientId: string) => void
  onCancel: () => void
}

// PLACEHOLDER (Stage 0). Stream A replaces this with the add-client form
// (same fields as client settings), saving through useApp().addClient.
export function AddClientScreen({ onCancel }: Props) {
  return (
    <section className="settings">
      <header className="page-head">
        <span className="eyebrow">Add client</span>
        <h1>Add a client</h1>
        <p className="muted">Coming next: name, what they sell, audience, monthly target and what they can't film.</p>
      </header>
      <button className="btn" onClick={onCancel}>
        Back
      </button>
    </section>
  )
}
