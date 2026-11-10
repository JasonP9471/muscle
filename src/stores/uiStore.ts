import { create } from 'zustand'

export type ToastTone = 'success' | 'info' | 'error'

interface ToastMessage {
  id: string
  message: string
  tone: ToastTone
}

interface UIState {
  toasts: ToastMessage[]
  addToast: (message: string, tone?: ToastTone) => void
  removeToast: (id: string) => void
}

export const useUIStore = create<UIState>((set, get) => ({
  toasts: [],
  addToast: (message, tone = 'info') => {
    const id = crypto.randomUUID()
    set((state) => ({ toasts: [...state.toasts, { id, message, tone }] }))
    window.setTimeout(() => get().removeToast(id), 4000)
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}))

