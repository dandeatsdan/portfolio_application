export default function Select({ value, onChange, options, style = {}, ...props }) {
  return (
    <select
      {...props}
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        fontSize: 12, padding: '3px 6px',
        border: '1px solid var(--color-border)',
        borderRadius: 4, background: '#fff',
        color: 'var(--color-text)', cursor: 'pointer', ...style,
      }}
    >
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  )
}

