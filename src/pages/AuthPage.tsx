import { useEffect, useState } from 'react'
import { ArrowRight, KeyRound, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { Brand } from '../components/Brand'
import { authProvider, enableLocalOnlyMode } from '../services/auth/provider'
import { usePageTitle } from '../hooks/usePageTitle'
import { useUIStore } from '../stores/uiStore'
import { useSearchParams } from 'react-router-dom'

type Mode = 'sign-in' | 'create' | 'forgot' | 'reset-password'

export function AuthPage() {
  usePageTitle('Account')
  const [searchParams] = useSearchParams()
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const isRecoveryCallback = searchParams.get('recovery') === 'true' || hashParams.get('type') === 'recovery'
  const isEmailCallback = searchParams.get('verified') === 'true'
    || searchParams.has('code')
    || searchParams.has('token_hash')
    || window.location.hash.includes('access_token=')
    || window.location.hash.includes('error_description=')
  const [mode, setMode] = useState<Mode>(searchParams.get('recovery') === 'true' ? 'reset-password' : searchParams.get('mode') === 'create' ? 'create' : 'sign-in')
  const [email, setEmail] = useState(authProvider.mode === 'demo' ? 'demo@trainos.local' : '')
  const [password, setPassword] = useState(authProvider.mode === 'demo' ? 'trainos-demo' : '')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(isEmailCallback)
  const [callbackError, setCallbackError] = useState<string | null>(null)
  const addToast = useUIStore((state) => state.addToast)
  useEffect(() => {
    if (!isEmailCallback) return
    let active = true
    void authProvider.completeEmailRedirect()
      .then((session) => {
        if (!active) return
        if (!session) throw new Error('The verification link could not create a session. Return to TrainOS and log in with your confirmed email.')
        if (isRecoveryCallback) {
          setMode('reset-password')
          setBusy(false)
          window.history.replaceState(null, '', '/auth?recovery=true')
          return
        }
        addToast('Email confirmed. Welcome to TrainOS.', 'success')
        window.location.replace('/today')
      })
      .catch((error: unknown) => {
        if (!active) return
        setCallbackError(error instanceof Error ? error.message : 'This verification link could not be completed.')
        setBusy(false)
      })
    return () => { active = false }
  }, [addToast, isEmailCallback, isRecoveryCallback])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true)
    try {
      if (mode === 'forgot') { await authProvider.forgotPassword(email); addToast(authProvider.mode === 'demo' ? 'Demo mode: password recovery flow verified.' : 'Check your email for a recovery link.', 'success'); setMode('sign-in'); return }
      if (mode === 'reset-password') { await authProvider.updatePassword(password); addToast('Your password has been updated.', 'success'); window.location.assign('/today'); return }
      const session = mode === 'create' ? await authProvider.signUp(email, password, name) : await authProvider.signIn(email, password)
      if (mode === 'create' && !session) { addToast('Check your email to confirm the account, then return here and log in.', 'success'); setMode('sign-in'); return }
      window.location.assign('/today')
    } catch (error) { addToast(error instanceof Error ? error.message : 'Authentication failed.', 'error') } finally { setBusy(false) }
  }
  const passwordLabel = mode === 'reset-password' ? 'New password' : 'Password'
  const submitLabel = busy ? 'Working…' : mode === 'forgot' ? 'Send recovery email' : mode === 'reset-password' ? 'Update password' : mode === 'create' ? 'Create account' : 'Log in'
  return <main className="auth-page"><section className="auth-brand"><Brand /><div><p className="eyebrow">Training. Nutrition. Progress.</p><h1>One plan.<br/><span>Every device.</span></h1><p>TrainOS combines adaptive training, nutrition, recovery, and body trends without hiding the logic behind the recommendations.</p></div><div className="auth-points"><span><ShieldCheck /> Private account data</span><span><KeyRound /> Automatic device sync</span></div></section><section className="auth-card">{isEmailCallback && busy ? <><p className="eyebrow">Secure account</p><h2>Confirming your email…</h2><p>TrainOS is finishing the verification and preparing your account on this device.</p></> : <>{mode !== 'reset-password' && <div className="auth-mode"><button className={mode === 'sign-in' ? 'selected' : ''} onClick={() => setMode('sign-in')}>Log in</button><button className={mode === 'create' ? 'selected' : ''} onClick={() => setMode('create')}>Create account</button></div>}<p className="eyebrow">{authProvider.mode === 'demo' ? 'Local account mode' : 'Secure account'}</p><h2>{mode === 'reset-password' ? 'Choose a new password' : mode === 'forgot' ? 'Reset your password' : mode === 'create' ? 'Build your TrainOS account' : 'Welcome back'}</h2><p>{mode === 'reset-password' ? 'Use at least eight characters, then log in with your new password on any device.' : authProvider.mode === 'demo' ? 'This test login stays on the current device.' : 'Your session is managed securely and your private TrainOS data follows your account.'}</p>{callbackError && <p className="form-error" role="alert">{callbackError}</p>}<form onSubmit={(event) => void submit(event)}>{mode === 'create' && <label className="field"><span>Display name</span><div className="input-with-icon"><UserRound/><input required value={name} onChange={(event) => setName(event.target.value)} autoComplete="name"/></div></label>}{mode !== 'reset-password' && <label className="field"><span>Email</span><div className="input-with-icon"><Mail/><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email"/></div></label>}{mode !== 'forgot' && <label className="field"><span>{passwordLabel}</span><div className="input-with-icon"><KeyRound/><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}/></div></label>}<button className="button primary wide" disabled={busy}>{submitLabel} <ArrowRight/></button></form>{mode === 'sign-in' && <button className="text-button auth-forgot" onClick={() => setMode('forgot')}>Forgot password?</button>}{mode === 'forgot' && <button className="text-button auth-forgot" onClick={() => setMode('sign-in')}>Back to login</button>}{mode !== 'reset-password' && <><button className="button ghost wide auth-continue" onClick={() => { enableLocalOnlyMode(); window.location.assign('/onboarding') }}>Continue on this device</button><p className="privacy-note">Device-only mode works offline but does not sync until you log in.</p></>}</>}</section></main>
}
