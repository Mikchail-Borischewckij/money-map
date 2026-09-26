import { Segmented } from '@/components/ui'

export type ArchiveTab = 'active' | 'archived'

export default function ArchiveTabs({ value, onChange, archived }: { value: ArchiveTab; onChange: (value: ArchiveTab) => void; archived: number }) {
  return <Segmented size="sm" label="Показать" value={value} onChange={onChange}
    options={[{ value: 'active', label: 'Активные' }, { value: 'archived', label: archived ? `В архиве · ${archived}` : 'В архиве' }]} />
}
