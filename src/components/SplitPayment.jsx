import { Banknote, Smartphone, CheckCircle2 } from 'lucide-react'
import { formatRupees } from '../lib/helpers'
import { Field } from './UI'

/**
 * SplitPayment — Reusable cash + online payment collection component.
 *
 * Props:
 *   cashValue      {string}   — controlled cash amount input value
 *   onlineValue    {string}   — controlled online amount input value
 *   onCashChange   {fn}       — called with new string value for cash
 *   onOnlineChange {fn}       — called with new string value for online
 *   totalBill      {number}   — total bill amount to compute outstanding/paid status
 *   label          {string}   — optional section label (default: "Payment Collection")
 *   compact        {boolean}  — if true, uses smaller layout (for modals)
 */
export default function SplitPayment({
  cashValue = '',
  onlineValue = '',
  onCashChange,
  onOnlineChange,
  totalBill = 0,
  label = 'Payment Collection',
  compact = false,
}) {
  const cash = Number(cashValue || 0)
  const online = Number(onlineValue || 0)
  const totalPaid = cash + online
  const credit = Math.max(totalBill - totalPaid, 0)
  const fullyPaid = totalBill > 0 && totalPaid >= totalBill
  const hasInput = cashValue !== '' || onlineValue !== ''

  const inputStyle = compact
    ? { fontSize: '0.85rem', padding: '0.4rem 0.6rem 0.4rem 2rem' }
    : {}

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <p style={{
        fontSize: '0.725rem', fontWeight: 800, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        display: 'flex', alignItems: 'center', gap: '0.4rem', margin: 0
      }}>
        <Banknote size={14} style={{ color: 'var(--accent)' }} />
        {label}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
        <Field label="Cash Received (₹)">
          <div style={{ position: 'relative' }}>
            <Banknote
              size={13}
              style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }}
            />
            <input
              type="number"
              className="input"
              placeholder="0"
              style={{ paddingLeft: '2rem', ...inputStyle }}
              value={cashValue}
              onChange={e => onCashChange?.(e.target.value)}
              min="0"
            />
          </div>
        </Field>

        <Field label="Online Received (₹)">
          <div style={{ position: 'relative' }}>
            <Smartphone
              size={13}
              style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-faint)', pointerEvents: 'none' }}
            />
            <input
              type="number"
              className="input"
              placeholder="0"
              style={{ paddingLeft: '2rem', ...inputStyle }}
              value={onlineValue}
              onChange={e => onOnlineChange?.(e.target.value)}
              min="0"
            />
          </div>
        </Field>
      </div>

      {/* Payment Summary Strip */}
      {hasInput && (
        <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {cash > 0 && (
            <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
              Cash: {formatRupees(cash)}
            </span>
          )}
          {online > 0 && (
            <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
              Online: {formatRupees(online)}
            </span>
          )}
          {totalPaid > 0 && (
            <>
              <span className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>
                Total: {formatRupees(totalPaid)}
              </span>
              {totalBill > 0 && (
                fullyPaid
                  ? <span className="badge badge-success" style={{ fontSize: '0.7rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      <CheckCircle2 size={11} /> Fully Paid
                    </span>
                  : credit > 0
                    ? <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                        Outstanding: {formatRupees(credit)}
                      </span>
                    : null
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
