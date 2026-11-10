import { useCallback, useEffect, useRef, useState } from 'react'
import { getHealth } from '@/lib/api'
import { bi, t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export type ApiStatus = 'checking' | 'online' | 'offline'

const POLL_MS = 30_000

// GET /health on mount, then every 30 s (silently). recheck() shows `checking` first (Retry / Check again).
export function useApiStatus() {
  const [status, setStatus] = useState<ApiStatus>('checking')
  const alive = useRef(true)

  const check = useCallback(() => getHealth().then((ok) => alive.current && setStatus(ok ? 'online' : 'offline')), [])
  const recheck = useCallback(() => {
    setStatus('checking')
    void check()
  }, [check])

  useEffect(() => {
    alive.current = true
    void check()
    const id = setInterval(check, POLL_MS)
    return () => {
      alive.current = false
      clearInterval(id)
    }
  }, [check])

  return { status, recheck }
}

const LOOK: Record<ApiStatus, string> = {
  online: 'border-ok/40 bg-ok/12 text-ok',
  offline: 'border-err/40 bg-err/12 text-err',
  checking: 'border-line bg-raised text-tx',
}
const TEXT = { online: t.apiOnline, offline: t.apiOffline, checking: t.apiChecking }

export default function ApiChip({ status }: { status: ApiStatus }) {
  const p = TEXT[status]
  return (
    <span
      role="status"
      data-testid="api-status"
      data-api={status}
      aria-label={bi(p)}
      className={cn(
        'inline-flex min-h-[30px] items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[13px] leading-tight font-semibold whitespace-nowrap',
        LOOK[status],
      )}
    >
      {status === 'checking' ? (
        <span aria-hidden="true" className="size-4 shrink-0 animate-spin rounded-full border-2 border-tx-3/35 border-t-current" />
      ) : (
        <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full bg-current', status === 'online' && 'animate-api-pulse')} />
      )}
      <span>{p.th}</span>
      <span className="text-xs font-normal opacity-85">{p.en.replace('API ', '')}</span>
    </span>
  )
}
