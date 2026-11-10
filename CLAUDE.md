# SOT Coaching — contexto del proyecto

App de coaching de Valorant para el equipo **Storm of Thorns (SOT)**. La usa el coach (yo, Ebeus) para registrar día a día clases, teóricos, scrims ronda por ronda, playbook por mapa y tareas de cada jugador. Los jugadores entran con su propio usuario y solo ven su ficha, el playbook y la biblioteca (solo lectura).

Respondé en español rioplatense. Prefiero respuestas concisas y bloques de código completos listos para pegar. Corregimos de forma incremental, sin reescribir todo.

## Stack
- React 18 + Vite 5 + react-router-dom 6. JS plano (sin TypeScript). CSS propio en `src/styles.css` (sin Tailwind).
- Firebase 11: Auth (email/contraseña), Firestore, Storage. Proyecto compartido `landing-creator-469a5` (plan Blaze), que también usa otra app mía, Landing Creator.
- Deploy en Vercel (`vercel.json` reescribe todo a `index.html`).

## Estructura
- `src/firebase.js` — config, `auth`, `db`, `storage`, `toEmail()` (usuario → `usuario@sot-coaching.app`), `createPlayerAccount()` (crea cuentas con una app secundaria en memoria para no cerrar la sesión del admin), constantes `C` con nombres de colecciones.
- `src/auth.jsx` — `AuthProvider`/`useAuth`: `role` ('loading' | 'out' | 'superadmin' | 'coach' | 'player' | 'none'), `staff` (coach o superadmin), `user`, `player`, `profile`, `login`, `logout`.
- `src/App.jsx` — rutas por rol. Staff: `/`, `/scrims`, `/playbook`, `/biblioteca`, `/tareas`, `/jugadores` y `/admin` (solo superadmin). Jugador: `/` (MiFicha), `/playbook`, `/biblioteca`.
- `src/components/` — `Layout` (topbar + nav), `ui.jsx` (Modal, Icon, ICONS, Check, Loading), `PlayerAdmin.jsx` (addPlayer, playerProfile, setPlayerActive, AddPlayerForm, CredentialsModal, RemovePlayer), `Ficha.jsx` (ficha de jugador, editable o de solo lectura).
- `src/pages/` — Login, Tablero, Scrims, Playbook, Biblioteca, Tareas, Jugadores, MiFicha, Admin.
- `src/lib/constants.js` — MAPS, ROLES, STRAT_TYPES, STRAT_STATES, LIB_CATS, TASK_KINDS, BUYS, ROUND_ENDS, INITIAL_ROSTER.
- `src/lib/utils.js` — fechas (`dateKey`, `todayKey`, `addDays`, `shortDate`, `dayTitle`), `randomPassword`, `slugUser`, `byNick`, `useLive(make, deps)` (onSnapshot sobre una query o un doc; devuelve `{data, loading, error}`), `errMsg` (errores de Firebase en español).
- `functions/` — Cloud Functions (codebase `sot-coaching` en `firebase.json`, para no pisar funciones de Landing Creator). `sotSetPassword({uid, password})`: solo superadmin y solo cuentas que estén en `sot_users`/`sot_players`. Deploy: `npx firebase-tools deploy --only functions:sot-coaching`. No poner `engines` en `functions/package.json` (el gestor de Node local exige tener esa versión instalada); el runtime va en `firebase.json`.
- `firebase/firestore.rules` y `firebase/storage.rules` — reglas completas (ya publicadas en la consola). Si las cambiás, hay que pegarlas a mano en la consola de Firebase.

