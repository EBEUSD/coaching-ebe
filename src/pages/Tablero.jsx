import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { addDoc, collection, doc, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { C, db } from '../firebase';
import { addDays, byNick, dayName, dayTitle, todayKey, useLive } from '../lib/utils';
import { AddPlayerForm, CredentialsModal, RemovePlayer } from '../components/PlayerAdmin';
import { Check, Icon, ICONS } from '../components/ui';

export default function Tablero() {
  const [day, setDay] = useState(todayKey());
  const [selId, setSelId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [creds, setCreds] = useState(null);

  const players = useLive(() => query(collection(db, C.players), where('active', '==', true)), []);
  const dayDoc = useLive(() => doc(db, C.days, day), [day]);
  const notes = useLive(() => query(collection(db, C.notes), where('date', '==', day)), [day]);
  const tasks = useLive(() => query(collection(db, C.tasks), where('done', '==', false)), []);
  const library = useLive(() => collection(db, C.library), []);
  const scrims = useLive(() => query(collection(db, C.scrims), where('date', '==', day)), [day]);

  const roster = useMemo(() => (players.data || []).slice().sort(byNick), [players.data]);
  const noteBy = useMemo(() => Object.fromEntries((notes.data || []).map((n) => [n.playerId, n])), [notes.data]);
  const tasksBy = useMemo(() => {
    const m = {};
    (tasks.data || []).forEach((t) => { (m[t.playerId] ||= []).push(t); });
    return m;
  }, [tasks.data]);

  const sel = roster.find((p) => p.id === selId) || roster[0];
  const theory = (library.data || []).find((l) => l.id === dayDoc.data?.theoryId);
  const scrim = (scrims.data || [])[0];
  const isToday = day === todayKey();

  const saveDay = (patch) => setDoc(doc(db, C.days, day), { ...patch, updatedAt: serverTimestamp() }, { merge: true });

  return (
    <main className="page">
      <section className="row between" style={{ gap: 20 }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn" onClick={() => setDay(addDays(day, -1))} aria-label="Día anterior"><Icon d={ICONS.left} size={22} stroke={2.5} /></button>
          <div className="stack" style={{ gap: 6, minWidth: 240, textAlign: 'center' }}>
            <h1 className="d" style={{ fontSize: 56 }}>{dayTitle(day)}</h1>
            <span className="muted small">{isToday ? 'Hoy' : dayName(day)}{!isToday && <> · <button className="btn" style={{ minHeight: 0, padding: 0 }} onClick={() => setDay(todayKey())}>Ir a hoy</button></>}</span>
          </div>
          <button className="icon-btn" onClick={() => setDay(addDays(day, 1))} aria-label="Día siguiente"><Icon d={ICONS.right} size={22} stroke={2.5} /></button>
        </div>
        <div className="row">
          <label className="panel stack" style={{ gap: 4, padding: '10px 16px', minWidth: 240 }}>
            <span className="lbl muted" style={{ fontSize: 11 }}>Teórico del día</span>
            <select className="select" style={{ minHeight: 32, padding: 0, background: 'transparent', fontWeight: 600 }} value={dayDoc.data?.theoryId || ''} onChange={(e) => saveDay({ theoryId: e.target.value })}>
              <option value="">Sin teórico</option>
              {(library.data || []).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </label>
          {theory?.url && <a className="btn btn-ghost" href={theory.url} target="_blank" rel="noreferrer">Abrir</a>}
          <Link to="/scrims" className="panel stack" style={{ gap: 4, padding: '10px 16px', minWidth: 160 }}>
            <span className="lbl muted" style={{ fontSize: 11 }}>Scrim{scrim ? ` · ${scrim.map}` : ''}</span>
            <span style={{ fontWeight: 600 }}>{scrim ? `${score(scrim)} vs ${scrim.rival || '—'}` : 'Sin scrim'}</span>
          </Link>
        </div>
      </section>

      <section className="stack" style={{ gap: 16 }}>
        <h2 className="lbl muted" style={{ margin: 0 }}>Jugadores · {roster.length}</h2>
        <div className="player-grid">
          {roster.map((p) => {
            const n = (tasksBy[p.id] || []).length;
            return (
              <button key={p.id} className={`player-card${!adding && sel?.id === p.id ? ' on' : ''}`} onClick={() => { setSelId(p.id); setAdding(false); }}>
                <span className="lbl muted" style={{ fontSize: 11 }}>{p.role}</span>
                <span className="d" style={{ fontSize: 30 }}>{p.nick}</span>
                <span className="meta">{noteBy[p.id]?.note ? 'Con nota' : 'Sin nota'} · {n === 0 ? 'sin tareas' : `${n} ${n === 1 ? 'tarea' : 'tareas'}`}</span>
              </button>
            );
          })}
          <button className="add-card" onClick={() => setAdding(true)}>
            <span className="d" style={{ fontSize: 36 }}>+</span>
            <span className="lbl" style={{ fontSize: 11 }}>Agregar jugador</span>
          </button>
        </div>
        {players.loading && <p className="empty">Cargando plantel…</p>}
        {!players.loading && roster.length === 0 && !adding && (
          <p className="empty">Todavía no hay jugadores. Agregalos acá o cargá el plantel inicial desde <Link to="/jugadores" style={{ textDecoration: 'underline' }}>Jugadores</Link>.</p>
        )}
      </section>

      {adding && (
        <section className="divider">
          <AddPlayerForm
            onCancel={() => setAdding(false)}
            onDone={(c) => { setCreds(c); setAdding(false); }}
          />
        </section>
      )}

      {!adding && sel && (
        <PlayerDay key={`${sel.id}_${day}`} player={sel} day={day} note={noteBy[sel.id]} tasks={tasksBy[sel.id] || []} />
      )}

      <section className="divider stack" style={{ maxWidth: 820 }}>
        <span className="lbl muted" style={{ fontSize: 11 }}>Notas del equipo</span>
        <TeamNotes key={day} value={dayDoc.data?.teamNotes || ''} onSave={(teamNotes) => saveDay({ teamNotes })} />
      </section>

      {creds && <CredentialsModal creds={creds} onClose={() => setCreds(null)} />}
    </main>
  );
}

export const score = (s) => {
  const r = s.rounds || [];
  const w = r.filter((x) => x.r === 'W').length;
  return `${w}–${r.length - w}`;
};

function TeamNotes({ value, onSave }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <textarea className="textarea" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== value && onSave(v)} placeholder="Cómo estuvo el día, qué se habló en grupo…" />
  );
}

function PlayerDay({ player, day, note, tasks }) {
  const [draft, setDraft] = useState({ note: note?.note || '', focus: note?.focus || '' });
  const [saved, setSaved] = useState(true);
  const [newTask, setNewTask] = useState('');
  useEffect(() => { if (saved) setDraft({ note: note?.note || '', focus: note?.focus || '' }); }, [note]); // eslint-disable-line

  const set = (k) => (e) => { setDraft({ ...draft, [k]: e.target.value }); setSaved(false); };
  const save = async () => {
    await setDoc(doc(db, C.notes, `${day}_${player.id}`), {
      date: day, playerId: player.id, note: draft.note, focus: draft.focus, kind: 'Clase', updatedAt: serverTimestamp(),
    }, { merge: true });
    setSaved(true);
  };
  const addTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    await addDoc(collection(db, C.tasks), {
      playerId: player.id, title: newTask.trim(), kind: 'Teórico', due: addDays(day, 2), done: false, createdAt: serverTimestamp(),
    });
    setNewTask('');
  };

  return (
    <section className="grid-auto divider" style={{ gap: 40 }}>
      <div className="stack" style={{ gap: 20 }}>
        <div className="row" style={{ alignItems: 'baseline', gap: 14 }}>
          <h2 className="d h2">{player.nick}</h2>
          <span className="muted">{player.name} · {player.role}</span>
        </div>
        <label className="field"><span>Nota de la clase</span>
          <textarea className="textarea" value={draft.note} onChange={set('note')} placeholder="Qué trabajó, qué viste, qué tiene que corregir…" />
        </label>
        <label className="field"><span>Foco</span>
          <input className="input" value={draft.focus} onChange={set('focus')} placeholder="Una sola cosa para el próximo entrenamiento" />
        </label>
        <div className="row">
          <button className="btn btn-light" onClick={save} disabled={saved}>{saved ? 'Guardado' : 'Guardar nota'}</button>
          <Link className="btn" to={`/jugadores?id=${player.id}`}>Ver ficha</Link>
        </div>
      </div>
      <div className="stack">
        <span className="lbl muted" style={{ fontSize: 11 }}>Tareas abiertas</span>
        {tasks.length === 0 && <p className="muted" style={{ margin: 0 }}>Sin tareas pendientes.</p>}
        {tasks.map((t) => (
          <div key={t.id} className="panel row" style={{ padding: '6px 12px', gap: 8 }}>
            <Check on={false} label={`Marcar cumplida: ${t.title}`} onClick={() => updateDoc(doc(db, C.tasks, t.id), { done: true })} />
            <span style={{ flex: 1 }}>{t.title}</span>
          </div>
        ))}
        <form onSubmit={addTask} className="row" style={{ flexWrap: 'nowrap' }}>
          <input className="input" value={newTask} onChange={(e) => setNewTask(e.target.value)} placeholder="Nueva tarea" aria-label="Nueva tarea" />
          <button className="btn btn-ghost">Agregar</button>
        </form>
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
          <RemovePlayer player={player} />
        </div>
      </div>
    </section>
  );
}
