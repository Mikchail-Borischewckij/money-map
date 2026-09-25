// Hues for account badges; red and green are left out so a badge never reads as an error or a success.
const hues = [217, 268, 322, 28, 190, 45, 290, 240]

// Each open account gets its own colour by its place among open accounts (sorted by id), so the colour
// is the same on every screen. Archived accounts get none (grey).
export function accountHue(accounts: { id: string; isArchived?: boolean; is_archived?: boolean }[], id: string) {
  const open = accounts.filter((account) => !(account.isArchived ?? account.is_archived)).map((account) => account.id).sort()
  const index = open.indexOf(id)
  return index < 0 ? null : hues[index % hues.length]
}
