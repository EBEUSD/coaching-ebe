import { useEffect, useState } from 'react';
import { onSnapshot } from 'firebase/firestore';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

export const dateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const todayKey = () => dateKey(new Date());

export const fromKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (k, n) => {
  const d = fromKey(k);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};

export const shortDate = (k) => {
  if (!k) return '';
  const d = fromKey(k);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
};

export const dayTitle = (k) => {
  const d = fromKey(k);
  return `${DAYS[d.getDay()].slice(0, 3)} ${shortDate(k)}`;
};

export const dayName = (k) => DAYS[fromKey(k).getDay()];

export const randomPassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let p = '';
  const arr = new Uint32Array(10);
  crypto.getRandomValues(arr);
  arr.forEach((n) => { p += chars[n % chars.length]; });
  return p;
};

export const slugUser = (nick) =>
  nick.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const byNick = (a, b) => (a.nick || '').localeCompare(b.nick || '');

// Suscripción en vivo a una query o documento de Firestore.
export function useLive(make, deps) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  useEffect(() => {
    const target = make();
    if (!target) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      target,
      (snap) => {
        const data = 'docs' in snap
          ? snap.docs.map((d) => ({ id: d.id, ...d.data() }))
          : (snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setState({ data, loading: false, error: null });
      },
      (error) => {
        console.error(error);
        setState({ data: null, loading: false, error });
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

export const errMsg = (e) => {
  const code = e?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Usuario o contraseña incorrectos.';
  if (code.includes('email-already-in-use')) return 'Ese usuario ya existe.';
  if (code.includes('weak-password')) return 'La contraseña tiene que tener al menos 6 caracteres.';
  if (code.includes('permission-denied')) return 'No tenés permiso para esto. Revisá las reglas de Firestore.';
  if (code.includes('too-many-requests')) return 'Demasiados intentos. Probá en unos minutos.';
  return e?.message || 'Algo salió mal.';
};
