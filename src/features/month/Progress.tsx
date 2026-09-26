import { Badge } from '@/components/ui'

// How much of a step is done, the same way in every step; nothing once everything is done.
export function progress(done: number, total: number, label = 'Проверено') {
  return total > 0 && done < total && <Badge tone="warn">{label} {done} из {total}</Badge>
}
