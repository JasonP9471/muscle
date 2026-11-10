import { authProvider } from '../auth/provider'
import { cloudConfig } from '../../config/cloud'

export interface PrivateStorageProvider {
  mode: 'local' | 'supabase'
  upload(bucket: 'meal-photos' | 'progress-photos', blob: Blob): Promise<string>
  createSignedUrl(bucket: 'meal-photos' | 'progress-photos', path: string, expiresIn?: number): Promise<string>
}

const supabaseUrl = cloudConfig.supabaseUrl
const publishableKey = cloudConfig.publishableKey

export const privateStorage: PrivateStorageProvider = cloudConfig.enabled
  ? createSupabaseStorage(supabaseUrl, publishableKey)
  : {
      mode: 'local',
      async upload() { throw new Error('Private cloud storage is not configured. The image remains stored locally.') },
      async createSignedUrl() { throw new Error('Private cloud storage is not configured.') },
    }

function createSupabaseStorage(url: string, key: string): PrivateStorageProvider {
  const authorized = async () => {
    const session = await authProvider.getSession()
    if (!session || session.demo) throw new Error('Sign in before using private cloud storage.')
    return session
  }
  return {
    mode: 'supabase',
    async upload(bucket, blob) {
      const session = await authorized()
      const path = `${session.user.id}/${crypto.randomUUID()}.jpg`
      const response = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
        method: 'POST', headers: { apikey: key, Authorization: `Bearer ${session.accessToken}`, 'content-type': 'image/jpeg', 'x-upsert': 'false' }, body: blob,
      })
      if (!response.ok) throw new Error('The private image upload failed. The local copy is still safe.')
      return path
    },
    async createSignedUrl(bucket, path, expiresIn = 900) {
      const session = await authorized()
      const response = await fetch(`${url}/storage/v1/object/sign/${bucket}/${path}`, {
        method: 'POST', headers: { apikey: key, Authorization: `Bearer ${session.accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ expiresIn }),
      })
      const payload = await response.json() as { signedURL?: string; signedUrl?: string }
      const signedPath = payload.signedURL ?? payload.signedUrl
      if (!response.ok || !signedPath) throw new Error('A temporary private image URL could not be created.')
      return signedPath.startsWith('http') ? signedPath : `${url}/storage/v1${signedPath}`
    },
  }
}
