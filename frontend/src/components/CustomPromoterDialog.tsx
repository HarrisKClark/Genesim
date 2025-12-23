import { useMemo, useState } from 'react'
import { registerCustomGene, registerCustomPromoter } from '../utils/partLibrary'

interface CustomPromoterDialogProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

export default function CustomPromoterDialog({ isOpen, onClose, onCreated }: CustomPromoterDialogProps) {
  const [name, setName] = useState('pCustom')
  const [activity, setActivity] = useState(1.0)
  const [leak, setLeak] = useState(0.0)

  const [hasActivator, setHasActivator] = useState(false)
  const [activatorGeneName, setActivatorGeneName] = useState('Act1')
  const [actK, setActK] = useState(10.0)
  const [actN, setActN] = useState(2.0)

  const [hasInhibitor, setHasInhibitor] = useState(false)
  const [inhibitorGeneName, setInhibitorGeneName] = useState('Rep1')
  const [repK, setRepK] = useState(10.0)
  const [repN, setRepN] = useState(2.0)

  const validation = useMemo(() => {
    const errs: string[] = []
    if (!name.trim()) errs.push('Promoter name is required.')
    if (!(activity >= 0)) errs.push('Activity must be ≥ 0.')
    if (!(leak >= 0 && leak <= 1)) errs.push('Leak must be between 0 and 1.')
    if (hasActivator) {
      if (!activatorGeneName.trim()) errs.push('Activator gene name is required.')
      if (!(actK > 0)) errs.push('Activator K must be > 0.')
      if (!(actN > 0)) errs.push('Activator n must be > 0.')
    }
    if (hasInhibitor) {
      if (!inhibitorGeneName.trim()) errs.push('Inhibitor gene name is required.')
      if (!(repK > 0)) errs.push('Inhibitor K must be > 0.')
      if (!(repN > 0)) errs.push('Inhibitor n must be > 0.')
    }
    return errs
  }, [name, activity, leak, hasActivator, activatorGeneName, actK, actN, hasInhibitor, inhibitorGeneName, repK, repN])

  const submit = () => {
    if (validation.length) return

    const promoterName = name.trim()
    const activatorName = hasActivator ? activatorGeneName.trim() : undefined
    const inhibitorName = hasInhibitor ? inhibitorGeneName.trim() : undefined

    registerCustomPromoter({
      type: 'promoter',
      name: promoterName,
      subType: 'Custom promoter',
      color: '#4a90e2',
      activity,
      leak,
      activatorName,
      actK,
      actN,
      inhibitorName,
      repK,
      repN,
    })

    if (hasActivator) {
      registerCustomGene({
        type: 'gene',
        name: activatorName!,
        subType: 'Custom activator',
        color: '#50c878',
        geneClass: 'activator',
      })
    }

    if (hasInhibitor) {
      registerCustomGene({
        type: 'gene',
        name: inhibitorName!,
        subType: 'Custom repressor',
        color: '#50c878',
        geneClass: 'repressor',
      })
    }

    onCreated()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.35)',
        zIndex: 4000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onMouseDown={onClose}
    >
      <div
        style={{
          width: 520,
          background: '#fff',
          border: '1px solid #333',
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
          fontFamily: 'Courier New, monospace',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #eee', fontWeight: 700 }}>
          Add custom promoter
        </div>

        <div style={{ padding: 14, display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#444' }}>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ padding: '8px 10px', border: '1px solid #ddd' }} />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#444' }}>
              Activity
              <input
                type="number"
                value={activity}
                onChange={(e) => setActivity(Number(e.target.value))}
                style={{ padding: '8px 10px', border: '1px solid #ddd' }}
              />
            </label>

            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#444' }}>
              Leak (0..1)
              <input
                type="number"
                value={leak}
                onChange={(e) => setLeak(Number(e.target.value))}
                style={{ padding: '8px 10px', border: '1px solid #ddd' }}
              />
            </label>
          </div>

          <div style={{ borderTop: '1px solid #eee', paddingTop: 10 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#444' }}>
              <input type="checkbox" checked={hasActivator} onChange={(e) => setHasActivator(e.target.checked)} />
              Add corresponding activator gene
            </label>

            {hasActivator && (
              <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#444' }}>
                  Activator gene name
                  <input
                    value={activatorGeneName}
                    onChange={(e) => setActivatorGeneName(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid #ddd' }}
                  />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#444' }}>
                    Activator K
                    <input
                      type="number"
                      value={actK}
                      onChange={(e) => setActK(Number(e.target.value))}
                      style={{ padding: '8px 10px', border: '1px solid #ddd' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#444' }}>
                    Activator n
                    <input
                      type="number"
                      value={actN}
                      onChange={(e) => setActN(Number(e.target.value))}
                      style={{ padding: '8px 10px', border: '1px solid #ddd' }}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid #eee', paddingTop: 10 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: '#444' }}>
              <input type="checkbox" checked={hasInhibitor} onChange={(e) => setHasInhibitor(e.target.checked)} />
              Add corresponding inhibitor (repressor) gene
            </label>

            {hasInhibitor && (
              <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#444' }}>
                  Inhibitor gene name
                  <input
                    value={inhibitorGeneName}
                    onChange={(e) => setInhibitorGeneName(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid #ddd' }}
                  />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#444' }}>
                    Inhibitor K
                    <input
                      type="number"
                      value={repK}
                      onChange={(e) => setRepK(Number(e.target.value))}
                      style={{ padding: '8px 10px', border: '1px solid #ddd' }}
                    />
                  </label>
                  <label style={{ display: 'grid', gap: 6, fontSize: 12, color: '#444' }}>
                    Inhibitor n
                    <input
                      type="number"
                      value={repN}
                      onChange={(e) => setRepN(Number(e.target.value))}
                      style={{ padding: '8px 10px', border: '1px solid #ddd' }}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {validation.length > 0 && (
            <div style={{ color: '#e74c3c', fontSize: 12 }}>
              {validation.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 14px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={validation.length > 0}>
            Create
          </button>
        </div>
      </div>
    </div>
  )
}


