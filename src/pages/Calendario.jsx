import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDoc, collection, deleteDoc, doc, documentId, getDocs, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from 'firebase/firestore';
import { C, db } from '../firebase';
import { useAuth } from '../auth';
import { EVENT_KINDS, MAPS } from '../lib/constants';
import { createScrim } from '../lib/scrims';
import { addDays, dayName, errMsg, fromKey, score, shortDate, todayKey, useLive, weekStart } from '../lib/utils';
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
  const [notesFor, setNotesFor] = useState(null); // fecha cuyas notas del equipo se editan

  // Rango sobre un solo campo: no necesita índice compuesto.
  const events = useLive(() => query(collection(db, C.events), where('date', '>=', start), where('date', '<=', end)), [start]);
  // Scrims cargados esa semana (solo staff: sot_scrims es solo staff).
  const scrims = useLive(() => (staff ? query(collection(db, C.scrims), where('date', '>=', start), where('date', '<=', end)) : null), [start, staff]);
  const scrimById = useMemo(() => Object.fromEntries((scrims.data || []).map((s) => [s.id, s])), [scrims.data]);
  const linked = useMemo(() => new Set((events.data || []).map((e) => e.scrimId).filter(Boolean)), [events.data]);
  const scrimsByDay = useMemo(() => {
    const m = {};
    (scrims.data || []).filter((s) => !linked.has(s.id)).forEach((s) => { (m[s.date] ||= []).push(s); });
    return m;
  }, [scrims.data, linked]);
  // Notas del equipo (sot_days/{fecha}, solo staff). El id es la fecha: rango sobre documentId, sin índice.
  const dayDocs = useLive(() => (staff ? query(collection(db, C.days), where(documentId(), '>=', start), where(documentId(), '<=', end)) : null), [start, staff]);
  const teamNotes = useMemo(() => Object.fromEntries((dayDocs.data || []).filter((x) => x.teamNotes).map((x) => [x.id, x.teamNotes])), [dayDocs.data]);
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
                <span style={{ fontWeight: 600, lineHeight: 1.3 }}>{eventTitle(e)}</span>
                {(e.map || scrimById[e.scrimId] || e.libraryId) && (
                  <span className="muted small">{[e.map, scrimById[e.scrimId] && score(scrimById[e.scrimId]), e.libraryId && 'Con material'].filter(Boolean).join(' · ')}</span>
                )}
              </button>
            ))}
            {(scrimsByDay[d] || []).map((s) => (
              <Link key={s.id} className="event event-scrim" to={`/scrims?id=${s.id}`}>
                <span className="lbl muted" style={{ fontSize: 10 }}>Scrim cargado · {s.map}</span>
                <span style={{ fontWeight: 600, lineHeight: 1.3 }}>{score(s)} vs {s.rival || 'Sin rival'}</span>
              </Link>
            ))}
            {teamNotes[d] && (
              <button className="event event-note" onClick={() => setNotesFor(d)}>
                <span className="lbl muted" style={{ fontSize: 10 }}>Notas del equipo</span>
                <span className="clamp">{teamNotes[d]}</span>
              </button>
            )}
            {staff && (
              <div className="day-actions">
                <button className="btn btn-dashed" onClick={() => setOpen({ date: d })} aria-label={`Agregar evento el ${dayName(d)} ${shortDate(d)}`}>+ Evento</button>
                {!teamNotes[d] && <button className="btn btn-dashed" onClick={() => setNotesFor(d)} aria-label={`Notas del equipo del ${dayName(d)} ${shortDate(d)}`}>Notas</button>}
              </div>
            )}
            {!(byDay[d] || []).length && !(scrimsByDay[d] || []).length && !staff && <span className="muted small">Libre</span>}
          </section>
        ))}
      </div>

      {open && (staff
        ? <EventForm key={open.id || open.date} event={open} onClose={() => setOpen(null)} />
        : <EventView event={open} onClose={() => setOpen(null)} />)}
      {notesFor && <TeamNotesModal key={notesFor} date={notesFor} value={teamNotes[notesFor] || ''} onClose={() => setNotesFor(null)} />}
    </main>
  );
}

