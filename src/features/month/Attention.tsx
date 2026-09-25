// A quiet mark that something in the row needs a look; the reason is in the tooltip.
export default function Attention({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null
  const text = reasons.join('. ')
  return <span className="attention" title={text} role="img" aria-label={text} />
}
