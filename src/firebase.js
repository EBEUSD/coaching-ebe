import { initializeApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  inMemoryPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  signOut,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Config pública del proyecto landing-creator (es segura en el cliente;
// la seguridad la dan las reglas de Firestore y Storage).
export const firebaseConfig = {
  apiKey: 'AIzaSyDg-tAXB345gmiOl-uPiTdf3P3lrUJURoo',
  authDomain: 'landing-creator-469a5.firebaseapp.com',
  projectId: 'landing-creator-469a5',
  storageBucket: 'landing-creator-469a5.firebasestorage.app',
  messagingSenderId: '199423614351',
  appId: '1:199423614351:web:4b2aa7ac67b370608cfffa',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
// Storage vive en ./storage.js y Functions se carga al usarla: así no pesan en la carga inicial.

// Cloud Functions (solo super admin): cambiar contraseña y usuario de acceso.
async function callFn(name, data) {
  const { getFunctions, httpsCallable } = await import('firebase/functions');
  return httpsCallable(getFunctions(app, 'us-central1'), name)(data);
}
export const setUserPassword = (uid, password) => callFn('sotSetPassword', { uid, password });
export const setUsername = async (uid, username) => (await callFn('sotSetUsername', { uid, username })).data.username;

// Los jugadores entran con usuario (ej: "kai"). Por debajo es un email ficticio.
export const USER_DOMAIN = 'sot-coaching.app';
export const toEmail = (user) => {
  const u = user.trim().toLowerCase();
  return u.includes('@') ? u : `${u}@${USER_DOMAIN}`;
};

// App secundaria para crear cuentas de jugadores sin cerrar la sesión del coach.
const secondary = initializeApp(firebaseConfig, 'secondary');
const secondaryAuth = initializeAuth(secondary, { persistence: inMemoryPersistence });

// setup(uid) guarda los documentos con la sesión del admin. Si falla, se borra la
// cuenta recién creada para que no quede huérfana (y se pueda reintentar).
export async function createPlayerAccount(username, password, setup) {
  const cred = await createUserWithEmailAndPassword(secondaryAuth, toEmail(username), password);
  const uid = cred.user.uid;
  try {
    if (setup) await setup(uid);
  } catch (e) {
    await deleteUser(cred.user).catch(console.error);
    throw e;
  } finally {
    await signOut(secondaryAuth).catch(() => {});
  }
  return uid;
}

// Colecciones (prefijo sot_ para no mezclarse con Landing Creator)
export const C = {
  coaches: 'sot_coaches', // superadmins de respaldo (se crean a mano en la consola)
  users: 'sot_users', // todos los usuarios con su rol: superadmin | coach | player
  players: 'sot_players',
  days: 'sot_days',
  notes: 'sot_notes',
  tasks: 'sot_tasks',
  scrims: 'sot_scrims',
  strats: 'sot_strats',
  library: 'sot_library',
  events: 'sot_events', // calendario semanal: clases, scrims, VOD reviews
};
