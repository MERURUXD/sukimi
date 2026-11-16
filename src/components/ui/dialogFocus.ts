export function focusableIn(panel: HTMLElement) {
  return [...panel.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')].filter((el) => {
    if (el.tabIndex < 0 || el.matches(':disabled') || el.closest('[inert], [hidden], [aria-hidden="true"]')) return false
    const style = getComputedStyle(el)
    return style.display !== 'none' && style.visibility !== 'hidden'
  })
}

export function trapDialogTab(panel: HTMLElement, event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'preventDefault'>) {
  if (event.key !== 'Tab') return
  const items = focusableIn(panel)
  const active = document.activeElement
  const first = items[0]
  const last = items.at(-1)
  if (!first || !items.some((item) => item === active) || active === (event.shiftKey ? first : last)) {
    event.preventDefault()
    const next = event.shiftKey ? last : first
    ;(next ?? panel).focus({ preventScroll: true })
  }
}