function TeamNotesModal({ date, value, onClose }) {
  const [v, setV] = useState(value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await setDoc(doc(db, C.days, date), { teamNotes: v.trim(), updatedAt: serverTimestamp() }, { merge: true });
      onClose();
    } catch (err) { setError(errMsg(err)); setBusy(false); }
  };
  return (
    <Modal title={`Notas del equipo · ${dayName(date).slice(0, 3)} ${shortDate(date)}`} onClose={onClose}>
      <form onSubmit={save} className="stack" style={{ gap: 20 }}>
        <textarea className="textarea" style={{ minHeight: 200 }} value={v} onChange={(e) => setV(e.target.value)} placeholder="Cómo estuvo el día, qué se habló en grupo…" autoFocus />
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}
        <div className="row">
          <button className="btn btn-primary" disabled={busy || v === value}>{busy ? 'Guardando…' : 'Guardar'}</button>
          <button type="button" className="btn" onClick={onClose}>Cancelar</button>
        </div>
        <p className="muted small" style={{ margin: 0 }}>Solo las ve el staff. Para borrarlas, dejá el texto vacío y guardá.</p>
      </form>
    </Modal>
  );
}

// Nombre que se muestra: el título, o "vs Rival" en un scrim sin título, o el tipo.
export const eventTitle = (e) => e.title || (e.kind === 'Scrim' && e.rival ? `vs ${e.rival}` : e.kind);

// Material de la Biblioteca asociado a un evento (lo leen staff y jugadores).
function Material({ id }) {
  const item = useLive(() => (id ? doc(db, C.library, id) : null), [id]);
  if (!id || item.loading) return null;
  if (!item.data) return <div className="kv"><span className="muted">Material</span><span className="muted">No disponible</span></div>;
  return (
    <div className="kv" style={{ alignItems: 'center' }}>
      <span className="muted">Material</span>
      <span className="row" style={{ gap: 12, justifyContent: 'flex-end' }}>
        <strong>{item.data.title}</strong>
        {item.data.url && <a className="btn btn-light" href={item.data.url} target="_blank" rel="noreferrer">Abrir</a>}
      </span>
    </div>
  );
}

