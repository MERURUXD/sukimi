import { t } from '@/i18n'
/** 连载状态的中文名；UNKNOWN 不显示 */
export const STATUS: Record<string, string> = {
  ONGOING: t('manga.status.ONGOING'),
  COMPLETED: t('manga.status.COMPLETED'),
  PUBLISHING_FINISHED: t('manga.status.PUBLISHING_FINISHED'),
  ON_HIATUS: t('manga.status.ON_HIATUS'),
  CANCELLED: t('manga.status.CANCELLED'),
  LICENSED: t('manga.status.LICENSED'),
}
