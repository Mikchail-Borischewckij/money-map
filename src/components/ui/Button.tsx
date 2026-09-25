import { cx } from '@/lib/format'

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'md' | 'sm'; icon?: React.ReactNode }

export default function Button({ variant = 'secondary', size = 'md', icon, className, children, type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={cx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', !children && 'btn-icon', className)} {...props}>{icon}{children}</button>
}
