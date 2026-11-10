import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { C, db } from '../firebase';
import { MAPS } from './constants';
import { byNick } from './utils';

// Crea un scrim vacío con las filas de stats de los primeros 5 del plantel. Devuelve el id.
export async function createScrim({ date, map, rival, roster }) {
  const five = (roster || []).slice().sort(byNick).slice(0, 5);
  const ref = await addDoc(collection(db, C.scrims), {
    date, map: map || MAPS[0], rival: rival || '', startSide: 'Defensa', vod: '',
    rounds: [],
    stats: five.map((p) => ({ playerId: p.id, nick: p.nick, agent: '', k: '', d: '', a: '', acs: '', fb: '', note: '' })),
    good: '', fix: '', next: '', createdAt: serverTimestamp(),
  });
  return ref.id;
}
