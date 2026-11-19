import { useEffect, useState, type FormEvent } from 'react';

import { Link, useNavigate } from 'react-router-dom';

import { ArrowRight, AudioLines, Eye, EyeOff, Mail, LockKeyhole, UserRound } from 'lucide-react';

import { ApiError, request, type User } from './auth-api';

export function AuthHeader() { return <header className="header shell"><Link to="/" className="brand"><span className="brand-mark"><AudioLines /></span>sonic<span className="brand-light">ledger.</span></Link><nav><Link to="/#musica">Música</Link><Link to="/#dj">DJ con IA</Link><Link to="/#conciertos">Conciertos</Link></nav><Link className="header-login" to="/iniciar-sesion">Iniciar sesión</Link></header>; }

export function Auth({ register = false }: { register?: boolean }) {

 const navigate = useNavigate();

 const [visible, setVisible] = useState(false);

 const [busy, setBusy] = useState(false);

 const [message, setMessage] = useState('');

 const [remember, setRemember] = useState(false);

 async function submit(e: FormEvent<HTMLFormElement>) {

  e.preventDefault(); const form = new FormData(e.currentTarget); setMessage('');

  const email = String(form.get('email')).trim(); const password = String(form.get('password'));

  if (register && password !== form.get('confirm')) return setMessage('Las contraseñas no coinciden.');

  setBusy(true);

  try {

   if (register) { await request('register', { username: String(form.get('username')).trim(), email, password, acceptedTerms: form.get('terms') === 'on' }); navigate('/iniciar-sesion', { state: { registered: true } }); setMessage('Cuenta creada. Ya puedes iniciar sesión.'); }

   else {
    const res = await request<{ user: User; accessToken?: string }>('login', { email, password, remember });
    if (res?.accessToken) {
      localStorage.setItem('token', res.accessToken);
    }
    navigate('/inicio');
   }

  } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }

 }

 return <div className="auth-page"><AuthHeader />

 <main className={'auth-layout shell ' + (register ? 'auth-register' : '')}>

 {register && <div className="auth-listener"><img src="/images/sonic-listener.png" alt="Joven escuchando música con audífonos, iluminado en azul y rosa frente a un halo neón" fetchPriority="high" /></div>}

 <section className="auth-form"><h1>{register ? 'Crear cuenta' : 'Iniciar sesión'}</h1><p>{register ? 'Únete a Sonic Ledger y vive la música sin límites.' : 'Accede a tu universo musical'}</p>

 <form onSubmit={submit}>

 {register && <label className="auth-input"><UserRound size={19}/><input name="username" aria-label="Nombre de usuario" placeholder="Nombre de usuario" required minLength={2} maxLength={60} autoComplete="username" /></label>}

 <label className="auth-input"><Mail size={19}/><input name="email" aria-label="Correo electrónico" placeholder="Correo electrónico" type="email" required maxLength={254} autoComplete="email" /></label>

 <label className="auth-input"><LockKeyhole size={19}/><input name="password" aria-label="Contraseña" placeholder="Contraseña" type={visible ? 'text' : 'password'} required minLength={register ? 8 : 1} maxLength={72} autoComplete={register ? 'new-password' : 'current-password'}/><button type="button" aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'} onClick={()=>setVisible(!visible)}>{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></label>

 {register && <label className="auth-input"><LockKeyhole size={19}/><input name="confirm" aria-label="Confirmar contraseña" placeholder="Confirmar contraseña" type={visible ? 'text' : 'password'} required autoComplete="new-password"/></label>}

 <div className="auth-options"><label className="auth-check"><input type="checkbox" name={register ? 'terms' : 'remember'} required={register} checked={register ? undefined : remember} onChange={register ? undefined : e=>setRemember(e.target.checked)}/>{register ? 'Acepto los Términos y Condiciones y la Política de Privacidad' : 'Recordarme'}</label>{!register && <Link className="forgot-link" to="/recuperar-contrasena">¿Olvidaste tu contraseña?</Link>}</div>

 {!register && remember && <small>Recordaremos tu sesión durante una hora.</small>}

 <p role="status" className="auth-message">{message}</p><button className="button primary auth-submit" disabled={busy}>{busy ? 'Conectando…' : register ? 'Crear cuenta' : 'Iniciar sesión'}<ArrowRight size={19}/></button>

 </form><p className="auth-switch">{register ? '¿Ya tienes una cuenta?' : '¿Aún no tienes una cuenta?'} <Link to={register ? '/iniciar-sesion' : '/registro'} onClick={()=>setMessage('')}>{register ? 'Iniciar sesión' : 'Crear cuenta'}</Link></p></section>

 {!register && <div className="auth-art"><img src="/images/sonic-headphones.webp" alt="Audífonos premium con iluminación rosa, violeta y azul" /></div>}

 </main></div>;

}

export function Home() {
 const [user, setUser] = useState<User | null>(null); const [error, setError] = useState('');
 const navigate = useNavigate();
 useEffect(()=>{let active=true;request<User>('me').then(value=>{if(active)setUser(value);}).catch(e=>{if(active){if(e instanceof ApiError && e.status===401)navigate('/iniciar-sesion',{replace:true});else setError(e.message);}});return()=>{active=false;};},[navigate]);
 async function logout() { try { await request('logout', {}); } catch(e) {setError((e as Error).message);} finally { localStorage.removeItem('token'); navigate('/iniciar-sesion', {replace:true}); } }
 return <main className="access-page"><section className="access-card"><AudioLines/><h1>{user ? 'Sesión iniciada' : 'Comprobando sesión…'}</h1><p>Bienvenido{user ? ', ' + user.username : ''}. Tu espacio musical estará disponible en el próximo sprint.</p><p role="status">{error}</p><button className="button primary" onClick={()=>{void logout();}}>Cerrar sesión</button></section></main>;
}
