import { useState } from 'react';
import { createEmployee } from '../../lib/db';
import { UserPlus, CheckCircle2 } from 'lucide-react';

function initials(name) {
  return name.trim().split(' ').filter(Boolean).slice(0,2).map(w => w[0].toUpperCase()).join('');
}

const COLORS = ['#FF4D0C','#7C3AED','#059669','#0891B2','#D97706','#E11D48','#0F172A','#94A3B8'];
const EMPTY = { name: '', cpf: '', phone: '', email: '', password: '', cargo: 'Ajudante de Logística', dailyRate: 150, overtimeRate: 50, color: '#FF4D0C', dataContratacao: '' };

export default function RHAdmissao() {
  const [form, setForm]       = useState({ ...EMPTY });
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    await createEmployee({
      ...form,
      initials: initials(form.name),
      status: 'active',
    });
    setSaving(false);
    setSuccess(true);
    setForm({ ...EMPTY });
    setTimeout(() => setSuccess(false), 4000);
  };

  const f = (key, label, opts = {}) => (
    <div key={key} className={opts.col === 2 ? 'col-span-2' : ''}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>{label}</label>
      {opts.type === 'select' ? (
        <select className="input-field" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}>
          {opts.options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          type={opts.type || 'text'}
          className="input-field"
          placeholder={opts.placeholder}
          required={opts.required}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        />
      )}
    </div>
  );

  return (
    <div className="space-y-6" style={{ maxWidth: '640px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A' }}>Admissão</h1>
        <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>Cadastrar novo colaborador</p>
      </div>

      {success && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderRadius: '12px', background: '#DCFCE7', border: '1px solid #BBF7D0' }}>
          <CheckCircle2 size={18} style={{ color: '#059669' }} />
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#059669' }}>Colaborador cadastrado com sucesso!</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>Dados pessoais</p>
        <div className="grid grid-cols-2 gap-3">
          {f('name',    'Nome completo *',       { col: 2, required: true })}
          {f('cpf',     'CPF',                   { placeholder: '000.000.000-00' })}
          {f('phone',   'Telefone',              { placeholder: '(00) 00000-0000' })}
          {f('email',   'E-mail de acesso *',    { type: 'email', required: true })}
          {f('password','Senha *',               { type: 'password', required: true })}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.07)', margin: '8px 0' }} />
        <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>Contratação</p>
        <div className="grid grid-cols-2 gap-3">
          {f('cargo',           'Cargo', { col: 2, type: 'select', options: ['Ajudante de Logística','Conferente','Motorista','Auxiliar Administrativo','Outro'] })}
          {f('dailyRate',       'Diária (R$)',    { type: 'number' })}
          {f('overtimeRate',    'Hora extra (R$)',{ type: 'number' })}
          {f('dataContratacao', 'Data de admissão', { type: 'date', col: 2 })}
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid rgba(0,0,0,0.07)', margin: '8px 0' }} />
        <div>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '8px' }}>Cor do avatar</label>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                style={{ width: '28px', height: '28px', borderRadius: '8px', background: c, border: form.color === c ? '3px solid #0F172A' : '2px solid transparent', cursor: 'pointer' }} />
            ))}
          </div>
        </div>

        <button type="submit" disabled={saving}
          style={{ width: '100%', padding: '12px', borderRadius: '12px', border: 'none', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', background: saving ? '#E2E8F0' : '#FF4D0C', color: saving ? '#94A3B8' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '8px' }}>
          <UserPlus size={15} /> {saving ? 'Cadastrando...' : 'Cadastrar colaborador'}
        </button>
      </form>
    </div>
  );
}
