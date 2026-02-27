import { Storage } from '@google-cloud/storage'
import { env } from '@/config/env'
import { LIMITS, EXTERNAL_URLS } from '@/config/constants'

const storage = new Storage({ projectId: env.GCS_PROJECT_ID })
const bucket = storage.bucket(env.GCS_BUCKET_NAME)

type PresignedUrlOptions = {
  fileName: string
  fileType: string
}

type PresignedUrlResult = {
  uploadUrl: string
  storageUrl: string
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._\-]/g, '_')
    .replace(/^\.+/, '_')
    .slice(0, LIMITS.FILE_NAME_MAX_LENGTH)
}

export async function getPresignedUploadUrl({
  fileName,
  fileType,
}: PresignedUrlOptions): Promise<PresignedUrlResult> {
  const safeFileName = sanitizeFileName(fileName)
  const objectName = `uploads/${crypto.randomUUID()}/${safeFileName}`
  const file = bucket.file(objectName)

  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + LIMITS.UPLOAD_URL_EXPIRY_MS,
    contentType: fileType,
  })

  const storageUrl = `${EXTERNAL_URLS.GCS_BASE}/${env.GCS_BUCKET_NAME}/${objectName}`

  return { uploadUrl, storageUrl }
}
