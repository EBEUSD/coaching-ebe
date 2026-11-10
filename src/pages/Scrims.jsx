import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useSearchParams } from 'react-router-dom';
import { C, db } from '../firebase';
import { BUYS, MAPS, ROUND_ENDS } from '../lib/constants';
import { byNick, score, shortDate, todayKey, useLive } from '../lib/utils';
import { createScrim } from '../lib/scrims';
import { Loading } from '../components/ui';

export default function Scrims() {
  const scrims = useLive(() => collection(db, C.scrims), []);
  const players = useLive(() => query(collection(db, C.players), where('active', '==', true)), []);
  const [params] = useSearchParams();
  const [selId, setSelId] = useState(() => params.get('id')); // el Calendario abre uno puntual con ?id=

  const list = useMemo(() => (scrims.data || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || '')), [scrims.data]);
  const sel = list.find((s) => s.id === selId) || list[0];

  const create = async () => {
    setSelId(await createScrim({ date: todayKey(), roster: players.data }));
  };

  return (
    <main className="page">
      <div className="split">
        <aside className="side stack" style={{ gap: 12 }}>
          <div className="row between">
            <h1 className="d" style={{ fontSize: 44 }}>Scrims</h1>
            <button className="btn btn-primary" onClick={create}>+ Nuevo</button>
          </div>
          {scrims.loading && <Loading />}
          {!scrims.loading && list.length === 0 && <p className="empty">Todavía no cargaste scrims.</p>}
          <div className="stack" style={{ gap: 4 }}>
            {list.map((s) => {
              const w = (s.rounds || []).filter((r) => r.r === 'W').length;
              const win = w > (s.rounds || []).length - w;
              return (
                <button key={s.id} className={`side-item${sel?.id === s.id ? ' on' : ''}`} onClick={() => setSelId(s.id)}>
                  <span className="stack" style={{ gap: 2 }}>
                    <span style={{ fontWeight: 600 }}>vs {s.rival || 'Sin rival'}</span>
                    <span className="muted small">{shortDate(s.date)} · {s.map}</span>
                  </span>
                  <span className="d" style={{ fontSize: 24, color: win ? 'var(--blanco)' : '#7D7C85' }}>{score(s)}</span>
                </button>
              );
            })}
          </div>
        </aside>
        <section className="main">
          {sel && <ScrimEditor key={sel.id} scrim={sel} players={players.data || []} onDeleted={() => setSelId(null)} />}
        </section>
      </div>
    </main>
  );
}

function sideOf(n, start) {
  const other = start === 'Defensa' ? 'Ataque' : 'Defensa';
  if (n <= 12) return start;
  if (n <= 24) return other;
  return (n % 2 === 1) ? start : other; // overtime alterna
}

