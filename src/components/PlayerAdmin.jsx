import { useState } from 'react';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { C, createPlayerAccount, db } from '../firebase';
import { ROLES } from '../lib/constants';
import { errMsg, randomPassword, slugUser } from '../lib/utils';
import { Modal } from './ui';

// Ficha de jugador (perfil del plantel). id = uid de su cuenta.
export const playerProfile = ({ nick, name, role, username }) => ({
  nick: nick.trim(),
  name: (name || '').trim(),
  role,
  username,
  agents: '',
  strengths: '',
  improve: '',
  goals: [],
  active: true,
  createdAt: serverTimestamp(),
});

// Crea la cuenta de acceso, su usuario (rol player) y su ficha. Devuelve las credenciales.
export async function addPlayer({ nick, name, role, username, password }) {
  const user = username || slugUser(nick);
  const pass = password || randomPassword();
  const uid = await createPlayerAccount(user, pass);
  await setDoc(doc(db, C.users, uid), {
    username: user, name: (name || '').trim() || nick.trim(), nick: nick.trim(), role: 'player', active: true, createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, C.players, uid), playerProfile({ nick, name, role, username: user }));
  return { nick: nick.trim(), username: user, password: pass };
}

export async function setPlayerActive(id, active) {
  await updateDoc(doc(db, C.players, id), { active });
  await setDoc(doc(db, C.users, id), { role: 'player', active }, { merge: true });
}

export function AddPlayerForm({ onDone, onCancel }) {
  const [f, setF] = useState({ nick: '', name: '', role: ROLES[0], username: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!f.nick.trim()) return;
    setBusy(true);
    setError('');
    try {
      const u = f.username.trim().toLowerCase();
      const cred = await addPlayer({ ...f, username: u.includes('@') ? u : slugUser(u || f.nick) });
      onDone([cred]);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 20, maxWidth: 720 }}>
      <h2 className="d h2">Nuevo jugador</h2>
      <div className="form-grid">
        <label className="field"><span>Nick</span><input className="input" value={f.nick} onChange={set('nick')} required /></label>
        <label className="field"><span>Nombre</span><input className="input" value={f.name} onChange={set('name')} /></label>
        <label className="field"><span>Rol</span>
          <select className="select" value={f.role} onChange={set('role')}>
            {ROLES.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className="field"><span>Usuario de acceso</span><input className="input" value={f.username} onChange={set('username')} placeholder={slugUser(f.nick) || 'nick o email real'} /></label>
      </div>
      <p className="muted small" style={{ margin: 0 }}>Se genera una contraseña inicial que vas a ver una sola vez para pasársela al jugador.</p>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Creando…' : 'Guardar'}</button>
        <button type="button" className="btn" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}

export function CredentialsModal({ creds, onClose, title = 'Accesos creados' }) {
  const text = creds.map((c) => `${c.nick} · usuario: ${c.username} · contraseña: ${c.password}`).join('\n');
  const [copied, setCopied] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <p className="muted" style={{ margin: 0 }}>Copialos ahora: las contraseñas no se vuelven a mostrar. Cada jugador entra en la app con su usuario y contraseña.</p>
      <div className="stack" style={{ gap: 0 }}>
        {creds.map((c) => (
          <div key={c.username} className="kv">
            <strong>{c.nick}</strong>
            <span style={{ fontFamily: 'monospace' }}>{c.username} · {c.password}</span>
          </div>
        ))}
      </div>
      <div className="row">
        <button className="btn btn-light" onClick={() => { navigator.clipboard.writeText(text); setCopied(true); }}>{copied ? 'Copiado' : 'Copiar todo'}</button>
        <button className="btn" onClick={onClose}>Listo</button>
      </div>
    </Modal>
  );
}

export function RemovePlayer({ player, onRemoved }) {
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!ask) {
    return <button className="btn" style={{ padding: 0, alignSelf: 'flex-start' }} onClick={() => setAsk(true)}>Quitar del plantel</button>;
  }
  return (
    <div className="stack">
      <span style={{ lineHeight: 1.45 }}>¿Quitar a {player.nick} del plantel? Pierde el acceso; sus notas, tareas y stats quedan archivadas.</span>
      <div className="row">
        <button className="btn btn-danger" disabled={busy} onClick={async () => { setBusy(true); await setPlayerActive(player.id, false); setBusy(false); setAsk(false); onRemoved?.(); }}>Quitar</button>
        <button className="btn" onClick={() => setAsk(false)}>Cancelar</button>
      </div>
    </div>
  );
}
