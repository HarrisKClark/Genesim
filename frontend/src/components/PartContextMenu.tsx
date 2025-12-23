import { useEffect, useMemo, useState } from 'react'
import { getPartTemplate, getPromoterParams, getPromoterStrength, getRbsStrength } from '../utils/partLibrary'

export type PartSource = 'library' | 'placed'

export interface PartRef {
  source: PartSource
  id?: string
  type: string
  name: string
  subType?: string
  color?: string
  length?: number
  position?: number
}

export interface PartContextMenuState {
  x: number
  y: number
  part: PartRef
}

interface PartContextMenuProps {
  menu: PartContextMenuState | null
  onClose: () => void
}

export default function PartContextMenu({ menu, onClose }: PartContextMenuProps) {
  const [showProps, setShowProps] = useState(false)

  useEffect(() => {
    if (!menu) return
    setShowProps(false)
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest?.('[data-part-context-menu="true"]')) return
      onClose()
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menu, onClose])

  const simParams = useMemo(() => {
    if (!menu) return null
    const { part } = menu
    const tmpl = getPartTemplate(part.type, part.name)
    const promoterStrength = part.type === 'promoter' ? getPromoterStrength(part.name) : undefined
    const promoterParams = part.type === 'promoter' ? getPromoterParams(part.name) : undefined
    const rbsStrength = part.type === 'rbs' ? getRbsStrength(part.name) : undefined
    return {
      template: tmpl,
      promoterStrength,
      promoterParams,
      rbsStrength,
    }
  }, [menu])

  if (!menu) return null

  const { x, y, part } = menu
  const title = `${part.name}${part.subType ? ` (${part.subType})` : ''}`

  return (
    <div
      data-part-context-menu="true"
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        background: '#fff',
        border: '1px solid #333',
        padding: '4px',
        zIndex: 3000,
        fontFamily: 'Courier New, monospace',
        fontSize: '11px',
        minWidth: 220,
        boxShadow: '0 6px 18px rgba(0,0,0,0.18)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div style={{ padding: '6px 8px', borderBottom: '1px solid #eee', fontWeight: 700, color: '#222' }}>
        {title}
      </div>

      <div
        style={{ padding: '6px 8px', cursor: 'pointer', borderBottom: showProps ? '1px solid #eee' : 'none' }}
        onClick={() => setShowProps((v) => !v)}
      >
        {showProps ? 'Hide properties' : 'View properties'}
      </div>

      {showProps && (
        <div style={{ padding: '8px' }}>
          <div style={{ marginBottom: 6, color: '#555' }}>
            Source: <span style={{ color: '#111' }}>{part.source}</span>
          </div>
          <div style={{ marginBottom: 6, color: '#555' }}>
            Type: <span style={{ color: '#111' }}>{part.type}</span>
          </div>
          {typeof part.length === 'number' && (
            <div style={{ marginBottom: 6, color: '#555' }}>
              Length: <span style={{ color: '#111' }}>{Math.round(part.length)} bp</span>
            </div>
          )}
          {typeof part.position === 'number' && (
            <div style={{ marginBottom: 6, color: '#555' }}>
              Position: <span style={{ color: '#111' }}>{Math.round(part.position)}</span>
            </div>
          )}

          <div style={{ marginTop: 8, marginBottom: 6, fontWeight: 700, color: '#222' }}>Simulation params</div>

          {part.type === 'promoter' && (
            <>
              <div style={{ marginBottom: 6, color: '#555' }}>
                activity:{' '}
                <span style={{ color: '#111' }}>{simParams?.promoterStrength?.toFixed?.(3) ?? '1.000'}</span>
              </div>
              <div style={{ marginBottom: 6, color: '#555' }}>
                leak:{' '}
                <span style={{ color: '#111' }}>{(simParams?.promoterParams?.leak ?? 0).toFixed(3)}</span>
              </div>
              <div style={{ marginBottom: 6, color: '#555' }}>
                activator:{' '}
                <span style={{ color: '#111' }}>{simParams?.promoterParams?.activatorName ?? 'none'}</span>
              </div>
              <div style={{ marginBottom: 6, color: '#555' }}>
                actK:{' '}
                <span style={{ color: '#111' }}>{(simParams?.promoterParams?.actK ?? 10).toFixed(3)}</span>
              </div>
              <div style={{ marginBottom: 6, color: '#555' }}>
                actN:{' '}
                <span style={{ color: '#111' }}>{(simParams?.promoterParams?.actN ?? 2).toFixed(3)}</span>
              </div>
              <div style={{ marginBottom: 6, color: '#555' }}>
                inhibitor:{' '}
                <span style={{ color: '#111' }}>{simParams?.promoterParams?.inhibitorName ?? 'none'}</span>
              </div>
              <div style={{ marginBottom: 6, color: '#555' }}>
                repK:{' '}
                <span style={{ color: '#111' }}>{(simParams?.promoterParams?.repK ?? 10).toFixed(3)}</span>
              </div>
              <div style={{ marginBottom: 6, color: '#555' }}>
                repN:{' '}
                <span style={{ color: '#111' }}>{(simParams?.promoterParams?.repN ?? 2).toFixed(3)}</span>
              </div>
            </>
          )}
          {part.type === 'rbs' && (
            <div style={{ marginBottom: 6, color: '#555' }}>
              rbsStrength: <span style={{ color: '#111' }}>{simParams?.rbsStrength?.toFixed?.(3) ?? '1.000'}</span>
            </div>
          )}
          {part.type !== 'promoter' && part.type !== 'rbs' && (
            <div style={{ marginBottom: 6, color: '#777' }}>No per-part parameters yet.</div>
          )}

          <div style={{ marginTop: 10, color: '#888', fontSize: 10 }}>
            Strengths currently come from the library templates (editable per-part later).
          </div>
        </div>
      )}
    </div>
  )
}


