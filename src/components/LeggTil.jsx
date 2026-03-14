import { useState } from 'react'

const S = { IDLE: 'idle', CHECKING: 'checking', NOT_FOUND: 'not-found', GENERATING: 'generating', DONE: 'done' }

function delay(ms) { return new Promise(r => setTimeout(r, ms)) }

export default function LeggTil({ onClose, onModelReady }) {
  const [url, setUrl] = useState('')
  const [state, setState] = useState(S.IDLE)
  const [progress, setProgress] = useState(0)

  async function handleCheck() {
    if (!url.trim()) return
    setState(S.CHECKING)
    await delay(1500) // TODO: real DB check
    setState(S.NOT_FOUND)
  }

  async function handleGenerate() {
    setState(S.GENERATING)
    setProgress(0)
    for (let i = 0; i <= 100; i += 5) {
      await delay(1800)
      setProgress(i)
    }
    setState(S.DONE)
  }

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />

        <h3 className="sheet-title">Legg til produkt</h3>

        {state === S.IDLE && (
          <>
            <p className="sheet-desc">Lim inn URL fra en nettbutikk</p>
            <input
              className="url-input"
              type="url"
              placeholder="https://www.bohus.no/produkt/..."
              value={url}
              onChange={e => setUrl(e.target.value)}
              autoFocus
            />
            <button className="sheet-btn" onClick={handleCheck} disabled={!url.trim()}>
              Sjekk produkt
            </button>
          </>
        )}

        {state === S.CHECKING && (
          <div className="sheet-status">
            <div className="spinner" />
            <p>Sjekker produktet...</p>
          </div>
        )}

        {state === S.NOT_FOUND && (
          <>
            <p className="sheet-desc">Ingen 3D-modell funnet for dette produktet.</p>
            <p className="sheet-url">{url}</p>
            <button className="sheet-btn" onClick={handleGenerate}>
              Lag 3D-modell (1–3 min)
            </button>
            <button className="sheet-btn sheet-btn--ghost" onClick={() => setState(S.IDLE)}>
              Prøv annen URL
            </button>
          </>
        )}

        {state === S.GENERATING && (
          <div className="sheet-status">
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p>Lager 3D-modell… {progress}%</p>
            <p className="sheet-hint">Dette tar vanligvis 1–3 minutter</p>
          </div>
        )}

        {state === S.DONE && (
          <div className="sheet-status">
            <div className="done-icon">✓</div>
            <p>3D-modell er klar!</p>
            <button className="sheet-btn" onClick={() => onModelReady(null)}>
              Vis i rommet
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
