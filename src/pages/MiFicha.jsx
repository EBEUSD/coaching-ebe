import { useAuth } from '../auth';
import Ficha from '../components/Ficha';

export default function MiFicha() {
  const { user } = useAuth();
  return (
    <main className="page narrow">
      <Ficha playerId={user.uid} editable={false} canCheck />
    </main>
  );
}
