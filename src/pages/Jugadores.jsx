import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection } from 'firebase/firestore';
import { C, db } from '../firebase';
import { INITIAL_ROSTER } from '../lib/constants';
import { byNick, errMsg, useLive } from '../lib/utils';
import Ficha from '../components/Ficha';
import { AddPlayerForm, addPlayer, CredentialsModal, RemovePlayer, setPlayerActive } from '../components/PlayerAdmin';
import { Loading } from '../components/ui';

export default function Jugadores() {
  const players = useLive(() => collection(db, C.players), []);
  const [params, setParams] = useSearchParams();
  const [adding, setAdding] = useState(false);
  const [creds, setCreds] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const active = useMemo(() => (players.data || []).filter((p) => p.active).sort(byNick), [players.data]);
  const archived = useMemo(() => (players.data || []).filter((p) => !p.active).sort(byNick), [players.data]);
  const sel = active.find((p) => p.id === params.get('id')) || active[0];

  const loadInitial = async () => {
    setBusy(true);
    setError('');
    const out = [];
    try {
      for (const p of INITIAL_ROSTER) {
        // eslint-disable-next-line no-await-in-loop
        out.push(await addPlayer(p));
      }
    } catch (e) {
      setError(errMsg(e));
    }
    if (out.length) setCreds(out);
    setBusy(false);
  };

  return (
    <main className="page narrow">
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <h1 className="d h1">Jugadores</h1>
        <button className="btn btn-primary" style={{ minHeight: 48 }} onClick={() => setAdding(true)}>+ Agregar jugador</button>
      </div>

      {players.loading && <Loading />}

      {!players.loading && (players.data || []).length === 0 && !adding && (
        <div className="panel stack" style={{ gap: 16 }}>
          <span>No hay jugadores todavía. Podés cargar el plantel de SOT de una vez ({INITIAL_ROSTER.map((p) => p.nick).join(', ')}) y te muestro los usuarios y contraseñas.</span>
          <button className="btn btn-light" style={{ alignSelf: 'flex-start' }} onClick={loadInitial} disabled={busy}>{busy ? 'Creando cuentas…' : 'Cargar plantel inicial'}</button>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {adding && <AddPlayerForm onCancel={() => setAdding(false)} onDone={(c) => { setCreds(c); setAdding(false); }} />}

      {!adding && active.length > 0 && (
        <>
          <div className="chips" role="tablist" aria-label="Plantel">
            {active.map((p) => (
              <button key={p.id} role="tab" aria-selected={sel?.id === p.id} className={sel?.id === p.id ? 'on' : ''} onClick={() => setParams({ id: p.id })}>{p.nick}</button>
            ))}
          </div>
          {sel && (
            <>
              <Ficha key={sel.id} playerId={sel.id} editable />
              <div className="divider"><RemovePlayer player={sel} onRemoved={() => setParams({})} /></div>
            </>
          )}
        </>
      )}

      {archived.length > 0 && (
        <section className="divider stack">
          <span className="lbl muted" style={{ fontSize: 11 }}>Archivo · fuera del plantel</span>
          {archived.map((p) => (
            <div key={p.id} className="list-row">
              <span style={{ flex: 1 }}><strong>{p.nick}</strong> <span className="muted">· {p.role}</span></span>
              <button className="btn btn-ghost" onClick={() => setPlayerActive(p.id, true)}>Reactivar</button>
            </div>
          ))}
        </section>
      )}

      {creds && <CredentialsModal creds={creds} onClose={() => setCreds(null)} />}
    </main>
  );
}
