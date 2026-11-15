import { whatsappLink } from '../../lib/notas';

export const WhatsAppIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.855L.057 23.884a.5.5 0 0 0 .606.634l6.193-1.623A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22a9.944 9.944 0 0 1-5.127-1.415l-.368-.218-3.812 1 1.02-3.718-.24-.382A9.944 9.944 0 0 1 2 12C2 6.478 6.478 2 12 2s10 4.478 10 10-4.478 10-10 10z" />
  </svg>
);

export default function WhatsAppButton({
  phone,
  message,
  label = 'WhatsApp',
  size = 13,
  compact = false,
  style,
}) {
  const href = whatsappLink(phone, message);
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      title={`Abrir conversa no WhatsApp${phone ? ` — ${phone}` : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: compact ? '5px 8px' : '7px 11px', borderRadius: '8px',
        background: '#FFFFFF', color: '#0B0B0B', textDecoration: 'none',
        border: '1px solid #E6E6E6',
        fontSize: compact ? '10px' : '12px', fontWeight: 800, flexShrink: 0,
        ...style,
      }}
    >
      <WhatsAppIcon size={size} /> {label}
    </a>
  );
}