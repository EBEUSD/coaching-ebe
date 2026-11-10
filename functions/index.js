import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();

// Super admin: documento en sot_coaches, o sot_users con role superadmin y activo.
async function isSuper(uid) {
  const [legacy, user] = await Promise.all([
    db.doc(`sot_coaches/${uid}`).get(),
    db.doc(`sot_users/${uid}`).get(),
  ]);
  return legacy.exists || (user.exists && user.get('role') === 'superadmin' && user.get('active') === true);
}

// Cambia la contraseña de un usuario de SOT Coaching. Solo super admin.
export const sotSetPassword = onCall({ region: 'us-central1' }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Tenés que iniciar sesión.');
  if (!(await isSuper(req.auth.uid))) throw new HttpsError('permission-denied', 'Solo el super admin puede cambiar contraseñas.');

  const { uid, password } = req.data || {};
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'Falta el usuario.');
  if (typeof password !== 'string' || password.length < 6) {
    throw new HttpsError('invalid-argument', 'La contraseña tiene que tener al menos 6 caracteres.');
  }

  // Solo cuentas de SOT: no tocar usuarios de Landing Creator.
  const [user, player] = await Promise.all([
    db.doc(`sot_users/${uid}`).get(),
    db.doc(`sot_players/${uid}`).get(),
  ]);
  if (!user.exists && !player.exists) throw new HttpsError('not-found', 'Ese usuario no es de SOT Coaching.');

  await getAuth().updateUser(uid, { password });
  return { ok: true };
});

// Mismo criterio que toEmail() en el cliente: sin "@" se usa el dominio de SOT.
const USER_DOMAIN = 'sot-coaching.app';
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// Cambia el usuario de acceso (el email de la cuenta) y lo actualiza en sot_users y sot_players. Solo super admin.
export const sotSetUsername = onCall({ region: 'us-central1' }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Tenés que iniciar sesión.');
  if (!(await isSuper(req.auth.uid))) throw new HttpsError('permission-denied', 'Solo el super admin puede cambiar usuarios.');

  const { uid } = req.data || {};
  const raw = String(req.data?.username || '').trim().toLowerCase();
  if (typeof uid !== 'string' || !uid) throw new HttpsError('invalid-argument', 'Falta el usuario.');
  const username = raw.includes('@') ? raw : slug(raw);
  if (!username) throw new HttpsError('invalid-argument', 'Poné un usuario.');
  const email = username.includes('@') ? username : `${username}@${USER_DOMAIN}`;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new HttpsError('invalid-argument', 'Ese email no es válido.');

  const userRef = db.doc(`sot_users/${uid}`);
  const playerRef = db.doc(`sot_players/${uid}`);
  const [user, player] = await Promise.all([userRef.get(), playerRef.get()]);
  if (!user.exists && !player.exists) throw new HttpsError('not-found', 'Ese usuario no es de SOT Coaching.');

  try {
    await getAuth().updateUser(uid, { email });
  } catch (e) {
    if (e.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'Ese usuario ya existe.');
    if (e.code === 'auth/invalid-email') throw new HttpsError('invalid-argument', 'Ese email no es válido.');
    throw e;
  }
  const batch = db.batch();
  if (user.exists) batch.update(userRef, { username });
  if (player.exists) batch.update(playerRef, { username });
  await batch.commit();
  return { ok: true, username };
});