function EventView({ event, onClose }) {
  return (
    <Modal title={eventTitle(event)} onClose={onClose}>
      <div className="stack" style={{ gap: 0 }}>
        <div className="kv"><span className="muted">Día</span><strong>{dayName(event.date)} {shortDate(event.date)}</strong></div>
        {event.time && <div className="kv"><span className="muted">Hora Argentina</span><strong>{event.time}</strong></div>}
        {event.time && <div className="kv"><span className="muted">Hora México</span><strong>{mxLabel(event.time)}</strong></div>}
        <div className="kv"><span className="muted">Tipo</span><strong>{event.kind}</strong></div>
        {event.rival && <div className="kv"><span className="muted">Rival</span><strong>{event.rival}</strong></div>}
        {event.map && <div className="kv"><span className="muted">Mapa</span><strong>{event.map}</strong></div>}
        <Material id={event.libraryId} />
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
    <div className="time-select">
      <select className="select" value={h} onChange={(e) => change(e.target.value, m)} aria-label={`Hora ${label}`}>
        <option value="">--</option>
        {HOURS.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <i aria-hidden="true">:</i>
      <select className="select" value={m} disabled={!h} onChange={(e) => change(h, e.target.value)} aria-label={`Minutos ${label}`}>
        {!h && <option value="">--</option>}
        {mins.map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
    </div>
  );
}

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const weekdayOf = (k) => (fromKey(k).getDay() + 6) % 7; // 0 = lunes

function EventForm({ event, onClose }) {
  const navigate = useNavigate();
  const isNew = !event.id;
  const [f, setF] = useState({
    date: event.date, time: event.time || '', kind: event.kind || EVENT_KINDS[0], title: event.title || '', note: event.note || '',
    libraryId: event.libraryId || '', rival: event.rival || '', map: event.map || '',
  });
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState('');
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const library = useLive(() => collection(db, C.library), []);
  const players = useLive(() => query(collection(db, C.players), where('active', '==', true)), []);
  const isScrim = f.kind === 'Scrim';

  // Repetir (solo al crear): días de la semana y cantidad de semanas.
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState(() => [weekdayOf(event.date)]);
  const [weeks, setWeeks] = useState(4);

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
  const toAr = (d) => (d && arDayShift ? addDays(d, arDayShift) : d);
  const arDate = toAr(f.date);
  const crossNote = !f.time ? ''
    : zone === 'mx' ? (arDayShift ? `En Argentina es el día siguiente: se guarda el ${shortDate(arDate)} a las ${f.time}.` : '')
      : (toMx(f.time).prevDay ? 'En México es el día anterior.' : '');

  // Fechas de la serie (en la zona del formulario), desde el día elegido en adelante.
  const seriesDates = useMemo(() => {
    if (!repeat || !f.date) return [];
    const monday = weekStart(f.date);
    const out = [];
    for (let w = 0; w < weeks; w++) {
      weekdays.slice().sort().forEach((wd) => {
        const d = addDays(monday, w * 7 + wd);
        if (d >= f.date) out.push(d);
      });
    }
    return out;
  }, [repeat, f.date, weekdays, weeks]);

  const payload = () => ({
    ...f, date: arDate, title: f.title.trim(), note: f.note.trim(), rival: isScrim ? f.rival.trim() : '', map: isScrim ? f.map : '', updatedAt: serverTimestamp(),
  });

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try { await fn(); } catch (e) { setError(errMsg(e)); setBusy(false); }
  };

  const save = (e) => {
    e.preventDefault();
    if (!f.date) { setError('Elegí el día.'); return; }
    if (repeat && !seriesDates.length) { setError('Elegí al menos un día de la semana.'); return; }
    run(async () => {
      const data = payload();
      if (!isNew) await updateDoc(doc(db, C.events, event.id), data);
      else if (!repeat) await addDoc(collection(db, C.events), { ...data, createdAt: serverTimestamp() });
      else {
        const batch = writeBatch(db);
        const seriesId = doc(collection(db, C.events)).id;
        seriesDates.forEach((d) => batch.set(doc(collection(db, C.events)), { ...data, date: toAr(d), seriesId, createdAt: serverTimestamp() }));
        await batch.commit();
      }
      onClose();
    });
  };

  // Guarda el evento y crea su scrim (o abre el que ya tiene).
  const saveAndScrim = () => {
    if (!f.date) { setError('Elegí el día.'); return; }
    run(async () => {
      const data = payload();
      let id = event.id;
      if (isNew) id = (await addDoc(collection(db, C.events), { ...data, createdAt: serverTimestamp() })).id;
      const scrimId = await createScrim({ date: data.date, map: data.map, rival: data.rival, roster: players.data });
      await updateDoc(doc(db, C.events, id), { ...(isNew ? {} : data), scrimId });
      navigate(`/scrims?id=${scrimId}`);
    });
  };

  const remove = (all) => run(async () => {
    if (!all) await deleteDoc(doc(db, C.events, event.id));
    else {
      const snap = await getDocs(query(collection(db, C.events), where('seriesId', '==', event.seriesId)));
      const batch = writeBatch(db);
      snap.docs.filter((d) => (d.data().date || '') >= event.date).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
    onClose();
  });

  const libs = (library.data || []).slice().sort((a, b) => (a.title || '').localeCompare(b.title || ''));

  return (
    <Modal title={isNew ? 'Nuevo evento' : 'Editar evento'} onClose={onClose}>
      <form onSubmit={save} className="stack" style={{ gap: 24 }}>
        <div className="field">
          <span>Tipo</span>
          <div className="seg kind-grid" role="radiogroup" aria-label="Tipo">
            {EVENT_KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={f.kind === k} className={f.kind === k ? 'on' : ''} onClick={() => setF({ ...f, kind: k })}>{k}</button>
            ))}
          </div>
        </div>
        <label className="field"><span>{repeat ? 'Desde' : 'Día'} · {zone === 'mx' ? 'México' : 'Argentina'}</span><input className="input" type="date" value={f.date} onChange={set('date')} /></label>
        <div className="field">
          <span>Hora</span>
          <div className="time-pair">
            <div className={`time-zone${zone === 'ar' && f.time ? ' on' : ''}`}><b>Argentina</b><TimeSelect value={f.time} onChange={setAr} label="Argentina" /></div>
            <div className={`time-zone${zone === 'mx' && f.time ? ' on' : ''}`}><b>México</b><TimeSelect value={mx} onChange={setMxTime} label="México" /></div>
          </div>
          {crossNote && <p className="muted small" style={{ margin: 0 }}>{crossNote}</p>}
        </div>

        {isNew && (
          <div className="field">
            <span>Repetir</span>
            <div className="seg" style={{ alignSelf: 'flex-start' }} role="radiogroup" aria-label="Repetir">
              <button type="button" role="radio" aria-checked={!repeat} className={!repeat ? 'on' : ''} onClick={() => setRepeat(false)}>Una vez</button>
              <button type="button" role="radio" aria-checked={repeat} className={repeat ? 'on' : ''} onClick={() => setRepeat(true)}>Todas las semanas</button>
            </div>
            {repeat && (
              <div className="stack" style={{ gap: 12 }}>
                <div className="chips" role="group" aria-label="Días de la semana">
                  {WEEKDAYS.map((l, i) => {
                    const on = weekdays.includes(i);
                    return <button key={l} type="button" aria-pressed={on} className={on ? 'on' : ''} onClick={() => setWeekdays(on ? weekdays.filter((x) => x !== i) : [...weekdays, i])}>{l}</button>;
                  })}
                </div>
                <label className="row" style={{ gap: 12 }}>
                  <span className="muted small">Durante</span>
                  <select className="select" style={{ width: 'auto' }} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n} {n === 1 ? 'semana' : 'semanas'}</option>)}
                  </select>
                  <span className="muted small">· se crean {seriesDates.length} eventos</span>
                </label>
              </div>
            )}
          </div>
        )}

        {isScrim && (
          <div className="form-grid">
            <label className="field"><span>Rival</span><input className="input" value={f.rival} onChange={set('rival')} /></label>
            <label className="field"><span>Mapa</span>
              <select className="select" value={f.map} onChange={set('map')}>
                <option value="">Sin definir</option>
                {MAPS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </label>
          </div>
        )}

        <label className="field"><span>Título</span><input className="input" value={f.title} onChange={set('title')} placeholder={isScrim ? (f.rival ? `vs ${f.rival}` : 'vs Rival') : f.kind === 'Torneo' ? 'Nombre del torneo · fase' : f.kind} /></label>
        <label className="field"><span>Material de la biblioteca</span>
          <select className="select" value={f.libraryId} onChange={set('libraryId')}>
            <option value="">Sin material</option>
            {libs.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
        </label>
        <label className="field"><span>Nota</span><textarea className="textarea" value={f.note} onChange={set('note')} placeholder="Qué se va a trabajar, link del VOD, quiénes…" /></label>
        {!isNew && event.seriesId && <p className="muted small" style={{ margin: 0 }}>Es parte de una serie semanal: los cambios se guardan solo en este evento.</p>}
        {error && <p className="error" style={{ margin: 0 }}>{error}</p>}

        <div className="row between">
          <div className="row">
            <button className="btn btn-primary" disabled={busy}>{busy ? 'Guardando…' : repeat ? `Crear ${seriesDates.length}` : 'Guardar'}</button>
            {isScrim && !repeat && (event.scrimId
              ? <Link className="btn btn-light" to={`/scrims?id=${event.scrimId}`}>Abrir scrim</Link>
              : <button type="button" className="btn btn-light" disabled={busy || players.loading} onClick={saveAndScrim}>Guardar y crear scrim</button>)}
            <button type="button" className="btn" onClick={onClose}>Cancelar</button>
          </div>
          {!isNew && (confirmDel
            ? (
              <div className="row" style={{ gap: 4 }}>
                <button type="button" className="btn btn-danger" disabled={busy} onClick={() => remove(confirmDel === 'all')}>{confirmDel === 'all' ? 'Confirmar: este y los siguientes' : 'Confirmar borrado'}</button>
                <button type="button" className="btn" onClick={() => setConfirmDel('')}>No</button>
              </div>
            )
            : (
              <div className="row" style={{ gap: 4 }}>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmDel('one')}>Borrar</button>
                {event.seriesId && <button type="button" className="btn btn-ghost" onClick={() => setConfirmDel('all')}>Borrar serie</button>}
              </div>
            ))}
        </div>
      </form>
    </Modal>
  );
}
