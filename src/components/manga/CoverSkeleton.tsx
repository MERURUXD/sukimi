import { trackCoverLoading } from '@/lib/coverMotion'

export function CoverSkeleton() {
  return <span ref={trackCoverLoading} className="cover-skeleton" aria-hidden />
}
