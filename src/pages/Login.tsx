import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Fingerprint, Lock, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { useI18n, type Lang } from '../lib/i18n';
import { checkLogin, signIn } from '../lib/session';
import { API, post } from '../api/client';
import { brand } from '../brand';

/**
 * MijnENGIE sign-in, the first screen of the customer app: a glass card over a slow-moving backdrop in the
 * brand colours. It is always dark (brand navy), whatever theme the app itself uses.
 */
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
    else setError(t('We don’t recognise that email address or customer number. Check it and try again.', 'We herkennen dit e-mailadres of klantnummer niet. Controleer het en probeer het opnieuw.'));
  };

  return (
    <div className="login">
      {/* Backdrop: slow-moving light in the brand colours behind the glass. Decorative only. */}
      <div className="login-bg" aria-hidden>
        <i className="glow g1" />
        <i className="glow g2" />
        <i className="glow g3" />
        <i className="login-grid" />
      </div>

      <header className="login-top">
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
      </header>

      <div className="login-head">
        <span className="login-eyebrow">{t('Welcome back', 'Welkom terug')}</span>
        <h1>
          {t('Sign in to your', 'Log in bij je')} <em>{t('energy', 'energie')}</em>.
        </h1>
        <p>{t('Your usage, bills and savings in one place.', 'Je verbruik, nota’s en besparingen op één plek.')}</p>
      </div>

      <form className="login-card" onSubmit={submit} noValidate>
        <label className="field">
          {t('Email or customer number', 'E-mail of klantnummer')}
          <span className="login-input">
            <Mail size={18} aria-hidden />
            <input className="input" type="text" inputMode="email" autoComplete="username" value={login} onChange={(e) => setLogin(e.target.value)} />
          </span>
        </label>
        <label className="field">
          {t('Password', 'Wachtwoord')}
          <span className="login-input">
            <Lock size={18} aria-hidden />
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
        <button type="submit" className="btn login-submit login-primary">
          <LogIn size={18} /> {t('Sign in', 'Inloggen')}
        </button>
        <span className="login-or" aria-hidden>
          {t('or', 'of')}
        </span>
        <button type="button" className="btn login-submit login-glass" onClick={enter}>
          <Fingerprint size={18} /> {t('Sign in with Face ID / fingerprint', 'Inloggen met Face ID / vingerafdruk')}
        </button>
        <p className="login-safe">
          <ShieldCheck size={14} aria-hidden /> {t('Your sign-in is encrypted and private.', 'Je login is versleuteld en privé.')}
        </p>
      </form>
      <p className="login-foot">{t(`© 2026 ${brand.name} Netherlands`, `© 2026 ${brand.name} Nederland`)}</p>
    </div>
  );
}
