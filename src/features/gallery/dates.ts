import { t } from '@/i18n'

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const

/** 月份名（i 从 0 起）：中文是「10 月」，英文是缩写，和更新页预测用的是同一份 */
export const monthName = (i: number) => t(`updates.predict.day.months.${MONTHS[i]}`)
