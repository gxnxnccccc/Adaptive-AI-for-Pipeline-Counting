// In-memory state carried from Processing to Result (and the saved DO back to Processing for the toast).
// Not persisted: a page reload starts over. Reset on login/logout (keyed by operator).
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import type { PhotoEdits } from '@/lib/corrections'
import type { DetectedImage } from '@/lib/detection'
import type { Quality } from '@/lib/quality'

// One detected photo. Boxes in `result` are in the pixel space of `upload` (the compressed file that was sent);
// `original` is only for "Save original". width/height = natural pixel size of `upload`.
export type SessionPhoto = {
  id: string
  original: File
  upload: File
  originalBytes: number
  uploadBytes: number
  width: number
  height: number
  quality: Quality | null
  result: DetectedImage
}

// edits: the user's box corrections per photo id (Result page). A photo without an entry has none.
type Data = {
  photos: SessionPhoto[]
  batchId: string | null
  edits: Record<string, PhotoEdits>
  lastSavedDo: string | null
}

type Session = Data & {
  // New detection result: replaces photos + batch, drops all edits.
  start: (batchId: string, photos: SessionPhoto[]) => void
  // Drops the photo and its edits.
  removePhoto: (id: string) => void
  setEdits: (id: string, next: PhotoEdits) => void
  setLastSavedDo: (doNumber: string | null) => void
  // Drops the detection (photos, batch, edits). Keeps lastSavedDo so the toast can show after a submit.
  clear: () => void
}

const EMPTY: Data = { photos: [], batchId: null, edits: {}, lastSavedDo: null }
const SessionContext = createContext<Session | null>(null)

function Provider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data>(EMPTY)

  const start = useCallback(
    (batchId: string, photos: SessionPhoto[]) => setData((d) => ({ ...d, batchId, photos, edits: {} })),
    [],
  )
  const removePhoto = useCallback(
    (id: string) =>
      setData((d) => {
        const edits = { ...d.edits }
        delete edits[id]
        return { ...d, photos: d.photos.filter((p) => p.id !== id), edits }
      }),
    [],
  )
  const setEdits = useCallback(
    (id: string, next: PhotoEdits) => setData((d) => ({ ...d, edits: { ...d.edits, [id]: next } })),
    [],
  )
  const setLastSavedDo = useCallback((lastSavedDo: string | null) => setData((d) => ({ ...d, lastSavedDo })), [])
  const clear = useCallback(() => setData((d) => ({ ...EMPTY, lastSavedDo: d.lastSavedDo })), [])

  const value = useMemo(
    () => ({ ...data, start, removePhoto, setEdits, setLastSavedDo, clear }),
    [data, start, removePhoto, setEdits, setLastSavedDo, clear],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

// Must sit inside <AuthProvider>. A new operator gets a fresh session.
export function DetectionSessionProvider({ children }: { children: ReactNode }) {
  const { operator } = useAuth()
  return <Provider key={operator ?? ''}>{children}</Provider>
}

export function useDetectionSession(): Session {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useDetectionSession must be used inside <DetectionSessionProvider>')
  return ctx
}
