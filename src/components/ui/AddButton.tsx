import { Plus } from 'lucide-react'
import Button from './Button'

// The one "add" button of every table toolbar.
export default function AddButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return <Button size="sm" variant="primary" icon={<Plus size={16} />} disabled={disabled} onClick={onClick}>Добавить</Button>
}
