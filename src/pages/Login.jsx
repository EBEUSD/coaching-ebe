import { useState } from 'react';
import { useAuth } from '../auth';
import { errMsg } from '../lib/utils';

export default function Login() {
  const { login } = useAuth();
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(user, pass);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <form onSubmit={submit}>
        <img src="/sot-isotipo.png" alt="Storm of Thorns" width="96" style={{ alignSelf: 'center' }} />
        <div className="stack" style={{ alignItems: 'center', gap: 8 }}>
          <h1 className="d h2">SOT Coaching</h1>
          <span className="muted">Nadie sale ileso.</span>
        </div>
        <label className="field"><span>Usuario o email</span>
          <input className="input" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" required />
        </label>
        <label className="field"><span>Contraseña</span>
          <input className="input" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <button className="btn btn-primary" style={{ minHeight: 52 }} disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div>
  );
}
