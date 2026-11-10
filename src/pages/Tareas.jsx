import { useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { C, db } from '../firebase';
import { TASK_KINDS } from '../lib/constants';
import { addDays, byNick, shortDate, todayKey, useLive } from '../lib/utils';
import { Check, Icon, ICONS, Loading, Modal } from '../components/ui';

export default function Tareas() {
  const tasks = useLive(() => collection(db, C.tasks), []);
  const players = useLive(() => collection(db, C.players), []);
  const [tab, setTab] = useState('open');
  const [who, setWho] = useState('');
  const [open, setOpen] = useState(false);

  const nick = useMemo(() => Object.fromEntries((players.data || []).map((p) => [p.id, p.nick])), [players.data]);
  const active = useMemo(() => (players.data || []).filter((p) => p.active).sort(byNick), [players.data]);
  const byWho = (tasks.data || []).filter((t) => !who || t.playerId === who);
  const openN = byWho.filter((t) => !t.done).length;
  const list = byWho
    .filter((t) => (tab === 'open' ? !t.done : t.done))
    .sort((a, b) => (tab === 'open' ? (a.due || '').localeCompare(b.due || '') : (b.due || '').localeCompare(a.due || '')));
  const today = todayKey();

  return (
    <main className="page narrow">
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <h1 className="d h1">Tareas</h1>
        <button className="btn btn-primary" style={{ minHeight: 48 }} onClick={() => setOpen(true)}>+ Asignar</button>
      </div>

      <div className="row between">
        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'open'} className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>Pendientes · {openN}</button>
          <button role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>Cumplidas · {byWho.length - openN}</button>
        </div>
        <label className="row" style={{ gap: 10 }}>
          <span className="muted">Jugador</span>
          <select className="select" style={{ width: 'auto' }} value={who} onChange={(e) => setWho(e.target.value)}>
            <option value="">Todos</option>
            {active.map((p) => <option key={p.id} value={p.id}>{p.nick}</option>)}
          </select>
        </label>
      </div>

      <div>
        {tasks.loading && <Loading />}
        {!tasks.loading && list.length === 0 && <p className="empty">No hay tareas en esta vista.</p>}
        {list.map((t) => {
          const late = !t.done && t.due && t.due < today;
          return (
            <div key={t.id} className="list-row">
              <Check on={t.done} label={`Marcar cumplida: ${t.title}`} onClick={() => updateDoc(doc(db, C.tasks, t.id), { done: !t.done })} />
              <span className="stack" style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 18, color: t.done ? 'var(--muted)' : undefined, textDecoration: t.done ? 'line-through' : undefined }}>{t.title}</span>
                <span className="muted small">{nick[t.playerId] || '—'} · {t.kind}</span>
              </span>
              <span style={{ fontWeight: 600, fontSize: 15, whiteSpace: 'nowrap', ...(late ? { padding: '4px 10px', background: 'var(--carmesi)' } : { color: 'var(--muted)' }) }}>
                {late ? `Vencida · ${shortDate(t.due)}` : shortDate(t.due)}
              </span>
              <button className="icon-btn" onClick={() => window.confirm('¿Borrar tarea?') && deleteDoc(doc(db, C.tasks, t.id))} aria-label={`Borrar ${t.title}`}><Icon d={ICONS.trash} size={18} /></button>
            </div>
          );
        })}
      </div>

      {open && <NewTask players={active} defaultWho={who} onClose={() => setOpen(false)} />}
    </main>
  );
}

function NewTask({ players, defaultWho, onClose }) {
  const [f, setF] = useState({ title: '', playerId: defaultWho || 'all', kind: TASK_KINDS[0], due: addDays(todayKey(), 2) });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const ids = f.playerId === 'all' ? players.map((p) => p.id) : [f.playerId];
    await Promise.all(ids.map((playerId) => addDoc(collection(db, C.tasks), {
      playerId, title: f.title.trim(), kind: f.kind, due: f.due, done: false, createdAt: serverTimestamp(),
    })));
    onClose();
  };

  return (
    <Modal title="Asignar tarea" onClose={onClose}>
      <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
        <label className="field"><span>Tarea</span><input className="input" value={f.title} onChange={set('title')} required /></label>
        <div className="form-grid">
          <label className="field"><span>Jugador</span>
            <select className="select" value={f.playerId} onChange={set('playerId')}>
              <option value="all">Todo el plantel</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.nick}</option>)}
            </select>
          </label>
          <label className="field"><span>Tipo</span><select className="select" value={f.kind} onChange={set('kind')}>{TASK_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
          <label className="field"><span>Vence</span><input className="input" type="date" value={f.due} onChange={set('due')} /></label>
        </div>
        <div className="row">
          <button className="btn btn-primary" disabled={busy}>Asignar</button>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        </div>
      </form>
    </Modal>
  );
}
