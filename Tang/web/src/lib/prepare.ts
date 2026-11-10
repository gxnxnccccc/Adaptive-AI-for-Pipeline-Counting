// One photo before upload: quality hints first, then compress. Throws when the photo can't be decoded.
import { compressImage } from './compress'
import { checkImageQuality, type Quality } from './quality'

export type PrepStep = 'checking' | 'compressing'
// width/height = natural pixel size of `upload`.
export type Prepared = { upload: File; originalBytes: number; uploadBytes: number; width: number; height: number; quality: Quality }

export async function preparePhoto(file: File, onStatus: (step: PrepStep) => void): Promise<Prepared> {
  onStatus('checking')
  const quality = await checkImageQuality(file)
  onStatus('compressing')
  const c = await compressImage(file)
  return { upload: c.file, originalBytes: c.originalBytes, uploadBytes: c.compressedBytes, width: c.width, height: c.height, quality }
}
