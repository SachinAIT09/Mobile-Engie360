import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Fingerprint, LogIn } from 'lucide-react';
import { useI18n, type Lang } from '../lib/i18n';
import { checkLogin, signIn } from '../lib/session';
import { API, post } from '../api/client';
import { customer } from '../data/customer';
import { brand } from '../brand';

/** MijnENGIE sign-in, the first screen of the customer app (as in Hydro Mobile360's customer app). */
export default function Login() {
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  const enter = () => {
    signIn();
    // Tell staff (the live stream only opens once signed in, so send this one directly).
    post(API.activity, { kind: 'session' }).catch(() => undefined);
    navigate('/', { replace: true });
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (checkLogin(login, password)) enter();
    else setError(t(`Use the demo login: ${customer.email} with any password.`, `Gebruik de demo-login: ${customer.email} met een willekeurig wachtwoord.`));
  };

  return (
    <div className="login">
      <div className="login-hero">
        <div className="login-top">
          <span className="brand">
            <span className="brand-mark">{brand.name}</span>
            <span className="brand-sub">{brand.portal}</span>
          </span>
          <div className="lang" role="group" aria-label="Language / Taal">
            {(['nl', 'en'] as Lang[]).map((l) => (
              <button key={l} className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <span className="login-eyebrow">{t('Welcome back', 'Welkom terug')}</span>
        <h1>{t('Sign in to your energy.', 'Log in bij je energie.')}</h1>
      </div>

      <form className="login-card" onSubmit={submit} noValidate>
        <label className="field">
          {t('Email or customer number', 'E-mail of klantnummer')}
          <input className="input" type="text" inputMode="email" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} />
        </label>
        <label className="field">
          {t('Password', 'Wachtwoord')}
          <span className="login-pw">
            <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" className="icon-btn" onClick={() => setShow(!show)} aria-label={show ? t('Hide password', 'Verberg wachtwoord') : t('Show password', 'Toon wachtwoord')}>
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </span>
        </label>
        {error && (
          <p className="login-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary login-submit">
          <LogIn size={18} /> {t('Sign in', 'Inloggen')}
        </button>
        <button type="button" className="btn btn-outline login-submit" onClick={enter}>
          <Fingerprint size={18} /> {t('Sign in with Face ID / fingerprint', 'Inloggen met Face ID / vingerafdruk')}
        </button>
        <p className="login-hint">
          {t('Demo login:', 'Demo-login:')} <b>{customer.email}</b> {t('(or customer number', '(of klantnummer')} <b>{customer.customerNo}</b>
          {t('), any password', '), elk wachtwoord')}
        </p>
      </form>
      <p className="login-foot">{t(`Concept demo · Sample data · not connected to ${brand.name} systems`, `Conceptdemo · Voorbeelddata · niet gekoppeld aan ${brand.name}-systemen`)}</p>
    </div>
  );
}
