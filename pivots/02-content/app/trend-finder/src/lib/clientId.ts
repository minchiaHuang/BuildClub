const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'client'

// An id from the client's name; adds -2, -3 ... when another client already has it.
export function uniqueClientId(name: string, taken: string[]): string {
  const base = slug(name)
  let id = base
  for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`
  return id
}
