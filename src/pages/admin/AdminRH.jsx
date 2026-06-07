import { useSearchParams } from 'react-router-dom';
import AdminEmployees from './AdminEmployees';
import AdminRHBeneficios from './AdminRHBeneficios';
import AdminRHPonto from './AdminRHPonto';
import AdminRHEPI from './AdminRHEPI';

export default function AdminRH() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') || 'funcionarios';

  return (
    <div>
      {tab === 'funcionarios' && <AdminEmployees />}
      {tab === 'beneficios'   && <AdminRHBeneficios />}
      {tab === 'ponto'        && <AdminRHPonto />}
      {tab === 'epi'          && <AdminRHEPI />}
    </div>
  );
}
