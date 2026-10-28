import { t } from '@/i18n'
export function Placeholder({ title, step }: { title: string; step?: string }) {
  return (
    <div className="wrap pt-10">
      <h1 className="m-0 text-[34px] font-bold">{title}</h1>
      {step && <p className="mt-2 text-muted">{t('misc.placeholder.plan', { step })}</p>}
    </div>
  )
}
