import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import Tablero from './pages/Tablero';
import Scrims from './pages/Scrims';
import Playbook from './pages/Playbook';
import Biblioteca from './pages/Biblioteca';
import Tareas from './pages/Tareas';
import Jugadores from './pages/Jugadores';
import MiFicha from './pages/MiFicha';
import Admin from './pages/Admin';

export default function App() {
  const { role, user, logout } = useAuth();

  if (role === 'loading') {
    return <div className="login"><img src="/sot-isotipo.png" alt="Storm of Thorns" width="96" /></div>;
  }

  if (role === 'out') return <Login />;

  if (role === 'none') {
    return (
      <div className="login">
        <div className="stack" style={{ maxWidth: 420, textAlign: 'center', alignItems: 'center' }}>
          <img src="/sot-isotipo.png" alt="" width="80" />
          <h1 className="d h2">Sin acceso</h1>
          <p className="muted">La cuenta {user?.email} no tiene acceso a SOT Coaching o fue dada de baja del plantel.</p>
          <button className="btn btn-ghost" onClick={logout}>Salir</button>
        </div>
      </div>
    );
  }

  if (role === 'player') {
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<MiFicha />} />
          <Route path="/playbook" element={<Playbook />} />
          <Route path="/biblioteca" element={<Biblioteca />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Tablero />} />
        <Route path="/scrims" element={<Scrims />} />
        <Route path="/playbook" element={<Playbook />} />
        <Route path="/biblioteca" element={<Biblioteca />} />
        <Route path="/tareas" element={<Tareas />} />
        <Route path="/jugadores" element={<Jugadores />} />
        {role === 'superadmin' && <Route path="/admin" element={<Admin />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
