import { useEffect, useMemo, useState } from 'react';
import { addDoc, collection, deleteDoc, doc, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { C, db } from '../firebase';
import { storage } from '../storage';
import { useAuth } from '../auth';
import { MAPS, STRAT_STATES, STRAT_TYPES } from '../lib/constants';
import { errMsg, useLive } from '../lib/utils';
import { Icon, ICONS, Loading } from '../components/ui';

export default function Playbook() {
  const { staff } = useAuth();
  const canEdit = staff;
  const [map, setMap] = useState(MAPS[0]);
  const [side, setSide] = useState('Ataque');
  const [selId, setSelId] = useState(null);
  const strats = useLive(() => query(collection(db, C.strats), where('map', '==', map)), [map]);

  const all = strats.data || [];
  const list = useMemo(() => all.filter((s) => s.side === side).sort((a, b) => (a.name || '').localeCompare(b.name || '')), [all, side]);
  const count = (sd) => all.filter((s) => s.side === sd).length;
  const sel = list.find((s) => s.id === selId) || list[0];

  const create = async () => {
    const r = await addDoc(collection(db, C.strats), {
      map, side, type: STRAT_TYPES[0], site: '', name: 'Nueva estrategia', state: 'Idea', desc: '',
      roles: [{ who: '', what: '' }], image: '', vod: '', createdAt: serverTimestamp(),
    });
    setSelId(r.id);
  };

  return (
    <main className="page">
      <div className="row between">
        <div className="tabs" role="tablist" aria-label="Mapas" style={{ borderBottom: 0 }}>
          {MAPS.map((m) => (
            <button key={m} role="tab" aria-selected={m === map} className={m === map ? 'on' : ''} onClick={() => { setMap(m); setSelId(null); }}>{m}</button>
          ))}
        </div>
        {canEdit && <button className="btn btn-primary" onClick={create}>+ Estrategia</button>}
      </div>

      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <h1 className="d h1">{map}</h1>
        <div className="seg">
          {['Ataque', 'Defensa'].map((sd) => (
            <button key={sd} className={side === sd ? 'on' : ''} onClick={() => { setSide(sd); setSelId(null); }}>{sd} · {count(sd)}</button>
          ))}
        </div>
      </div>

      <div className="split">
        <div className="side stack" style={{ gap: 6 }}>
          {strats.loading && <Loading />}
          {!strats.loading && list.length === 0 && <p className="empty">No hay estrategias de {side.toLowerCase()} en {map}.</p>}
          {list.map((s) => (
            <button key={s.id} className={`side-item${sel?.id === s.id ? ' on' : ''}`} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, padding: 18 }} onClick={() => setSelId(s.id)}>
              <span className="row between">
                <span className="lbl muted" style={{ fontSize: 11 }}>{s.type}{s.site ? ` · ${s.site}` : ''}</span>
                <span className="lbl" style={{ fontSize: 11, color: s.state === 'Lista' ? 'var(--blanco)' : 'var(--muted)' }}>{s.state}</span>
              </span>
              <span className="d" style={{ fontSize: 26, fontWeight: 700 }}>{s.name}</span>
            </button>
          ))}
        </div>
        <article className="main">
          {sel && (canEdit
            ? <StratEditor key={sel.id} strat={sel} onDeleted={() => setSelId(null)} />
            : <StratView strat={sel} />)}
        </article>
      </div>
    </main>
  );
}

function StratView({ strat }) {
  return (
    <div className="stack" style={{ gap: 24 }}>
      {strat.image && <img src={strat.image} alt={`Plano de ${strat.name}`} style={{ width: '100%', background: 'var(--surface)' }} />}
      <div className="stack" style={{ gap: 10 }}>
        <span className="lbl muted" style={{ fontSize: 11 }}>{strat.type}{strat.site ? ` · ${strat.site}` : ''} · {strat.state}</span>
        <h2 className="d h2">{strat.name}</h2>
        {strat.desc && <p className="muted" style={{ margin: 0, lineHeight: 1.55, maxWidth: '64ch' }}>{strat.desc}</p>}
      </div>
      <div>
        {(strat.roles || []).filter((r) => r.who || r.what).map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--line)' }}>
            <strong>{r.who}</strong><span>{r.what}</span>
          </div>
        ))}
      </div>
      {strat.vod && <a className="btn btn-ghost" style={{ alignSelf: 'flex-start' }} href={strat.vod} target="_blank" rel="noreferrer">Ver VOD</a>}
    </div>
  );
}

