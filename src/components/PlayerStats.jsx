import { useMemo, useState } from 'react';
import { collection } from 'firebase/firestore';
import { C, db } from '../firebase';
import { errMsg, shortDate, useLive } from '../lib/utils';
import { Loading } from './ui';

// Stats de un jugador a partir de los scrims cargados (solo staff: sot_scrims es solo staff).
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const LAST = 12;

function summarize(list) {
  const sum = (k) => list.reduce((s, r) => s + (r[k] ?? 0), 0);
  const avg = (k) => {
    const v = list.filter((r) => r[k] != null);
    return v.length ? v.reduce((s, r) => s + r[k], 0) / v.length : null;
  };
  const d = sum('d');
  return {
    n: list.length,
    kd: d > 0 ? sum('k') / d : null,
    acs: avg('acs'),
    fb: avg('fb'),
    k: avg('k'),
    wins: list.filter((r) => r.win).length,
    losses: list.filter((r) => r.win === false).length,
  };
}

const fx = (v, digits = 0) => (v == null ? '—' : v.toFixed(digits));

export default function PlayerStats({ playerId }) {
  const scrims = useLive(() => collection(db, C.scrims), []);
  const [hover, setHover] = useState(null);

  const rows = useMemo(() => (scrims.data || []).map((s) => {
    const st = (s.stats || []).find((x) => x.playerId === playerId);
    if (!st) return null;
    const r = { k: num(st.k), d: num(st.d), a: num(st.a), acs: num(st.acs), fb: num(st.fb) };
    if (Object.values(r).every((v) => v == null)) return null;
    const rounds = s.rounds || [];
    const w = rounds.filter((x) => x.r === 'W').length;
    const l = rounds.length - w;
    return { ...r, id: s.id, date: s.date || '', map: s.map || '—', rival: s.rival || '', agent: st.agent || '', score: `${w}–${l}`, win: rounds.length ? w > l : null };
  }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date)), [scrims.data, playerId]);

  const total = useMemo(() => summarize(rows), [rows]);
  const maps = useMemo(() => {
    const m = {};
    rows.forEach((r) => { (m[r.map] ||= []).push(r); });
    return Object.entries(m).map(([map, l]) => ({ map, ...summarize(l) })).sort((a, b) => b.n - a.n);
  }, [rows]);

  if (scrims.loading) return <Loading />;
  if (scrims.error) return <p className="error">{errMsg(scrims.error)}</p>;
  if (!rows.length) return <p className="empty">Todavía no tiene stats cargadas en ningún scrim.</p>;

  const recent = rows.slice(-LAST);
  const maxAcs = Math.max(1, ...recent.map((r) => r.acs || 0));
  const shown = recent[hover ?? recent.length - 1];

  return (
    <div className="stack" style={{ gap: 40 }}>
      <div className="stat-tiles">
        {[
          ['Scrims', total.n],
          ['K/D', fx(total.kd, 2)],
          ['ACS', fx(total.acs)],
          ['First bloods', fx(total.fb, 1), 'por scrim'],
          ['Récord', `${total.wins}–${total.losses}`],
        ].map(([l, v, sub]) => (
          <div key={l}>
            <span className="lbl muted" style={{ fontSize: 11 }}>{l}</span>
            <span className="d" style={{ fontSize: 40 }}>{v}</span>
            {sub && <span className="muted small">{sub}</span>}
          </div>
        ))}
      </div>

      <section className="stack" style={{ gap: 12 }}>
        <div className="row between" style={{ alignItems: 'baseline' }}>
          <span className="lbl muted" style={{ fontSize: 11 }}>ACS · últimos {recent.length} scrims</span>
          {shown && (
            <span className="small" aria-live="polite">
              <strong>{shown.acs ?? '—'} ACS</strong>
              <span className="muted"> · {shortDate(shown.date)} · {shown.map}{shown.rival ? ` vs ${shown.rival}` : ''} · {shown.k ?? '—'}/{shown.d ?? '—'}/{shown.a ?? '—'}</span>
            </span>
          )}
        </div>
        <div className="bars" onMouseLeave={() => setHover(null)}>
          {recent.map((r, i) => (
            <button
              key={r.id}
              type="button"
              className={hover === i ? 'on' : ''}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${shortDate(r.date)} ${r.map}: ${r.acs ?? 'sin'} ACS`}
            >
              <span style={{ height: `${((r.acs || 0) / maxAcs) * 100}%` }} />
            </button>
          ))}
        </div>
        <div className="row between muted small">
          <span>{shortDate(recent[0].date)}</span>
          <span>{shortDate(recent[recent.length - 1].date)}</span>
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <span className="lbl muted" style={{ fontSize: 11 }}>Por mapa</span>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Mapa</th><th>Scrims</th><th>K/D</th><th>ACS</th><th>FB / scrim</th><th>Récord</th></tr></thead>
            <tbody>
              {maps.map((m) => (
                <tr key={m.map}>
                  <td style={{ fontWeight: 600 }}>{m.map}</td><td>{m.n}</td><td>{fx(m.kd, 2)}</td><td>{fx(m.acs)}</td><td>{fx(m.fb, 1)}</td><td>{m.wins}–{m.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="stack" style={{ gap: 12 }}>
        <span className="lbl muted" style={{ fontSize: 11 }}>Scrims</span>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Fecha</th><th>Mapa</th><th>Rival</th><th>Agente</th><th>K / D / A</th><th>ACS</th><th>FB</th><th>Resultado</th></tr></thead>
            <tbody>
              {rows.slice().reverse().map((r) => (
                <tr key={r.id}>
                  <td>{shortDate(r.date)}</td><td>{r.map}</td><td>{r.rival || '—'}</td><td>{r.agent || '—'}</td>
                  <td>{r.k ?? '—'} / {r.d ?? '—'} / {r.a ?? '—'}</td><td>{r.acs ?? '—'}</td><td>{r.fb ?? '—'}</td>
                  <td>{r.score}{r.win == null ? '' : r.win ? ' · W' : ' · L'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
