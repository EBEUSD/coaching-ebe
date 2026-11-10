import { useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { C, db } from '../firebase';
import { useAuth } from '../auth';
import { EVENT_KINDS } from '../lib/constants';
import { addDays, dayName, errMsg, shortDate, todayKey, useLive, weekStart } from '../lib/utils';
import { Icon, ICONS, Loading, Modal } from '../components/ui';

// La hora se carga en Argentina (UTC-3). México (UTC-6, sin horario de verano) va 3 horas atrás.
const MX_OFFSET_MIN = -3 * 60;
const pad = (n) => String(n).padStart(2, '0');
const toMx = (time) => {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + MX_OFFSET_MIN;
  const mins = ((total % 1440) + 1440) % 1440;
  return { time: `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`, prevDay: total < 0 };
};
// México con aclaración si cae el día anterior: "17:00" o "22:00 (día anterior)".
const mxLabel = (time) => {
  const mx = toMx(time);
  return mx ? `${mx.time}${mx.prevDay ? ' (día anterior)' : ''}` : '';
};
export default function Calendario() {
  const { staff } = useAuth();
  const today = todayKey();
  const [start, setStart] = useState(() => weekStart(today));
  const end = addDays(start, 6);
  const [open, setOpen] = useState(null); // evento existente o { date } para uno nuevo

  // Rango sobre un solo campo: no necesita índice compuesto.
  const events = useLive(() => query(collection(db, C.events), where('date', '>=', start), where('date', '<=', end)), [start]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(start, i)), [start]);
  const byDay = useMemo(() => {
    const m = {};
    (events.data || []).forEach((e) => { (m[e.date] ||= []).push(e); });
    Object.values(m).forEach((l) => l.sort((a, b) => (a.time || '99').localeCompare(b.time || '99')));
    return m;
  }, [events.data]);
  const thisWeek = start === weekStart(today);

  return (
    <main className="page">
      <section className="row between" style={{ gap: 20 }}>
        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn" onClick={() => setStart(addDays(start, -7))} aria-label="Semana anterior"><Icon d={ICONS.left} size={22} stroke={2.5} /></button>
          <div className="stack" style={{ gap: 6, minWidth: 260, textAlign: 'center' }}>
            <h1 className="d" style={{ fontSize: 48 }}>{shortDate(start)} – {shortDate(end)}</h1>
            <span className="muted small">
              {thisWeek ? 'Esta semana' : <button className="btn" style={{ minHeight: 0, padding: 0 }} onClick={() => setStart(weekStart(today))}>Ir a esta semana</button>}
            </span>
          </div>
          <button className="icon-btn" onClick={() => setStart(addDays(start, 7))} aria-label="Semana siguiente"><Icon d={ICONS.right} size={22} stroke={2.5} /></button>
        </div>
        {staff && <button className="btn btn-primary" onClick={() => setOpen({ date: thisWeek ? today : start })}>Nuevo evento</button>}
      </section>

      {events.loading && <Loading />}
      {events.error && <p className="error">{errMsg(events.error)}</p>}

      <div className="week">
        {days.map((d) => (
          <section key={d} className={`week-day${d === today ? ' today' : ''}`} aria-label={`${dayName(d)} ${shortDate(d)}`}>
            <div className="stack" style={{ gap: 2 }}>
              <span className="lbl muted" style={{ fontSize: 11 }}>{dayName(d).slice(0, 3)}{d === today ? ' · Hoy' : ''}</span>
              <span className="d" style={{ fontSize: 28 }}>{shortDate(d)}</span>
            </div>
            {(byDay[d] || []).map((e) => (
              <button key={e.id} className="event" onClick={() => setOpen(e)}>
                {e.time && <span className="small" style={{ fontWeight: 600 }}>{e.time} AR <span className="muted">· {mxLabel(e.time)} MX</span></span>}
                <span className="lbl muted" style={{ fontSize: 10 }}>{e.kind}</span>
                <span style={{ fontWeight: 600, lineHeight: 1.3 }}>{e.title || e.kind}</span>
              </button>
            ))}
            {staff && <button className="btn btn-dashed" style={{ marginTop: 'auto' }} onClick={() => setOpen({ date: d })} aria-label={`Agregar evento el ${dayName(d)} ${shortDate(d)}`}>+</button>}
            {!staff && !(byDay[d] || []).length && <span className="muted small">Libre</span>}
          </section>
        ))}
      </div>

      {open && (staff
        ? <EventForm key={open.id || open.date} event={open} onClose={() => setOpen(null)} />
        : <EventView event={open} onClose={() => setOpen(null)} />)}
    </main>
  );
}