function StratEditor({ strat, onDeleted }) {
  const [s, setS] = useState(strat);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { if (!dirty) setS(strat); }, [strat]); // eslint-disable-line

  const patch = (p) => { setS((x) => ({ ...x, ...p })); setDirty(true); };
  const setRole = (i, k, v) => patch({ roles: s.roles.map((r, j) => (j === i ? { ...r, [k]: v } : r)) });

  const save = async () => {
    const { id, ...data } = s;
    await updateDoc(doc(db, C.strats, strat.id), { ...data, updatedAt: serverTimestamp() });
    setDirty(false);
  };
  const remove = async () => {
    if (!window.confirm('¿Borrar esta estrategia?')) return;
    await deleteDoc(doc(db, C.strats, strat.id));
    onDeleted();
  };
  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const r = ref(storage, `sot/strats/${strat.id}/${Date.now()}_${file.name}`);
      await uploadBytes(r, file);
      const url = await getDownloadURL(r);
      await updateDoc(doc(db, C.strats, strat.id), { image: url });
      setS((x) => ({ ...x, image: url }));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="stack" style={{ gap: 24 }}>
      <label style={{ aspectRatio: '16 / 7', background: 'var(--surface)', display: 'grid', placeItems: 'center', color: 'var(--muted)', cursor: 'pointer', overflow: 'hidden' }}>
        {s.image
          ? <img src={s.image} alt={`Plano de ${s.name}`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          : <span className="row"><Icon d={ICONS.image} />{uploading ? 'Subiendo…' : 'Subir plano del minimapa'}</span>}
        <input type="file" accept="image/*" hidden onChange={(e) => upload(e.target.files[0])} />
      </label>
      {error && <p className="error">{error}</p>}

      <input className="input d" style={{ fontSize: 40, minHeight: 64 }} value={s.name} onChange={(e) => patch({ name: e.target.value })} aria-label="Nombre de la estrategia" />
      <div className="form-grid">
        <label className="field"><span>Tipo</span><select className="select" value={s.type} onChange={(e) => patch({ type: e.target.value })}>{STRAT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="field"><span>Sitio</span><input className="input" value={s.site} onChange={(e) => patch({ site: e.target.value })} placeholder="A, B, mid…" /></label>
        <label className="field"><span>Estado</span><select className="select" value={s.state} onChange={(e) => patch({ state: e.target.value })}>{STRAT_STATES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="field"><span>Lado</span><select className="select" value={s.side} onChange={(e) => patch({ side: e.target.value })}><option>Ataque</option><option>Defensa</option></select></label>
      </div>
      <label className="field"><span>Descripción</span><textarea className="textarea" value={s.desc} onChange={(e) => patch({ desc: e.target.value })} /></label>

      <div className="stack">
        <span className="lbl muted" style={{ fontSize: 11 }}>Qué hace cada uno</span>
        {(s.roles || []).map((r, i) => (
          <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
            <input className="input" style={{ maxWidth: 160 }} value={r.who} onChange={(e) => setRole(i, 'who', e.target.value)} placeholder="Jugador" aria-label="Jugador" />
            <input className="input" value={r.what} onChange={(e) => setRole(i, 'what', e.target.value)} placeholder="Tarea en la estrategia" aria-label="Tarea" />
            <button className="icon-btn" onClick={() => patch({ roles: s.roles.filter((_, j) => j !== i) })} aria-label="Quitar"><Icon d={ICONS.trash} size={18} /></button>
          </div>
        ))}
        <button className="btn btn-dashed" style={{ alignSelf: 'flex-start' }} onClick={() => patch({ roles: [...(s.roles || []), { who: '', what: '' }] })}>+ Rol</button>
      </div>
      <label className="field"><span>Link del VOD</span><input className="input" value={s.vod} onChange={(e) => patch({ vod: e.target.value })} /></label>

      <div className="row between">
        <button className="btn btn-light" onClick={save} disabled={!dirty}>{dirty ? 'Guardar cambios' : 'Guardado'}</button>
        <button className="btn" onClick={remove}>Borrar estrategia</button>
      </div>
    </div>
  );
}
