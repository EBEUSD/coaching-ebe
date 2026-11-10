import { Suspense, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth';
import { Loading } from './ui';

const COACH_NAV = [
  // ['/tablero', 'Tablero'], // desactivado por ahora
  ['/', 'Calendario'],
  ['/scrims', 'Scrims'],
  ['/playbook', 'Playbook'],
  ['/biblioteca', 'Biblioteca'],
  ['/tareas', 'Tareas'],
  ['/jugadores', 'Jugadores'],
];

const PLAYER_NAV = [
  ['/', 'Mi ficha'],
  ['/calendario', 'Calendario'],
  ['/playbook', 'Playbook'],
  ['/biblioteca', 'Biblioteca'],
];

export default function Layout() {
  const { role, staff, player, profile, logout } = useAuth();
  const { pathname } = useLocation();
  const nav = staff ? [...COACH_NAV, ...(role === 'superadmin' ? [['/admin', 'Admin']] : [])] : PLAYER_NAV;
  const who = role === 'superadmin' ? 'Super admin' : role === 'coach' ? (profile?.name || 'Coach') : player?.nick;

  // En el celular el menú se desliza: deja la sección activa a la vista.
  useEffect(() => {
    document.querySelector('.nav a.active')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [pathname]);

  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img src="/sot-isotipo.png" alt="Storm of Thorns" />
          <span className="d" style={{ fontSize: 22 }}>SOT</span>
        </NavLink>
        <nav className="nav lbl" aria-label="Secciones">
          {nav.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>
          ))}
        </nav>
        <div className="row">
          <span className="muted small">{who}</span>
          <button className="btn" onClick={logout}>Salir</button>
        </div>
      </header>
      <Suspense fallback={<main className="page"><Loading /></main>}>
        <Outlet />
      </Suspense>
    </>
  );
}
