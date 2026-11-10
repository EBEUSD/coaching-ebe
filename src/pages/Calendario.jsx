import { useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { C, db } from '../firebase';
import { useAuth } from '../auth';
import { EVENT_KINDS } from '../lib/constants';
import { addDays, dayName, errMsg, shortDate, todayKey, useLive, weekStart } from '../lib/utils';
import { Icon, ICONS, Loading, Modal } from '../components/ui';

// Se guarda en hora de Argentina (UTC-3). México (UTC-6, sin horario de verano) va 3 horas atrás.
const MX_OFFSET_MIN = -3 * 60;
const pad = (n) => String(n).padStart(2, '0');
// Corre una hora "HH:MM" y dice si cambia de día (-1, 0 o 1).
const shift = (time, delta) => {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + delta;
  const mins = ((total % 1440) + 1440) % 1440;
  return { time: `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`, day: Math.floor(total / 1440) };
};
const toMx = (ar) => {
  if (!ar) return null;
  const r = shift(ar, MX_OFFSET_MIN);
  return { time: r.time, prevDay: r.day < 0 };
};
const fromMx = (mx) => shift(mx, -MX_OFFSET_MIN);
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

// Hora con minutos de a 15 (00, 15, 30, 45). Si un evento viejo tiene otro minuto, se conserva como opción.
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = ['00', '15', '30', '45'];
function TimeSelect({ value, onChange, label }) {
  const [h, m] = value ? value.split(':') : ['', ''];
  const mins = m && !MINUTES.includes(m) ? [...MINUTES, m].sort() : MINUTES;
  const change = (nh, nm) => onChange(nh === '' ? '' : `${nh}:${nm || '00'}`);
  return (
    <span className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
      <select className="select" value={h} onChange={(e) => change(e.target.value, m)} aria-label={`Hora ${label}`}>
        <option value="">--</option>
        {HOURS.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <span aria-hidden="true">:</span>
      <select className="select" value={m} disabled={!h} onChange={(e) => change(h, e.target.value)} aria-label={`Minutos ${label}`}>
        {!h && <option value="">--</option>}
        {mins.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    </span>
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
  // Se puede cargar la hora en cualquiera de las dos zonas; el "Día" es el de la zona que cargaste.
  const [zone, setZone] = useState('ar');
  const [mx, setMx] = useState(() => toMx(event.time)?.time || '');
  // Al pasar de una zona a la otra, el "Día" también se convierte para que siga siendo el mismo momento.
  const setAr = (v) => {
    const date = zone === 'mx' && mx && f.date ? addDays(f.date, fromMx(mx).day) : f.date;
    setF({ ...f, date, time: v }); setMx(v ? toMx(v).time : ''); setZone('ar');
  };
  const setMxTime = (v) => {
    const date = zone === 'ar' && f.time && f.date && toMx(f.time).prevDay ? addDays(f.date, -1) : f.date;
    setMx(v); setF({ ...f, date, time: v ? fromMx(v).time : '' }); setZone('mx');
  };
  const arDayShift = zone === 'mx' && mx ? fromMx(mx).day : 0; // MX tarde → en AR ya es el día siguiente
  const arDate = f.date && arDayShift ? addDays(f.date, arDayShift) : f.date;
  const crossNote = !f.time ? ''
    : zone === 'mx' ? (arDayShift ? `En Argentina es el día siguiente: se guarda el ${shortDate(arDate)} a las ${f.time}.` : '')
      : (toMx(f.time).prevDay ? 'En México es el día anterior.' : '');

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); onClose(); } catch (e) { setError(errMsg(e)); setBusy(false); }
  };
  const save = (e) => {
    e.preventDefault();
    if (!f.date) { setError('Elegí el día.'); return; }
    const data = { ...f, date: arDate, title: f.title.trim(), note: f.note.trim(), updatedAt: serverTimestamp() };
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
          <label className="field"><span>Día ({zone === 'mx' ? 'México' : 'Argentina'})</span><input className="input" type="date" value={f.date} onChange={set('date')} /></label>
          <div className="field"><span>Hora Argentina</span><TimeSelect value={f.time} onChange={setAr} label="Argentina" /></div>
          <div className="field"><span>Hora México</span><TimeSelect value={mx} onChange={setMxTime} label="México" /></div>
        </div>
        {crossNote && <p className="muted small" style={{ margin: 0 }}>{crossNote}</p>}
        <label className="field"><span>Título</span><input className="input" value={f.title} onChange={set('title')} placeholder={f.kind === 'Scrim' ? 'vs Rival · Mapa' : f.kind === 'Torneo' ? 'Nombre del torneo · fase' : f.kind} /></label>
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
