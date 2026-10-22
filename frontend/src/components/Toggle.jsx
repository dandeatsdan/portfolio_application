/** Accessible native switch. The surrounding label supplies its accessible name. */
export default function Toggle({ checked, onChange, ...props }) {
  return <input {...props} className="optimiser-switch" type="checkbox" role="switch" checked={checked} onChange={onChange} />
}
