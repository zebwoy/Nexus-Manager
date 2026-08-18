import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { formatRupees, formatTime } from '../lib/helpers'
import { Modal, Field, Spinner } from './UI'
import { Monitor, Gamepad2, Tv, Clock, Plus, Zap, ArrowRightLeft, CheckCircle, AlertTriangle, Coffee } from 'lucide-react'
import { toast } from 'react-toastify'

function StationCountdown({ timeOut }) {
  const [minsLeft, setMinsLeft] = useState(0)
  const [label, setLabel] = useState('')
  const [isOver, setIsOver] = useState(false)

  useEffect(() => {
    const tick = () => {
      const diff = new Date(timeOut) - new Date()
      const m = Math.floor(diff / 60000)
      setMinsLeft(m)
      if (diff <= 0) {
        setLabel('Overdue')
        setIsOver(true)
      } else {
        const h = Math.floor(m / 60)
        const rem = m % 60
        setLabel(h > 0 ? `${h}h ${rem}m left` : `${rem}m left`)
        setIsOver(false)
      }
    }
    tick()
    const id = setInterval(tick, 15000)
    return () => clearInterval(id)
  }, [timeOut])

  const isUrgent = minsLeft > 0 && minsLeft <= 10

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
      <span className={`led-indicator ${isOver ? 'led-red' : isUrgent ? 'led-red animate-pulse' : 'led-green'}`} style={{ width: '6px', height: '6px' }} />
      <span style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', fontWeight: 800,
        color: isOver ? 'var(--danger)' : isUrgent ? 'var(--warning)' : 'var(--success)'
      }}>
        {label}
      </span>
    </div>
  )
}

