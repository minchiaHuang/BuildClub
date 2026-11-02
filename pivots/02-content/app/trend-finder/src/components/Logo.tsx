import logoUrl from '../assets/remake-logo.png'

// The Remake wordmark (the founder's logo file). Drawn as a mask so it takes the text colour and works in dark mode.
export function Logo({ height = 22 }: { height?: number }) {
  return (
    <span
      className="remake-logo"
      role="img"
      aria-label="Remake"
      style={{ height, width: height * (706 / 151), maskImage: `url(${logoUrl})`, WebkitMaskImage: `url(${logoUrl})` }}
    />
  )
}
