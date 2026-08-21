import React from 'react'
import { toast } from 'react-toastify'

/**
 * Standardized undo toast notification.
 * Automatically and immediately closes the toast when Undo is clicked,
 * preventing lingering toasts, duplicate clicks, and contradictory UI states.
 *
 * @param {Object} params
 * @param {string|React.ReactNode} params.message - Main message (e.g. 'Deleted "Doritos"')
 * @param {string|React.ReactNode} [params.subtitle] - Secondary note (e.g. 'Snapshot backup retained.')
 * @param {Function} params.onUndo - Callback to execute on click (can be async)
 * @param {string} [params.undoText='Undo'] - Text on the action button
 * @param {number} [params.autoClose=6000] - Duration in ms before auto dismiss
 * @param {Object} [params.toastOptions] - Additional react-toastify options
 */
export function showUndoToast({
  message,
  subtitle,
  onUndo,
  undoText = 'Undo',
  autoClose = 6000,
  toastOptions = {}
}) {
  let executing = false

  return toast.info(
    ({ closeToast }) => (
      <div
        style={{
          display: 'flex',
          flexDirection: subtitle ? 'column' : 'row',
          alignItems: subtitle ? 'flex-start' : 'center',
          justifyContent: 'space-between',
          width: '100%',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <span style={{ fontWeight: subtitle ? 700 : 500 }}>{message}</span>
          {subtitle && (
            <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>{subtitle}</span>
          )}
        </div>
        <button
          className="btn-primary btn-sm"
          style={{
            padding: '0.25rem 0.6rem',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            fontWeight: 750,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            marginTop: subtitle ? '0.25rem' : 0,
            alignSelf: subtitle ? 'flex-start' : 'center'
          }}
          onClick={async (e) => {
            e.stopPropagation()
            if (executing) return
            executing = true
            closeToast()
            try {
              if (onUndo) await onUndo()
            } catch (err) {
              console.error('Undo action failed:', err)
            }
          }}
        >
          {undoText}
        </button>
      </div>
    ),
    {
      autoClose,
      closeOnClick: false,
      ...toastOptions
    }
  )
}
