// An error sentence from the API. When it suggests saved searches ("Try a saved search, like "tofu".") each quoted
// name becomes a button that runs that search; the wording itself is shown as it came.
const HINT = /(Try a saved search, like )((?:"[^"]+"(?:, )?)+)/

export function ErrorText({ text, onSearch }: { text: string; onSearch?: (q: string) => void }) {
  const m = onSearch ? HINT.exec(text) : null
  if (!m || !onSearch) return <>{text}</>
  const names = [...m[2].matchAll(/"([^"]+)"/g)].map((x) => x[1])
  const after = text.slice(m.index + m[0].length)
  return (
    <>
      {text.slice(0, m.index) + m[1]}
      {names.map((n, i) => (
        <span key={n}>
          {i > 0 && ', '}
          <button type="button" className="link-btn" onClick={() => onSearch(n)}>
            "{n}"
          </button>
        </span>
      ))}
      {after}
    </>
  )
}
