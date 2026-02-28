const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 12
const KEY_LENGTH = 32

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

async function deriveKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(secret))
  const keyBytes = new Uint8Array(digest).subarray(0, KEY_LENGTH)
  return crypto.subtle.importKey('raw', keyBytes, { name: ALGORITHM }, false, [
    'encrypt',
    'decrypt',
  ])
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function decodeBase64(input: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(input, 'base64'))
  }
  const binary = atob(input)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer
}

export async function encryptToken(plaintext: string, secret: string): Promise<string> {
  const key = await deriveKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const ivBuffer = toArrayBuffer(iv)
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: ivBuffer },
    key,
    textEncoder.encode(plaintext),
  )
  const cipherBytes = new Uint8Array(encrypted)
  const combined = new Uint8Array(iv.length + cipherBytes.length)
  combined.set(iv, 0)
  combined.set(cipherBytes, iv.length)
  return encodeBase64(combined)
}

export async function decryptToken(ciphertext: string, secret: string): Promise<string> {
  const data = decodeBase64(ciphertext)
  const iv = data.subarray(0, IV_LENGTH)
  const ivBuffer = toArrayBuffer(iv)
  const encrypted = data.subarray(IV_LENGTH)
  const key = await deriveKey(secret)
  const encryptedBuffer = toArrayBuffer(encrypted)
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: ivBuffer },
    key,
    encryptedBuffer,
  )
  return textDecoder.decode(decrypted)
}
