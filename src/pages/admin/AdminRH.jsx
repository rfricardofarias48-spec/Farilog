import { useSearchParams } from 'react-router-dom';
import AdminEmployees from './AdminEmployees';
import AdminRHBeneficios from './AdminRHBeneficios';

export default function AdminRH() {
  const [searchParams] = useSearchParams();
  const requested = searchParams.get('tab');
  const tab = requested === 'beneficios' ? 'beneficios' : 'funcionarios';

  return (
    <div>
      {tab === 'funcionarios' && <AdminEmployees />}
      {tab === 'beneficios'   && <AdminRHBeneficios />}
    </div>
  );
}
