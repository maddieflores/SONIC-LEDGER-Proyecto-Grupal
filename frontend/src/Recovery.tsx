import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { AuthHeader } from './Auth';
import { request } from './auth-api';
export function Recovery({ reset = false }: { reset?: boolean }) {
 const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '');
 const [visible, setVisible] = useState(false);
 const [busy, setBusy] = useState(false);
 const [success, setSuccess] = useState('');
 const [error, setError] = useState('');
 useEffect(() => { if (reset && window.location.hash) window.history.replaceState(null, '', window.location.pathname); }, [reset]);
 async function submit(e: FormEvent<HTMLFormElement>) {
  e.preventDefault(); setError(''); const form = new FormData(e.currentTarget);
  const password = String(form.get('password') ?? '');
  if (reset && password !== form.get('confirm')) return setError('Las contraseñas no coinciden.');
  setBusy(true);
  try {
   const result = await request<{ message: string }>(reset ? 'reset-password' : 'forgot-password', reset ? { token, password } : { email: String(form.get('email')).trim() });
   setSuccess(result.message);
  } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
 }
 const invalid = reset && !/^[a-f0-9]{64}$/.test(token);
 return <div className="auth-page"><AuthHeader/><main className="recovery-card">
 <span className="feature-icon">{reset ? <LockKeyhole/> : <Mail/>}</span><h1>{reset ? 'Nueva contraseña' : 'Recupera tu cuenta'}</h1>
 <p>{reset ? 'Elige una contraseña de al menos 8 caracteres para volver a tu universo musical.' : 'Introduce tu correo electrónico para solicitar un enlace de recuperación.'}</p>
 {success ? <div className="recovery-success" role="status"><CheckCircle2 size={22}/><p>{success}</p></div> : invalid ? <p role="alert" className="auth-message">El enlace no es válido o está incompleto. Solicita uno nuevo.</p> : <form onSubmit={submit}>
 {reset ? <>
 <label className="auth-input"><LockKeyhole size={19}/><input name="password" type={visible ? 'text' : 'password'} aria-label="Nueva contraseña" placeholder="Nueva contraseña" required minLength={8} maxLength={72} autoComplete="new-password" disabled={busy}/><button type="button" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={()=>setVisible(!visible)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></label>
 <label className="auth-input"><LockKeyhole size={19}/><input name="confirm" type={visible ? 'text' : 'password'} aria-label="Confirmar nueva contraseña" placeholder="Confirmar nueva contraseña" required minLength={8} maxLength={72} autoComplete="new-password" disabled={busy}/></label>
 </> : <label className="auth-input"><Mail size={19}/><input name="email" type="email" aria-label="Correo electrónico" placeholder="Correo electrónico" required maxLength={254} autoComplete="email" disabled={busy}/></label>}
 <p role="alert" className="auth-message">{error}</p><button className="button primary auth-submit" disabled={busy}>{busy ? 'Procesando…' : reset ? 'Guardar contraseña' : 'Enviar enlace'}<ArrowRight size={18}/></button>
 </form>}
 {reset && !success && <p className="auth-switch"><Link to="/recuperar-contrasena">Solicitar otro enlace</Link></p>}
 <p className="auth-switch"><Link to="/iniciar-sesion"><ArrowLeft size={14}/> Volver a iniciar sesión</Link></p>
 </main></div>;
}
