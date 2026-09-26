import { Badge } from '@/components/ui'

// How much of a step is done, the same way in every step; nothing once everything is done.
// Plain, not amber: progress is not a warning, and amber has to stay rare enough to mean something.
export function progress(done: number, total: number, label = 'Проверено') {
  return total > 0 && done < total && <Badge>{label} {done} из {total}</Badge>
}
