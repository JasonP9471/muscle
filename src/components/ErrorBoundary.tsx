import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface State { hasError: boolean }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State { return { hasError: true } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('TrainOS render error', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <main className="fatal-error">
        <span className="state-icon error"><AlertTriangle /></span>
        <h1>TrainOS hit an unexpected snag.</h1>
        <p>Your saved training data is still on this device. Reload to try again.</p>
        <button className="button primary" onClick={() => window.location.reload()}><RefreshCw size={18} /> Reload app</button>
      </main>
    )
  }
}

