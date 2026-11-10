import { useMemo, useState } from 'react';
import { collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { C, createPlayerAccount, db, setUsername, setUserPassword } from '../firebase';
import { useAuth } from '../auth';
import { ROLES } from '../lib/constants';
import { errMsg, randomPassword, slugUser, useLive } from '../lib/utils';
import { CredentialsModal, playerProfile } from '../components/PlayerAdmin';
import { Loading, Modal } from '../components/ui';

const APP_ROLES = [
  ['player', 'Jugador'],
  ['coach', 'Coach'],
  ['superadmin', 'Super admin'],
];
const roleLabel = Object.fromEntries(APP_ROLES);

export default function Admin() {
  const { user } = useAuth();
  const users = useLive(() => collection(db, C.users), []);
  const players = useLive(() => collection(db, C.players), []);
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [creds, setCreds] = useState(null);
  const [pwFor, setPwFor] = useState(null);
  const [pwCreds, setPwCreds] = useState(null);
  const [error, setError] = useState('');

  const playerById = useMemo(() => Object.fromEntries((players.data || []).map((p) => [p.id, p])), [players.data]);

  // Usuarios + jugadores cargados antes de existir el panel (sin documento de usuario).
  const rows = useMemo(() => {
    const list = (users.data || []).map((u) => ({ ...u, hasPlayer: !!playerById[u.id] }));
    const known = new Set(list.map((u) => u.id));
    (players.data || []).forEach((p) => {
      if (!known.has(p.id)) list.push({ id: p.id, username: p.username, name: p.name, nick: p.nick, role: 'player', active: p.active, hasPlayer: true, legacy: true });
    });
    return list
      .filter((u) => filter === 'all' || u.role === filter)
      .filter((u) => !q || `${u.username} ${u.name} ${u.nick || ''}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (b.active - a.active) || APP_ROLES.findIndex(([r]) => r === b.role) - APP_ROLES.findIndex(([r]) => r === a.role) || (a.username || '').localeCompare(b.username || ''));
  }, [users.data, players.data, playerById, filter, q]);

  const run = async (fn) => {
    setError('');
    try { await fn(); } catch (e) { setError(errMsg(e)); }
  };

  const changeRole = (row, role) => run(async () => {
    await setDoc(doc(db, C.users, row.id), {
      username: row.username || '', name: row.name || row.nick || '', nick: row.nick || '', role, active: row.active !== false,
    }, { merge: true });
    if (role === 'player') {
      if (playerById[row.id]) await updateDoc(doc(db, C.players, row.id), { active: row.active !== false });
      else await setDoc(doc(db, C.players, row.id), playerProfile({ nick: row.nick || row.name || row.username, name: row.name, role: ROLES[0], username: row.username }));
    } else if (playerById[row.id]) {
      await updateDoc(doc(db, C.players, row.id), { active: false });
    }
  });

  const setActive = (row, active) => run(async () => {
    await setDoc(doc(db, C.users, row.id), {
      username: row.username || '', name: row.name || row.nick || '', role: row.role, active,
    }, { merge: true });
    if (row.role === 'player' && playerById[row.id]) await updateDoc(doc(db, C.players, row.id), { active });
  });

  const counts = useMemo(() => {
    const c = { all: 0, player: 0, coach: 0, superadmin: 0 };
    (users.data || []).forEach((u) => { c.all++; c[u.role] = (c[u.role] || 0) + 1; });
    (players.data || []).forEach((p) => { if (!(users.data || []).find((u) => u.id === p.id)) { c.all++; c.player++; } });
    return c;
  }, [users.data, players.data]);

  return (
    <main className="page narrow">
      <div className="stack" style={{ gap: 8 }}>
        <h1 className="d h1">Admin</h1>
        <span className="muted">Usuarios, contraseñas y roles de SOT Coaching.</span>
      </div>

      <NewUser onCreated={setCreds} />

      <section className="divider stack" style={{ gap: 20 }}>
        <div className="row between">
          <div className="chips" role="tablist" aria-label="Filtrar por rol">
            {[['all', 'Todos'], ...APP_ROLES].map(([id, l]) => (
              <button key={id} role="tab" aria-selected={filter === id} className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>{l} · {counts[id] || 0}</button>
            ))}
          </div>
          <input className="input" style={{ maxWidth: 260 }} type="search" placeholder="Buscar usuario" aria-label="Buscar usuario" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {error && <p className="error">{error}</p>}
        {(users.loading || players.loading) && <Loading />}
        <div>
          {rows.map((u) => {
            const self = u.id === user.uid;
            return (
              <div key={u.id} className="list-row" style={{ flexWrap: 'wrap', opacity: u.active === false ? 0.6 : 1 }}>
                <span className="stack" style={{ flex: '1 1 220px', gap: 4, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, fontSize: 18 }}>{u.nick || u.name || u.username}{self && <span className="muted small"> · vos</span>}</span>
                  <span className="muted small" style={{ overflowWrap: 'anywhere' }}>{u.username}{u.name && u.nick ? ` · ${u.name}` : ''}{u.active === false ? ' · desactivado' : ''}</span>
                </span>
                <select className="select" style={{ width: 'auto', minWidth: 150 }} value={u.role} disabled={self} onChange={(e) => changeRole(u, e.target.value)} aria-label={`Rol de ${u.username}`}>
                  {APP_ROLES.map(([r, l]) => <option key={r} value={r}>{l}</option>)}
                </select>
                <button className="btn btn-ghost" style={{ minWidth: 110 }} onClick={() => setPwFor(u)}>Acceso</button>
                {self
                  ? <span className="muted small" style={{ minWidth: 110, textAlign: 'center' }}>Activo</span>
                  : <button className={`btn ${u.active === false ? 'btn-light' : 'btn-ghost'}`} style={{ minWidth: 110 }} onClick={() => setActive(u, u.active === false)}>{u.active === false ? 'Activar' : 'Desactivar'}</button>}
              </div>
            );
          })}
          {!users.loading && rows.length === 0 && <p className="empty">No hay usuarios con ese filtro.</p>}
        </div>
        <p className="muted small" style={{ margin: 0, lineHeight: 1.5 }}>
          Desactivar corta el acceso al instante y conserva todos los datos. Las contraseñas solo se ven al crearlas; si alguien la olvida, usá «Acceso» para ponerle una nueva o cambiarle el usuario.
        </p>
      </section>

      {creds && <CredentialsModal creds={creds} onClose={() => setCreds(null)} />}
      {pwFor && <AccessModal row={pwFor} onClose={() => setPwFor(null)} onDone={(c) => { setPwFor(null); setPwCreds(c); }} />}
      {pwCreds && <CredentialsModal title="Contraseña nueva" creds={pwCreds} onClose={() => setPwCreds(null)} />}
    </main>
  );
}

// Usuario de acceso y contraseña de una cuenta (Cloud Functions, solo super admin).
function AccessModal({ row, onClose, onDone }) {
  const [password, setPassword] = useState(randomPassword);
  const [username, setUsernameInput] = useState(row.username || '');
  const [current, setCurrent] = useState(row.username || '');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [userMsg, setUserMsg] = useState('');
  const who = row.nick || row.name || row.username;

  const saveUser = async (e) => {
    e.preventDefault();
    setError(''); setUserMsg('');
    const raw = username.trim().toLowerCase();
    if (!raw) { setError('Poné un usuario.'); return; }
    if (raw === current) { setUserMsg('Es el mismo usuario.'); return; }
    setBusy('user');
    try {
      const saved = await setUsername(row.id, raw);
      setCurrent(saved); setUsernameInput(saved);
      setUserMsg(`Listo: ahora entra con «${saved}».`);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy('');
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('La contraseña tiene que tener al menos 6 caracteres.'); return; }
    setBusy('pass');
    try {
      await setUserPassword(row.id, password);
      onDone([{ nick: who, username: current, password }]);
    } catch (err) {
      setError(errMsg(err));
      setBusy('');
    }
  };

  return (
    <Modal title={`Acceso de ${who}`} onClose={onClose}>
      <form onSubmit={saveUser} className="stack" style={{ gap: 12 }}>
        <label className="field"><span>Usuario</span>
          <span className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
            <input className="input" value={username} onChange={(e) => { setUsernameInput(e.target.value); setUserMsg(''); }} autoComplete="off" />
            <button className="btn btn-light" disabled={!!busy}>{busy === 'user' ? 'Guardando…' : 'Cambiar'}</button>
          </span>
        </label>
        <p className="muted small" style={{ margin: 0 }}>{userMsg || 'Con el usuario nuevo conserva su ficha, notas y tareas. El anterior deja de funcionar.'}</p>
      </form>
      <form onSubmit={submit} className="stack divider" style={{ gap: 20 }}>
        <p className="muted" style={{ margin: 0 }}>La contraseña actual deja de funcionar. Las sesiones abiertas siguen activas hasta que cierre sesión.</p>
        <label className="field"><span>Contraseña nueva</span>
          <span className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
            <input className="input" style={{ fontFamily: 'monospace' }} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" />
            <button type="button" className="btn" onClick={() => setPassword(randomPassword())}>Generar</button>
          </span>
        </label>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <div className="row">
          <button className="btn btn-primary" disabled={!!busy}>{busy === 'pass' ? 'Guardando…' : 'Cambiar contraseña'}</button>
          <button type="button" className="btn" onClick={onClose}>Cerrar</button>
        </div>
      </form>
    </Modal>
  );
}

function NewUser({ onCreated }) {
  const empty = () => ({ role: 'player', username: '', name: '', nick: '', rosterRole: ROLES[0], password: randomPassword() });
  const [f, setF] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const isPlayer = f.role === 'player';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const raw = (f.username || f.nick).trim().toLowerCase();
    const username = raw.includes('@') ? raw : slugUser(raw);
    if (!username) { setError('Poné un usuario.'); return; }
    if (f.password.length < 6) { setError('La contraseña tiene que tener al menos 6 caracteres.'); return; }
    if (isPlayer && !f.nick.trim()) { setError('Poné el nick del jugador.'); return; }
    setBusy(true);
    try {
      const name = f.name.trim() || f.nick.trim() || username;
      await createPlayerAccount(username, f.password, async (uid) => {
        await setDoc(doc(db, C.users, uid), {
          username, name, nick: f.nick.trim(), role: f.role, active: true, createdAt: serverTimestamp(),
        });
        if (isPlayer) {
          await setDoc(doc(db, C.players, uid), playerProfile({ nick: f.nick, name: f.name, role: f.rosterRole, username }));
        }
      });
      onCreated([{ nick: `${f.nick.trim() || name} (${roleLabel[f.role]})`, username, password: f.password }]);
      setF(empty());
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="panel stack" style={{ gap: 20, padding: 28 }}>
      <div className="row between">
        <h2 className="d h3">Nuevo usuario</h2>
        <div className="seg" role="radiogroup" aria-label="Rol">
          {APP_ROLES.map(([r, l]) => (
            <button key={r} type="button" role="radio" aria-checked={f.role === r} className={f.role === r ? 'on' : ''} onClick={() => setF({ ...f, role: r })}>{l}</button>
          ))}
        </div>
      </div>
      <div className="form-grid">
        {isPlayer && <label className="field"><span>Nick</span><input className="input" style={{ background: 'var(--negro)' }} value={f.nick} onChange={set('nick')} /></label>}
        <label className="field"><span>Nombre</span><input className="input" style={{ background: 'var(--negro)' }} value={f.name} onChange={set('name')} /></label>
        <label className="field"><span>Usuario o email</span><input className="input" style={{ background: 'var(--negro)' }} value={f.username} onChange={set('username')} placeholder={slugUser(f.nick) || 'usuario'} autoComplete="off" /></label>
        <label className="field"><span>Contraseña</span>
          <span className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
            <input className="input" style={{ background: 'var(--negro)', fontFamily: 'monospace' }} value={f.password} onChange={set('password')} autoComplete="off" />
            <button type="button" className="btn" onClick={() => setF({ ...f, password: randomPassword() })}>Generar</button>
          </span>
        </label>
        {isPlayer && (
          <label className="field"><span>Rol en el equipo</span>
            <select className="select" style={{ background: 'var(--negro)' }} value={f.rosterRole} onChange={set('rosterRole')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
          </label>
        )}
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {f.role === 'player' && 'Jugador: ve su ficha, el playbook y la biblioteca. Queda agregado al plantel.'}
        {f.role === 'coach' && 'Coach: usa toda la app (tablero, scrims, playbook, tareas, jugadores), sin este panel.'}
        {f.role === 'superadmin' && 'Super admin: todo lo del coach más este panel de usuarios.'}
      </p>
      {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
      <button className="btn btn-primary" style={{ alignSelf: 'flex-start', minHeight: 48 }} disabled={busy}>{busy ? 'Creando…' : 'Crear usuario'}</button>
    </form>
  );
}
