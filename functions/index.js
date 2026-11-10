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
