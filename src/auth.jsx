import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db, C, toEmail } from './firebase';

const AuthCtx = createContext(null);

const safeGet = (ref) => getDoc(ref).catch(() => null);

export function AuthProvider({ children }) {
  // role: 'loading' | 'out' | 'superadmin' | 'coach' | 'player' | 'none'
  const [state, setState] = useState({ role: 'loading', user: null, player: null, profile: null });

  useEffect(() => onAuthStateChanged(auth, async (user) => {
    if (!user) {
      setState({ role: 'out', user: null, player: null, profile: null });
      return;
    }
    const [legacy, udoc] = await Promise.all([
      safeGet(doc(db, C.coaches, user.uid)),
      safeGet(doc(db, C.users, user.uid)),
    ]);
    const u = udoc?.exists() ? udoc.data() : null;

    if (legacy?.exists() || (u?.active && u.role === 'superadmin')) {
      // Asegura que el superadmin aparezca en la lista de usuarios del panel.
      if (!u) {
        await setDoc(doc(db, C.users, user.uid), {
          username: user.email, name: legacy.data()?.name || user.email, role: 'superadmin', active: true, createdAt: serverTimestamp(),
        }).catch(console.error);
      }
      setState({ role: 'superadmin', user, player: null, profile: u });
      return;
    }
    if (u?.active && u.role === 'coach') {
      setState({ role: 'coach', user, player: null, profile: u });
      return;
    }
    const p = await safeGet(doc(db, C.players, user.uid));
    if (p?.exists() && p.data().active) {
      setState({ role: 'player', user, player: { id: p.id, ...p.data() }, profile: u });
      return;
    }
    setState({ role: 'none', user, player: null, profile: u });
  }), []);

  const login = (userOrEmail, password) => signInWithEmailAndPassword(auth, toEmail(userOrEmail), password);
  const logout = () => signOut(auth);
  const staff = state.role === 'coach' || state.role === 'superadmin';

  return <AuthCtx.Provider value={{ ...state, staff, login, logout }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