## Modelo de datos (Firestore, todo con prefijo `sot_`)
- `sot_coaches/{uid}` — superadmin de respaldo, creado a mano en la consola (el mío). Las reglas impiden escribirlo desde la app.
- `sot_users/{uid}` — `{username, name, nick, role: 'superadmin'|'coach'|'player', active, createdAt}`.
- `sot_players/{uid}` — ficha del plantel: `{nick, name, role (rol en el equipo), username, agents, strengths, improve, goals:[{text, done}], active, createdAt}`. El ID es el uid de la cuenta.
- `sot_days/{YYYY-MM-DD}` — `{theoryId, teamNotes}`.
- `sot_notes/{fecha}_{playerId}` — `{date, playerId, note, focus, kind}`.
- `sot_tasks/{id}` — `{playerId, title, kind, due (YYYY-MM-DD), done}`.
- `sot_scrims/{id}` — `{date, map, rival, startSide, vod, rounds:[{r:'W'|'L', buy, rivalBuy, how, strat, note}], stats:[{playerId, nick, agent, k, d, a, acs, fb, note}], good, fix, next}`.
- `sot_strats/{id}` — `{map, side:'Ataque'|'Defensa', type, site, name, state, desc, roles:[{who, what}], image, vod}`.
- `sot_library/{id}` — `{title, cat, kind:'PDF'|'Video'|'Link'|'Imagen'|'Archivo', url, path (Storage), tags[], date}`.
- Storage: archivos en `sot/library/...` y `sot/strats/{id}/...`.

## Permisos (reglas)
- Superadmin = documento en `sot_coaches` o `sot_users` con role superadmin y active. Coach = role coach y active. Staff = superadmin o coach.
- Jugador = `sot_players/{uid}.active == true`. Lee su propia ficha y sus `sot_notes`/`sot_tasks` (las queries tienen que filtrar por `where('playerId','==',uid)`), más `sot_strats` y `sot_library`.
- `sot_days` y `sot_scrims`: solo staff. Un coach solo puede crear o editar usuarios jugador; el superadmin maneja todo.
- Landing Creator: sus colecciones (`calEvents`, `stores`, `teams`, `wishlists`) siguen públicas a propósito; en Storage queda público todo lo que no está en `sot/`. NO romper eso. Usa login anónimo; cerrarlas queda pendiente.
- Evitar queries que necesiten índices compuestos: filtrar con un solo `where` y ordenar del lado del cliente.

## Marca (manual de Storm of Thorns)
- Colores: Negro Ciclón #0A0708 (fondo, domina), Blanco Vendaval #F6F5F8, Espina Carmesí #CE093D (acento, máx. 15 %, nunca de fondo de pieza), Vino Tormenta #790B40, Raíz #3E001C (placas), Acero Espina #4B4A52. UI extra: surface #141012, muted #A9A7AE (el carmesí y el acero no pasan contraste como texto chico sobre negro).
- Tipografías: Big Shoulders Display 900/700 en mayúsculas para títulos (clase `.d`); Barlow Semi Condensed 400/600/700 para el texto; etiquetas 700 con interletra (`.lbl`).
- Recursos: “corte” (esquinas en ángulo: `.tag`, `.btn-primary`, `.card-cut`) y “espina” (lanza horizontal). No usar otras formas, gradientes decorativos ni emojis.
- Logo: `public/sot-isotipo.png`. No deformar, recolorear, rotar ni bajarle la opacidad, ni ponerlo sobre carmesí o vino.
- UX: limpia y con aire, poca información a la vista y el detalle al seleccionar. Acentos solo en el estado activo. Targets de 44 px como mínimo.

## Plantel
Joshua (Emiliano, Flex), Keiks (Fabián, Centinela), Meiz (José, Iniciador/Smoker), Hype (Diego, Flex), Nothing (Julio, Iniciador), Leono (Leo, IGL/Smoker), Kai (Martín, Duelista). Se carga con “Cargar plantel inicial” en Jugadores o desde /admin.

## Estado y pendientes
- Hecho: todas las pantallas, alta y baja de jugadores (baja = active false, quedan archivados), panel /admin con roles, reglas publicadas.
- Pendiente / ideas:
  1. ~~Cambiar contraseñas desde /admin~~ — hecho (botón «Contraseña» en /admin + `sotSetPassword`). Falta desplegar la función.
  2. Code-splitting (el bundle pesa ~730 kB).
  3. Cerrar las reglas de Landing Creator (usa auth anónima).
  4. Dashboard de stats por jugador a partir de los scrims.
- Antes de cambiar el modelo de datos o las reglas, avisame qué cambia y dame las reglas completas para pegar en la consola.
