import { Badge } from '@/components/ui'

export type Note = { label: string; reason: string }

// Short badges for what in the row needs a look; the full reason is in the tooltip.
export default function Attention({ notes }: { notes: Note[] }) {
  return <>{notes.map((note) => <Badge key={note.label} tone="warn" title={note.reason}>{note.label}</Badge>)}</>
}