function ScrimEditor({ scrim, players, onDeleted }) {
  const [s, setS] = useState(scrim);
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState('rounds');
  const [rIdx, setRIdx] = useState(Math.max((scrim.rounds || []).length - 1, 0));
  const strats = useLive(() => query(collection(db, C.strats), where('map', '==', s.map)), [s.map]);

  useEffect(() => { if (!dirty) setS(scrim); }, [scrim]); // eslint-disable-line

  const patch = (p) => { setS((x) => ({ ...x, ...p })); setDirty(true); };
  const rounds = s.rounds || [];
  const won = rounds.filter((r) => r.r === 'W').length;
  const round = rounds[rIdx];

  const setRound = (p) => patch({ rounds: rounds.map((r, i) => (i === rIdx ? { ...r, ...p } : r)) });
  const addRound = (r) => {
    const next = [...rounds, { r, buy: rounds.length === 0 || rounds.length === 12 ? 'Pistola' : 'Full buy', rivalBuy: '', how: '', strat: '', note: '' }];
    patch({ rounds: next });
    setRIdx(next.length - 1);
  };
  const delRound = () => { patch({ rounds: rounds.filter((_, i) => i !== rIdx) }); setRIdx(Math.max(rIdx - 1, 0)); };
  const setStat = (i, k, v) => patch({ stats: (s.stats || []).map((row, j) => (j === i ? { ...row, [k]: v } : row)) });

  const save = async () => {
    const { id, ...data } = s;
    await updateDoc(doc(db, C.scrims, scrim.id), { ...data, updatedAt: serverTimestamp() });
    setDirty(false);
  };
  const remove = async () => {
    if (!window.confirm('¿Borrar este scrim? No se puede deshacer.')) return;
    await deleteDoc(doc(db, C.scrims, scrim.id));
    onDeleted();
  };

  const stratNames = (strats.data || []).filter((x) => x.side === sideOf(rIdx + 1, s.startSide)).map((x) => x.name);

  return (
    <div className="stack" style={{ gap: 28 }}>
      <div className="row between" style={{ gap: 16 }}>
        <div className="row" style={{ alignItems: 'baseline', gap: 16 }}>
          <span className="d" style={{ fontSize: 72 }}>{won}<span style={{ color: 'var(--carmesi)' }}> – </span><span style={{ color: '#7D7C85' }}>{rounds.length - won}</span></span>
          <span style={{ fontWeight: 600, fontSize: 20 }}>{rounds.length ? (won > rounds.length - won ? 'Victoria' : won === rounds.length - won ? 'Empate' : 'Derrota') : 'Sin rondas'} vs {s.rival || '—'}</span>
        </div>
        <div className="row">
          {s.vod && <a className="btn btn-ghost" href={s.vod} target="_blank" rel="noreferrer">Ver VOD</a>}
          <button className="btn btn-light" onClick={save} disabled={!dirty}>{dirty ? 'Guardar cambios' : 'Guardado'}</button>
        </div>
      </div>

      <div className="form-grid">
        <label className="field"><span>Rival</span><input className="input" value={s.rival} onChange={(e) => patch({ rival: e.target.value })} /></label>
        <label className="field"><span>Fecha</span><input className="input" type="date" value={s.date} onChange={(e) => patch({ date: e.target.value })} /></label>
        <label className="field"><span>Mapa</span>
          <select className="select" value={s.map} onChange={(e) => patch({ map: e.target.value })}>{MAPS.map((m) => <option key={m}>{m}</option>)}</select>
        </label>
        <label className="field"><span>Arrancamos en</span>
          <select className="select" value={s.startSide} onChange={(e) => patch({ startSide: e.target.value })}><option>Defensa</option><option>Ataque</option></select>
        </label>
        <label className="field"><span>Link del VOD</span><input className="input" value={s.vod} onChange={(e) => patch({ vod: e.target.value })} placeholder="YouTube, Medal…" /></label>
      </div>

      <div className="tabs" role="tablist">
        {[['rounds', 'Ronda por ronda'], ['stats', 'Stats'], ['summary', 'Conclusiones']].map(([id, l]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{l}</button>
        ))}
      </div>

      {tab === 'rounds' && (
        <div className="stack" style={{ gap: 24 }}>
          <div className="row">
            <div className="rounds" style={{ flex: '1 1 auto' }}>
              {rounds.map((r, i) => (
                <button key={i} className={`round${r.r === 'W' ? ' w' : ''}${i === rIdx ? ' sel' : ''}${i === 12 ? ' half' : ''}`} onClick={() => setRIdx(i)} aria-label={`Ronda ${i + 1}`}>{i + 1}</button>
              ))}
            </div>
            <button className="btn btn-primary" onClick={() => addRound('W')}>+ Ganada</button>
            <button className="btn btn-ghost" onClick={() => addRound('L')}>+ Perdida</button>
          </div>

          {round ? (
            <div className="grid-auto">
              <div className="stack" style={{ gap: 16 }}>
                <div className="row">
                  <span className="d" style={{ fontSize: 40 }}>Ronda {rIdx + 1}</span>
                  <span className="muted">{sideOf(rIdx + 1, s.startSide)}</span>
                </div>
                <div className="seg">
                  <button className={round.r === 'W' ? 'on' : ''} onClick={() => setRound({ r: 'W' })}>Ganada</button>
                  <button className={round.r === 'L' ? 'on' : ''} onClick={() => setRound({ r: 'L' })}>Perdida</button>
                </div>
                <div className="form-grid">
                  <label className="field"><span>Compra</span><select className="select" value={round.buy} onChange={(e) => setRound({ buy: e.target.value })}><option value="">—</option>{BUYS.map((b) => <option key={b}>{b}</option>)}</select></label>
                  <label className="field"><span>Compra rival</span><select className="select" value={round.rivalBuy} onChange={(e) => setRound({ rivalBuy: e.target.value })}><option value="">—</option>{BUYS.map((b) => <option key={b}>{b}</option>)}</select></label>
                  <label className="field"><span>Terminó por</span><select className="select" value={round.how} onChange={(e) => setRound({ how: e.target.value })}><option value="">—</option>{ROUND_ENDS.map((b) => <option key={b}>{b}</option>)}</select></label>
                  <label className="field"><span>Estrategia</span>
                    <input className="input" list="strat-list" value={round.strat} onChange={(e) => setRound({ strat: e.target.value })} />
                    <datalist id="strat-list">{stratNames.map((n) => <option key={n} value={n} />)}</datalist>
                  </label>
                </div>
                <button className="btn" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={delRound}>Borrar ronda</button>
              </div>
              <label className="field"><span>Qué hicimos</span>
                <textarea className="textarea" style={{ minHeight: 220 }} value={round.note} onChange={(e) => setRound({ note: e.target.value })} placeholder="Cómo se jugó la ronda, errores, jugadas para repetir…" />
              </label>
            </div>
          ) : <p className="empty">Cargá la primera ronda con “+ Ganada” o “+ Perdida”.</p>}
        </div>
      )}

      {tab === 'stats' && (
        <div className="stack">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Jugador</th><th>Agente</th><th>K</th><th>D</th><th>A</th><th>ACS</th><th>FB</th><th>Nota</th><th /></tr></thead>
              <tbody>
                {(s.stats || []).map((row, i) => (
                  <tr key={i}>
                    <td>
                      <select className="select" value={row.playerId} onChange={(e) => { const p = players.find((x) => x.id === e.target.value); setStat(i, 'playerId', e.target.value); if (p) setStat(i, 'nick', p.nick); }}>
                        <option value="">—</option>
                        {players.slice().sort(byNick).map((p) => <option key={p.id} value={p.id}>{p.nick}</option>)}
                        {row.playerId && !players.find((p) => p.id === row.playerId) && <option value={row.playerId}>{row.nick}</option>}
                      </select>
                    </td>
                    <td><input className="input" value={row.agent} onChange={(e) => setStat(i, 'agent', e.target.value)} /></td>
                    {['k', 'd', 'a', 'acs', 'fb'].map((k) => (
                      <td key={k}><input className="input" inputMode="numeric" style={{ width: 70 }} value={row[k]} onChange={(e) => setStat(i, k, e.target.value)} /></td>
                    ))}
                    <td><input className="input" style={{ minWidth: 200 }} value={row.note} onChange={(e) => setStat(i, 'note', e.target.value)} /></td>
                    <td><button className="btn" onClick={() => patch({ stats: s.stats.filter((_, j) => j !== i) })} aria-label="Quitar fila">×</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-dashed" style={{ alignSelf: 'flex-start' }} onClick={() => patch({ stats: [...(s.stats || []), { playerId: '', nick: '', agent: '', k: '', d: '', a: '', acs: '', fb: '', note: '' }] })}>+ Fila</button>
        </div>
      )}

      {tab === 'summary' && (
        <div className="stack" style={{ gap: 20, maxWidth: 820 }}>
          <label className="field"><span>Qué salió bien</span><textarea className="textarea" value={s.good} onChange={(e) => patch({ good: e.target.value })} /></label>
          <label className="field"><span>Qué corregir</span><textarea className="textarea" value={s.fix} onChange={(e) => patch({ fix: e.target.value })} /></label>
          <label className="field"><span>Para la próxima</span><textarea className="textarea" value={s.next} onChange={(e) => patch({ next: e.target.value })} /></label>
        </div>
      )}

      <button className="btn" style={{ alignSelf: 'flex-start', padding: 0 }} onClick={remove}>Borrar scrim</button>
    </div>
  );
}