function EventView({ event, onClose }) {
  return (
    <Modal title={event.title || event.kind} onClose={onClose}>
      <div className="stack" style={{ gap: 0 }}>
        <div className="kv"><span className="muted">Día</span><strong>{dayName(event.date)} {shortDate(event.date)}</strong></div>
        {event.time && <div className="kv"><span className="muted">Hora Argentina</span><strong>{event.time}</strong></div>}
        {event.time && <div className="kv"><span className="muted">Hora México</span><strong>{mxLabel(event.time)}</strong></div>}
        <div className="kv"><span className="muted">Tipo</span><strong>{event.kind}</strong></div>
      </div>
      {event.note && <p style={{ margin: 0, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{event.note}</p>}
      <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={onClose}>Cerrar</button>
    </Modal>
  );
}

function EventForm({ event, onClose }) {
  const isNew = !event.id;
  const [f, setF] = useState({
    date: event.date, time: event.time || '', kind: event.kind || EVENT_KINDS[0], title: event.title || '', note: event.note || '',
  });
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); onClose(); } catch (e) { setError(errMsg(e)); setBusy(false); }
  };
  const save = (e) => {
    e.preventDefault();
    if (!f.date) { setError('Elegí el día.'); return; }
    const data = { ...f, title: f.title.trim(), note: f.note.trim(), updatedAt: serverTimestamp() };
    run(() => (isNew
      ? addDoc(collection(db, C.events), { ...data, createdAt: serverTimestamp() })
      : updateDoc(doc(db, C.events, event.id), data)));
  };

  return (
    <Modal title={isNew ? 'Nuevo evento' : 'Editar evento'} onClose={onClose}>
      <form onSubmit={save} className="stack" style={{ gap: 20 }}>
        <div className="seg" style={{ flexWrap: 'wrap', alignSelf: 'flex-start' }} role="radiogroup" aria-label="Tipo">
          {EVENT_KINDS.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={f.kind === k} className={f.kind === k ? 'on' : ''} onClick={() => setF({ ...f, kind: k })}>{k}</button>
          ))}
        </div>
        <div className="form-grid">
          <label className="field"><span>Día</span><input className="input" type="date" value={f.date} onChange={set('date')} /></label>
          <label className="field"><span>Hora Argentina</span><input className="input" type="time" value={f.time} onChange={set('time')} /></label>
          <div className="field"><span>Hora México</span><div className="input" style={{ display: 'flex', alignItems: 'center', color: 'var(--muted)' }}>{f.time ? mxLabel(f.time) : '—'}</div></div>
        </div>
        <label className="field"><span>Título</span><input className="input" value={f.title} onChange={set('title')} placeholder={f.kind === 'Scrim' ? 'vs Rival · Mapa' : f.kind} /></label>
        <label className="field"><span>Nota</span><textarea className="textarea" value={f.note} onChange={set('note')} placeholder="Qué se va a trabajar, link del VOD, quiénes…" /></label>
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <div className="row between">
          <div className="row">
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button>
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          </div>
          {!isNew && (confirmDel
            ? <button type="button" className="btn btn-danger" disabled={busy} onClick={() => run(() => deleteDoc(doc(db, C.events, event.id)))}>Confirmar borrado</button>
            : <button type="button" className="btn btn-ghost" onClick={() => setConfirmDel(true)}>Borrar</button>)}
        </div>
      </form>
    </Modal>
  );
}
