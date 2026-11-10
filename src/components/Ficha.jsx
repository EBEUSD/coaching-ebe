import { useEffect, useMemo, useState } from 'react';
import { collection, doc, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { C, db } from '../firebase';
import { ROLES } from '../lib/constants';
import { shortDate, todayKey, useLive } from '../lib/utils';
import { Check, Icon, ICONS, Loading } from './ui';
import PlayerStats from './PlayerStats';

// editable: staff. canCheck: el propio jugador puede marcar sus tareas como hechas.
export default function Ficha({ playerId, editable, canCheck }) {
  const player = useLive(() => doc(db, C.players, playerId), [playerId]);
  const notes = useLive(() => query(collection(db, C.notes), where('playerId', '==', playerId)), [playerId]);
  const tasks = useLive(() => query(collection(db, C.tasks), where('playerId', '==', playerId)), [playerId]);
  const [tab, setTab] = useState('goals');

  const log = useMemo(() => (notes.data || []).filter((n) => n.note || n.focus).sort((a, b) => b.date.localeCompare(a.date)), [notes.data]);
  const tlist = useMemo(() => (tasks.data || []).slice().sort((a, b) => (a.done - b.done) || (a.due || '').localeCompare(b.due || '')), [tasks.data]);

  if (player.loading) return <Loading />;
  const p = player.data;
  if (!p) return <p className="empty">No se encontró el jugador.</p>;
  const done = tlist.filter((t) => t.done).length;
  const today = todayKey();

  return (
    <div className="stack" style={{ gap: 32 }}>
      <section className="card-cut row" style={{ background: 'radial-gradient(ellipse at 90% 0%, var(--vino) 0%, var(--raiz) 40%, var(--surface) 100%)', padding: '32px 40px', gap: '24px 32px' }}>
        <img src="/sot-isotipo.png" alt="" style={{ width: 96, height: 89, objectFit: 'contain' }} />
        <div className="stack" style={{ flex: '1 1 260px', gap: 10 }}>
          <span className="tag lbl" style={{ alignSelf: 'flex-start', background: 'var(--carmesi)', padding: '5px 14px', fontSize: 11 }}>{p.role}</span>
          <h1 className="d" style={{ fontSize: 'clamp(56px, 8vw, 80px)' }}>{p.nick}</h1>
          <span>{p.name}{p.agents ? ` · ${p.agents}` : ''}</span>
        </div>
        <div className="row" style={{ gap: 32 }}>
          <div className="stack" style={{ gap: 4 }}><span className="d" style={{ fontSize: 40 }}>{done}/{tlist.length}</span><span className="small">Tareas</span></div>
          <div className="stack" style={{ gap: 4 }}><span className="d" style={{ fontSize: 40 }}>{log.length}</span><span className="small">Notas</span></div>
        </div>
      </section>

      <div className="tabs" role="tablist">
        {[['goals', 'Objetivos'], ['notes', 'Notas'], ['tasks', 'Tareas'], ...(editable ? [['stats', 'Stats'], ['edit', 'Datos']] : [])].map(([id, l]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{l}</button>
        ))}
      </div>

      {tab === 'goals' && <Goals player={p} editable={editable} />}

      {tab === 'notes' && (
        <div>
          {log.length === 0 && <p className="empty">Todavía no hay notas.</p>}
          {log.map((n) => (
            <div key={n.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--line)' }}>
              <span className="muted small">{shortDate(n.date)} · {n.kind || 'Clase'}</span>
              <span className="stack" style={{ gap: 6 }}>
                {n.note && <span style={{ lineHeight: 1.5 }}>{n.note}</span>}
                {n.focus && <span style={{ fontWeight: 600, paddingLeft: 10, borderLeft: '3px solid var(--carmesi)' }}>Foco: {n.focus}</span>}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === 'tasks' && (
        <div>
          {tlist.length === 0 && <p className="empty">Sin tareas asignadas.</p>}
          {tlist.map((t) => {
            const late = !t.done && t.due && t.due < today;
            return (
              <div key={t.id} className="list-row">
                {editable || canCheck
                  ? <Check on={t.done} label={`Marcar cumplida: ${t.title}`} onClick={() => updateDoc(doc(db, C.tasks, t.id), { done: !t.done })} />
                  : <span className={`check${t.done ? ' on' : ''}`} aria-hidden="true">{t.done && <Icon d={ICONS.check} size={16} stroke={3} />}</span>}
                <span style={{ flex: 1, fontWeight: 600, color: t.done ? 'var(--muted)' : undefined, textDecoration: t.done ? 'line-through' : undefined }}>{t.title}</span>
                <span className="small" style={late ? { padding: '4px 10px', background: 'var(--carmesi)' } : { color: 'var(--muted)' }}>{late ? 'Vencida · ' : ''}{shortDate(t.due)}</span>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'stats' && editable && <PlayerStats playerId={playerId} />}
      {tab === 'edit' && editable && <EditData player={p} />}
    </div>
  );
}

function Goals({ player, editable }) {
  const [g, setG] = useState({ goals: player.goals || [], strengths: player.strengths || '', improve: player.improve || '' });
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setG({ goals: player.goals || [], strengths: player.strengths || '', improve: player.improve || '' }); }, [player]); // eslint-disable-line
  const patch = (p) => { setG((x) => ({ ...x, ...p })); setDirty(true); };
  const save = async () => { await updateDoc(doc(db, C.players, player.id), { ...g, updatedAt: serverTimestamp() }); setDirty(false); };

  if (!editable) {
    return (
      <div className="grid-auto" style={{ gap: 40 }}>
        <div>
          <span className="lbl muted" style={{ fontSize: 11 }}>Objetivos del mes</span>
          {g.goals.length === 0 && <p className="empty">Sin objetivos cargados.</p>}
          {g.goals.map((x, i) => (
            <div key={i} className="kv"><span style={{ fontWeight: 600 }}>{x.text}</span><span className="muted small">{x.done ? 'Cumplido' : 'En curso'}</span></div>
          ))}
        </div>
        <div className="stack" style={{ gap: 24 }}>
          <div className="stack" style={{ gap: 8 }}><span className="lbl muted" style={{ fontSize: 11 }}>Fortalezas</span><p style={{ margin: 0, lineHeight: 1.55 }}>{g.strengths || '—'}</p></div>
          <div className="stack" style={{ gap: 8 }}><span className="lbl muted" style={{ fontSize: 11 }}>A mejorar</span><p style={{ margin: 0, lineHeight: 1.55 }}>{g.improve || '—'}</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="grid-auto" style={{ gap: 40 }}>
        <div className="stack">
          <span className="lbl muted" style={{ fontSize: 11 }}>Objetivos del mes</span>
          {g.goals.map((x, i) => (
            <div key={i} className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
              <Check on={x.done} label="Cumplido" onClick={() => patch({ goals: g.goals.map((y, j) => (j === i ? { ...y, done: !y.done } : y)) })} />
              <input className="input" value={x.text} onChange={(e) => patch({ goals: g.goals.map((y, j) => (j === i ? { ...y, text: e.target.value } : y)) })} aria-label={`Objetivo ${i + 1}`} />
              <button className="icon-btn" onClick={() => patch({ goals: g.goals.filter((_, j) => j !== i) })} aria-label="Quitar objetivo"><Icon d={ICONS.trash} size={18} /></button>
            </div>
          ))}
          <button className="btn btn-dashed" style={{ alignSelf: 'flex-start' }} onClick={() => patch({ goals: [...g.goals, { text: '', done: false }] })}>+ Objetivo</button>
        </div>
        <div className="stack" style={{ gap: 20 }}>
          <label className="field"><span>Fortalezas</span><textarea className="textarea" value={g.strengths} onChange={(e) => patch({ strengths: e.target.value })} /></label>
          <label className="field"><span>A mejorar</span><textarea className="textarea" value={g.improve} onChange={(e) => patch({ improve: e.target.value })} /></label>
        </div>
      </div>
      <button className="btn btn-light" style={{ alignSelf: 'flex-start' }} onClick={save} disabled={!dirty}>{dirty ? 'Guardar cambios' : 'Guardado'}</button>
    </div>
  );
}

function EditData({ player }) {
  const [f, setF] = useState({ nick: player.nick, name: player.name || '', role: player.role, agents: player.agents || '' });
  const [saved, setSaved] = useState(true);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setSaved(false); };
  return (
    <div className="stack" style={{ gap: 20, maxWidth: 720 }}>
      <div className="form-grid">
        <label className="field"><span>Nick</span><input className="input" value={f.nick} onChange={set('nick')} /></label>
        <label className="field"><span>Nombre</span><input className="input" value={f.name} onChange={set('name')} /></label>
        <label className="field"><span>Rol</span><select className="select" value={f.role} onChange={set('role')}>{(ROLES.includes(f.role) ? ROLES : [f.role, ...ROLES]).map((r) => <option key={r}>{r}</option>)}</select></label>
        <label className="field"><span>Pool de agentes</span><input className="input" value={f.agents} onChange={set('agents')} placeholder="Jett, Raze, Neon" /></label>
      </div>
      <p className="muted small" style={{ margin: 0 }}>Usuario de acceso: <strong style={{ color: 'var(--blanco)' }}>{player.username}</strong>.</p>
      <button className="btn btn-light" style={{ alignSelf: 'flex-start' }} disabled={saved} onClick={async () => { await updateDoc(doc(db, C.players, player.id), f); setSaved(true); }}>{saved ? 'Guardado' : 'Guardar'}</button>
    </div>
  );
}
