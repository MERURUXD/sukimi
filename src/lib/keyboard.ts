/** Safari 确认选词的 keydown 可能晚于 compositionend，仍会报告 229。 */
export function isImeComposing(event: Pick<KeyboardEvent, 'isComposing' | 'keyCode'>): boolean {
  return event.isComposing || event.keyCode === 229
}
