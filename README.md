# SOT Coaching

Planificador de coaching de Storm of Thorns. React + Vite + Firebase (proyecto `landing-creator`), deploy en Vercel.

- **Coach:** tablero diario por jugador, scrims ronda por ronda, playbook por mapa, biblioteca de teóricos, tareas y fichas. Agrega y quita jugadores.
- **Jugadores:** entran con su usuario y contraseña y ven solo su ficha, el playbook y la biblioteca (solo lectura).

Todo se guarda en colecciones con prefijo `sot_` y archivos bajo `sot/` en Storage, separado de Landing Creator.

## 1. Firebase (una sola vez)

1. **Authentication → Método de acceso:** habilitar *Correo electrónico/contraseña*.
2. **Firestore → Reglas:** reemplazar todo por `firebase/firestore.rules` y publicar.
3. **Storage → Reglas:** reemplazar todo por `firebase/storage.rules` y publicar (aceptar el permiso para que Storage consulte Firestore).
4. **Tu usuario super admin (respaldo):**
   - Authentication → Usuarios → *Agregar usuario* con tu email y una contraseña.
   - Firestore → colección `sot_coaches` → documento con ID = **tu UID** y un campo `name`.
   - Ese documento te deja siempre como super admin, aunque se toquen los roles desde el panel.
5. **Authentication → Configuración → Dominios autorizados:** agregar el dominio de Vercel cuando lo tengas (ej. `sot-coaching.vercel.app`).

## 2. Correr en local

```bash
npm install
npm run dev
```

Abrí http://localhost:5173, entrá con tu email de coach y en **Jugadores** tocá **Cargar plantel inicial**: crea los 7 accesos y te muestra usuario y contraseña de cada uno (copialos, no se vuelven a mostrar).

## 3. Deploy en Vercel

1. Subí la carpeta a un repo de GitHub.
2. En Vercel: *Add New → Project*, elegí el repo. Framework: **Vite** (lo detecta solo). Build: `npm run build`, output: `dist`.
3. Deploy. `vercel.json` ya resuelve las rutas internas (`/scrims`, `/playbook`…).
4. Agregá el dominio de Vercel en *Dominios autorizados* de Firebase (paso 1.5).

## Panel /admin (solo super admin)

- Crear usuarios con usuario (o email real) y contraseña, y rol **Jugador**, **Coach** o **Super admin**.
- Cambiar el rol de cualquier usuario y activarlo o desactivarlo (no podés tocar tu propio usuario).
- Los roles se guardan en `sot_users`. Jugador = ve su ficha, playbook y biblioteca. Coach = toda la app. Super admin = todo + /admin.

## Jugadores

- **Agregar:** Tablero → “+ Agregar jugador”, o Jugadores → “+ Agregar jugador”. Se crea su acceso con una contraseña inicial.
- **Quitar:** en el detalle del jugador → “Quitar del plantel”. Pierde el acceso al instante; sus datos quedan en el **Archivo** y se puede reactivar.
- **Login del jugador:** usuario (ej. `kai`) y contraseña. Por debajo es el email `kai@sot-coaching.app`.
- **Contraseña olvidada:** como el email es ficticio, no sirve “restablecer contraseña” por mail. Opciones: al agregar al jugador, usar su email real como usuario (así puede restablecerla), o sumar más adelante una función de Firebase para que el coach la cambie desde la app.

## Editar listas

`src/lib/constants.js`: mapas, roles, tipos de estrategia, categorías de la biblioteca y tipos de tarea.
