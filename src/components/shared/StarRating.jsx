import { Star } from 'lucide-react';
import { fmtNota, notaCor } from '../../lib/notas';

function clamp(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, n));
}

// Estrelas com preenchimento parcial — ideal para médias (ex.: 4,3).
export function StarsDisplay({ value = 0, size = 12, gap = 1, color = '#BC4A2A', emptyColor = '#E6E6E6' }) {
  const v = clamp(value);
  const pct = (v / 5) * 100;
  const starStyle = { flexShrink: 0 };
  return (
    <span
      role="img"
      aria-label={`${v.toFixed(1)} de 5`}
      style={{ position: 'relative', display: 'inline-flex', lineHeight: 0, flexShrink: 0 }}
    >
      <span style={{ display: 'inline-flex', gap }}>
        {[0, 1, 2, 3, 4].map(i => (
          <Star key={i} size={size} strokeWidth={1.7} style={{ ...starStyle, color: emptyColor, fill: emptyColor }} />
        ))}
      </span>
      <span style={{
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: `${pct}%`, overflow: 'hidden', display: 'inline-flex',
      }}>
        <span style={{ display: 'inline-flex', gap, flexShrink: 0 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <Star key={i} size={size} strokeWidth={1.7} style={{ ...starStyle, color, fill: color }} />
          ))}
        </span>
      </span>
    </span>
  );
}

// Seletor de nota 0–5. `value = null` significa "ainda sem nota".
export default function StarRating({
  value = null,
  onChange,
  size = 18,
  readOnly = false,
  allowZero = true,
  showValue = true,
}) {
  const hasValue = value !== null && value !== undefined;
  const v = hasValue ? clamp(value) : 0;

  if (readOnly) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <StarsDisplay value={v} size={size} />
        {showValue && (
          <span style={{ fontSize: '12px', fontWeight: 800, color: notaCor(hasValue ? v : null) }}>
            {fmtNota(hasValue ? v : null)}
          </span>
        )}
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          aria-label={`${n} estrela${n > 1 ? 's' : ''}`}
          title={`${n} estrela${n > 1 ? 's' : ''}`}
          style={{ background: 'none', border: 'none', padding: '1px', cursor: 'pointer', lineHeight: 0 }}
        >
          <Star
            size={size}
            strokeWidth={1.8}
            style={{
              color: hasValue && n <= v ? '#BC4A2A' : '#D1D1D1',
              fill: hasValue && n <= v ? '#BC4A2A' : 'transparent',
              transition: 'all .1s',
            }}
          />
        </button>
      ))}
      {allowZero && (
        <button
          type="button"
          onClick={() => onChange?.(0)}
          title="Nota 0"
          style={{
            marginLeft: '4px', fontSize: '10px', fontWeight: 800,
            padding: '2px 6px', borderRadius: '5px', cursor: 'pointer',
            background: hasValue && v === 0 ? '#0B0B0B' : '#F4F4F5',
            color: hasValue && v === 0 ? '#FFFFFF' : '#6B6B6B',
            border: `1px solid ${hasValue && v === 0 ? '#0B0B0B' : '#E6E6E6'}`,
          }}
        >
          0
        </button>
      )}
      {showValue && (
        <span style={{ marginLeft: '4px', fontSize: '12px', fontWeight: 800, color: notaCor(hasValue ? v : null), minWidth: '24px' }}>
          {hasValue ? fmtNota(v) : '—'}
        </span>
      )}
    </span>
  );
}

export function NotaBadge({ media, total, size = 11 }) {
  if (media == null) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: '6px',
        background: '#F4F4F5', color: '#9A9A9A', fontSize: '10px', fontWeight: 700,
      }}>
        Sem nota
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 7px', borderRadius: '6px',
      background: '#F4F4F5', color: '#0B0B0B', fontSize: '10px', fontWeight: 800,
    }}>
      <StarsDisplay value={media} size={size} />
      {fmtNota(media)}
      {total != null && <span style={{ color: '#9A9A9A', fontWeight: 600 }}>({total})</span>}
    </span>
  );
}