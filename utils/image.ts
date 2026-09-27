export interface CompressOptions {
  /** Côté le plus long, en pixels. */
  maxSize?: number
  /** Qualité JPEG/WebP entre 0 et 1. */
  quality?: number
  type?: 'image/jpeg' | 'image/webp'
}

export interface CompressedImage {
  blob: Blob
  width: number
  height: number
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // imageOrientation : respecte l'orientation EXIF des photos de téléphone
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    }
    catch {
      // format non pris en charge : on tente via <img>
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  }
  finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Redimensionne et recompresse une image dans le navigateur.
 * Les GIF et SVG sont renvoyés tels quels (animation / vectoriel).
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<CompressedImage | { blob: File; width: null; height: null }> {
  const { maxSize = 1600, quality = 0.82, type = 'image/jpeg' } = options
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return { blob: file, width: null, height: null }
  }

  const source = await decode(file)
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height))
  const width = Math.round(source.width * scale)
  const height = Math.round(source.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Compression d’image impossible sur cet appareil.')
  ctx.drawImage(source, 0, 0, width, height)
  if ('close' in source) source.close()

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality))
  if (!blob) throw new Error('Compression d’image impossible sur cet appareil.')
  return { blob, width, height }
}

export function extensionFor(mime: string): string {
  return ({ 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png', 'image/gif': 'gif', 'image/svg+xml': 'svg' } as Record<string, string>)[mime] ?? 'bin'
}
