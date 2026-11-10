import { Capacitor } from '@capacitor/core'
import { Camera, CameraDirection, EncodingType, MediaTypeSelection } from '@capacitor/camera'
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { LocalNotifications } from '@capacitor/local-notifications'
import { StatusBar, Style } from '@capacitor/status-bar'

const REST_NOTIFICATION_ID = 73001

export const isNativeApp = Capacitor.isNativePlatform()

export async function setNativeChrome(theme: 'dark' | 'light'): Promise<void> {
  if (!isNativeApp) return
  await StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light }).catch(() => undefined)
  await StatusBar.setBackgroundColor({ color: theme === 'dark' ? '#090b0c' : '#f3f5f2' }).catch(() => undefined)
}

export async function takeNativePhoto(prefix: string): Promise<File | null> {
  if (!isNativeApp) return null
  try {
    const photo = await Camera.takePhoto({
      cameraDirection: CameraDirection.Rear,
      correctOrientation: true,
      editable: 'no',
      encodingType: EncodingType.JPEG,
      includeMetadata: true,
      quality: 82,
      saveToGallery: false,
      targetHeight: 1600,
      targetWidth: 1600,
    })
    return mediaResultToFile(photo.webPath ?? photo.uri, photo.metadata?.format, prefix)
  } catch (error) {
    if (isUserCancellation(error)) return null
    throw error
  }
}

export async function chooseNativePhoto(prefix: string): Promise<File | null> {
  if (!isNativeApp) return null
  try {
    const selection = await Camera.chooseFromGallery({
      allowMultipleSelection: false,
      includeMetadata: true,
      mediaType: MediaTypeSelection.Photo,
      quality: 82,
      targetHeight: 1600,
      targetWidth: 1600,
    })
    const photo = selection.results[0]
    return photo ? mediaResultToFile(photo.webPath ?? photo.uri, photo.metadata?.format, prefix) : null
  } catch (error) {
    if (isUserCancellation(error)) return null
    throw error
  }
}

export async function setCompletedHaptic(): Promise<void> {
  if (!isNativeApp) return
  await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)
}

export async function restCompletedHaptic(): Promise<void> {
  if (!isNativeApp) return
  await Haptics.notification({ type: NotificationType.Success }).catch(() => undefined)
}

export async function requestRestNotificationPermission(): Promise<boolean> {
  if (!isNativeApp) return false
  const current = await LocalNotifications.checkPermissions()
  if (current.display === 'granted') return true
  const requested = await LocalNotifications.requestPermissions()
  return requested.display === 'granted'
}

export async function scheduleRestNotification(seconds: number): Promise<void> {
  if (!isNativeApp || seconds <= 0) return
  try {
    await cancelRestNotification()
    await LocalNotifications.schedule({
      notifications: [{
        id: REST_NOTIFICATION_ID,
        title: 'Rest complete',
        body: 'Your next set is ready.',
        foreground: false,
        isExactNotification: false,
        schedule: { at: new Date(Date.now() + seconds * 1000) },
        sound: 'default',
      }],
    })
  } catch {
    // The timer remains functional in-app if notification access is later revoked.
  }
}

export async function cancelRestNotification(): Promise<void> {
  if (!isNativeApp) return
  await LocalNotifications.cancel({ notifications: [{ id: REST_NOTIFICATION_ID }] }).catch(() => undefined)
}

async function mediaResultToFile(path: string | undefined, format: string | undefined, prefix: string): Promise<File> {
  if (!path) throw new Error('The selected photo could not be read.')
  const browserPath = /^(https?:|blob:|data:)/.test(path) ? path : Capacitor.convertFileSrc(path)
  const response = await fetch(browserPath)
  if (!response.ok) throw new Error('The selected photo could not be read.')
  const blob = await response.blob()
  const normalizedFormat = format === 'png' ? 'png' : 'jpeg'
  const type = blob.type || `image/${normalizedFormat}`
  return new File([blob], `${prefix}-${Date.now()}.${normalizedFormat === 'jpeg' ? 'jpg' : 'png'}`, { type })
}

function isUserCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /cancel|user cancelled|no image picked/i.test(message)
}
