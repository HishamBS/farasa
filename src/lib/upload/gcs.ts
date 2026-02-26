import { Storage } from '@google-cloud/storage'
import { env } from '@/config/env'
import { LIMITS } from '@/config/constants'

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

export async function getPresignedUploadUrl({
  fileName,
  fileType,
}: PresignedUrlOptions): Promise<PresignedUrlResult> {
  const objectName = `uploads/${crypto.randomUUID()}/${fileName}`
  const file = bucket.file(objectName)

  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + LIMITS.UPLOAD_URL_EXPIRY_MS,
    contentType: fileType,
  })

  const storageUrl = `https://storage.googleapis.com/${env.GCS_BUCKET_NAME}/${objectName}`

  return { uploadUrl, storageUrl }
}