export default function StationGrid({ activeSessions = [], onRefresh, onLaunchNewSession }) {
  const navigate = useNavigate()
  const [devices, setDevices] = useState([])
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)

  // Quick Action Modals
  const [extendSession, setExtendSession] = useState(null)
  const [extendPackets, setExtendPackets] = useState(1)
  const [extendCollect, setExtendCollect] = useState('')
  const [extendSaving, setExtendSaving] = useState(false)

  const [switchSession, setSwitchSession] = useState(null)
  const [targetDevice, setTargetDevice] = useState('')
  const [switchSaving, setSwitchSaving] = useState(false)

  const [endEarlySession, setEndEarlySession] = useState(null)
  const [recalcBill, setRecalcBill] = useState(true)
  const [endEarlySaving, setEndEarlySaving] = useState(false)

  useEffect(() => {
    api.get('/devices').then(d => {
      setDevices(d.devices || [])
    }).finally(() => setLoading(false))
  }, [])

  const filteredDevices = devices.filter(d => {
    if (typeFilter === 'ALL') return true
    return d.type === typeFilter
  })

  // Map each device to active regular session
  const getDeviceSession = (deviceId) => {
    return activeSessions.find(s => s.device_id === deviceId && s.is_active)
  }

  const handleQuickExtend = async () => {
    if (!extendSession) return
    setExtendSaving(true)
    try {
      await api.patch(`/sessions/${extendSession.id}/extend`, {
        packets: Number(extendPackets),
        collect_now: Number(extendCollect || 0),
        payment_method: 'cash'
      })
      toast.success(`Extended session #${extendSession.id} by ${extendPackets * 30} mins`)
      setExtendSession(null)
      if (onRefresh) onRefresh()
    } catch (e) {
      toast.error('Failed to extend: ' + e.message)
    } finally {
      setExtendSaving(false)
    }
  }

  const handleSwitchStation = async () => {
    if (!switchSession || !targetDevice) return
    setSwitchSaving(true)
    try {
      await api.patch(`/sessions/${switchSession.id}/switch-station`, {
        new_device_id: Number(targetDevice)
      })
      toast.success(`Transferred session #${switchSession.id} to new station`)
      setSwitchSession(null)
      if (onRefresh) onRefresh()
    } catch (e) {
      toast.error('Failed to switch station: ' + e.message)
    } finally {
      setSwitchSaving(false)
    }
  }

  const handleEndEarly = async () => {
    if (!endEarlySession) return
    setEndEarlySaving(true)
    try {
      await api.patch(`/sessions/${endEarlySession.id}/end-early`, {
        recalculate: recalcBill
      })
      toast.success(`Session #${endEarlySession.id} checkout complete! Station released.`)
      setEndEarlySession(null)
      if (onRefresh) onRefresh()
    } catch (e) {
      toast.error('Failed to end session: ' + e.message)
    } finally {
      setEndEarlySaving(false)
    }
  }

  const getDeviceIcon = (type) => {
    if (type === 'PC') return <Monitor size={16} />
    if (type === 'PS') return <Tv size={16} />
    return <Gamepad2 size={16} />
  }

  const availableDevicesForSwitch = devices.filter(d => {
    return d.is_active && !getDeviceSession(d.id) && (!switchSession || d.id !== switchSession.device_id)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* Quick Extend Modal */}
      <Modal open={!!extendSession} onClose={() => setExtendSession(null)} title="Quick Extend Station Time">
        {extendSession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Extending session for <strong>{extendSession.name || 'Anonymous'}</strong> on <strong>{extendSession.device_label}</strong>
            </p>
            <Field label="Extension Duration">
              <select className="input" value={extendPackets} onChange={e => setExtendPackets(Number(e.target.value))}>
                <option value={1}>+30 Minutes</option>
                <option value={2}>+1 Hour (60m)</option>
                <option value={3}>+1.5 Hours (90m)</option>
                <option value={4}>+2 Hours (120m)</option>
              </select>
            </Field>
            <Field label="Collect Payment Now (₹, optional)">
              <input type="number" className="input" placeholder="Leave blank to add to credit due"
                value={extendCollect} onChange={e => setExtendCollect(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
              <button onClick={handleQuickExtend} disabled={extendSaving} className="btn-primary" style={{ flex: 1 }}>
                {extendSaving ? <><Spinner size="sm" /> Extending...</> : `Confirm +${extendPackets * 30}m`}
              </button>
              <button onClick={() => setExtendSession(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Switch Station Modal */}
      <Modal open={!!switchSession} onClose={() => setSwitchSession(null)} title="Transfer Gamer to Another Station">
        {switchSession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Moving <strong>{switchSession.name || 'Client'}</strong> from <strong>{switchSession.device_label}</strong>
            </p>
            <Field label="Select Free Target Station" required>
              <select className="input" value={targetDevice} onChange={e => setTargetDevice(e.target.value)}>
                <option value="">-- Choose Available Station --</option>
                {availableDevicesForSwitch.map(d => (
                  <option key={d.id} value={d.id}>{d.label} ({d.type})</option>
                ))}
              </select>
            </Field>
            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
              <button onClick={handleSwitchStation} disabled={switchSaving || !targetDevice} className="btn-primary" style={{ flex: 1 }}>
                {switchSaving ? <><Spinner size="sm" /> Switching...</> : 'Confirm Transfer'}
              </button>
              <button onClick={() => setSwitchSession(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      {/* End Early Modal */}
      <Modal open={!!endEarlySession} onClose={() => setEndEarlySession(null)} title="End Session &amp; Release Station">
        {endEarlySession && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Checkout <strong>{endEarlySession.name || 'Client'}</strong> and free up <strong>{endEarlySession.device_label}</strong> immediately.
            </p>
            <div style={{
              background: 'var(--bg-input)', padding: '0.85rem', borderRadius: '10px',
              border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem'
            }}>
              <input type="checkbox" id="recalcCheck" checked={recalcBill} onChange={e => setRecalcBill(e.target.checked)} style={{ cursor: 'pointer' }} />
              <label htmlFor="recalcCheck" style={{ fontSize: '0.825rem', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, marginBottom: 0 }}>
                Prorate tariff based on actual time elapsed
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1.5px solid var(--border)', paddingTop: '1rem' }}>
              <button onClick={handleEndEarly} disabled={endEarlySaving} className="btn-danger" style={{ flex: 1 }}>
                {endEarlySaving ? <><Spinner size="sm" /> Checking out...</> : 'End Session & Free Station'}
              </button>
              <button onClick={() => setEndEarlySession(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', background: 'var(--bg-input)', borderRadius: '10px', padding: '3px', border: '1.5px solid var(--border)', gap: '2px' }}>
          {[
            { key: 'ALL',  label: `⚡ All Stations (${devices.length})` },
            { key: 'PC',   label: `🖥️ PCs (${devices.filter(d => d.type === 'PC').length})` },
            { key: 'PS',   label: `🎮 PS5 (${devices.filter(d => d.type === 'PS').length})` },
            { key: 'XBOX', label: `🕹️ Xbox (${devices.filter(d => d.type === 'XBOX').length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTypeFilter(t.key)}
              style={{
                padding: '0.35rem 0.75rem', borderRadius: '8px', cursor: 'pointer', border: 'none',
                fontSize: '0.775rem', fontWeight: 700,
                background: typeFilter === t.key ? 'var(--accent)' : 'transparent',
                color: typeFilter === t.key ? 'var(--btn-primary-text, #fff)' : 'var(--text-muted)',
                transition: 'all 0.15s'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span className="led-indicator led-green" style={{ width: '8px', height: '8px' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 650 }}>
              {devices.length - activeSessions.length} Available
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span className="led-indicator led-red" style={{ width: '8px', height: '8px' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 650 }}>
              {activeSessions.length} Occupied
            </span>
          </div>
        </div>
      </div>

      {/* Visual Station Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1.25rem'
      }}>
        {filteredDevices.map(device => {
          const session = getDeviceSession(device.id)
          const isOccupied = !!session

          if (!isOccupied) {
            return (
              <div
                key={device.id}
                className="card"
                style={{
                  padding: '1.25rem', display: 'flex', flexDirection: 'column',
                  justifyContent: 'space-between', minHeight: '160px',
                  background: 'var(--bg-elevated)', transition: 'transform 0.15s, border-color 0.15s',
                  borderColor: 'var(--border)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '8px',
                        background: 'var(--bg-input)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-text)'
                      }}>
                        {getDeviceIcon(device.type)}
                      </div>
                      <span style={{ fontWeight: 800, fontSize: '0.925rem', color: 'var(--text)' }}>{device.label}</span>
                    </div>
                    <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>🟢 FREE</span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>
                    Type: {device.type} Station · Ready
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <Link
                    to={`/sessions/new?device_id=${device.id}`}
                    className="btn-primary"
                    style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.775rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
                  >
                    <Plus size={13} /> Start Session
                  </Link>
                </div>
              </div>
            )
          }

          // Occupied Station Card
          const diffMins = Math.max(0, Math.floor((new Date(session.time_out) - new Date()) / 60000))
          const totalDuration = Number(session.duration_mins || 60)
          const elapsedMins = Math.max(0, totalDuration - diffMins)
          const progressPct = Math.min(100, Math.round((elapsedMins / totalDuration) * 100))

          return (
            <div
              key={device.id}
              className="card"
              style={{
                padding: '1.25rem', display: 'flex', flexDirection: 'column',
                justifyContent: 'space-between', minHeight: '175px',
                background: 'var(--bg-elevated)',
                border: '1.5px solid var(--accent)',
                boxShadow: '0 0 16px var(--accent-dim)'
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '8px',
                      background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-text)'
                    }}>
                      {getDeviceIcon(device.type)}
                    </div>
                    <div>
                      <span style={{ fontWeight: 800, fontSize: '0.925rem', color: 'var(--text)' }}>{device.label}</span>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', fontFamily: "'JetBrains Mono', monospace" }}>#{session.id}</p>
                    </div>
                  </div>
                  <StationCountdown timeOut={session.time_out} />
                </div>

                <div style={{ marginBottom: '0.65rem' }}>
                  <p style={{ fontWeight: 750, color: 'var(--text)', fontSize: '0.875rem' }}>
                    {session.name || 'Anonymous Client'}
                    {session.shop_name && <span style={{ fontSize: '0.725rem', color: 'var(--text-muted)', marginLeft: '0.35rem' }}>({session.shop_name})</span>}
                  </p>
                  <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace", marginTop: '0.1rem' }}>
                    {formatTime(session.time_in)} → {formatTime(session.time_out)} ({session.duration_mins}m)
                  </p>
                </div>

                {/* Progress bar */}
                <div style={{
                  height: '6px', background: 'var(--bg-input)', borderRadius: '99px',
                  overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '0.5rem'
                }}>
                  <div style={{
                    height: '100%', width: `${progressPct}%`,
                    background: diffMins <= 10 ? 'var(--danger)' : 'var(--accent)',
                    borderRadius: '99px', transition: 'width 0.3s'
                  }} />
                </div>
              </div>

              {/* Station Action Buttons */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.35rem',
                borderTop: '1px solid var(--border)', paddingTop: '0.65rem', marginTop: '0.5rem'
              }}>
                <button
                  onClick={() => setExtendSession(session)}
                  className="btn-secondary btn-sm"
                  style={{ padding: '0.3rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                  title="Extend time"
                >
                  <Clock size={11} /> +30m
                </button>
                <button
                  onClick={() => setSwitchSession(session)}
                  className="btn-secondary btn-sm"
                  style={{ padding: '0.3rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                  title="Move to another station"
                >
                  <ArrowRightLeft size={11} /> Switch
                </button>
                <Link
                  to={`/sessions/${session.id}`}
                  className="btn-primary btn-sm"
                  style={{ padding: '0.3rem', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  Manage →
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
