import { useState, useEffect, useRef, useCallback } from 'react';
import { usePlayback } from '../context/PlaybackContext';
import { ChevronDown, Globe, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

// ── Ingest overlay component ──────────────────────────────────────────────────
const IngestOverlay = ({ session, onSuccess, onCancel }) => {
  const [phase, setPhase] = useState('ingesting'); // ingesting | done | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year: session.year,
            event: session.event.replace(' Grand Prix', '').replace(' GP', '').trim(),
            session_type: session.session_type,
          }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.ok) {
          setPhase('done');
          setTimeout(() => onSuccess(data.sessionId), 900);
        } else {
          setPhase('error');
          setErrorMsg(data.error || 'Ingestion server returned an error.');
        }
      } catch (err) {
        if (cancelled) return;
        setPhase('error');
        setErrorMsg(
          'Could not reach the ingestion server. Is server.py running?\n\n' + err.message
        );
      }
    };

    run();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      backgroundColor: 'rgba(8, 11, 18, 0.92)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        padding: '36px 40px',
        maxWidth: '480px',
        width: '90%',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: '20px',
        boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
      }}>
        {/* Icon */}
        {phase === 'ingesting' && (
          <div style={{ animation: 'spin 1s linear infinite', color: 'var(--f1-red)' }}>
            <Loader2 size={36} />
          </div>
        )}
        {phase === 'done' && <CheckCircle size={36} style={{ color: '#22c55e' }} />}
        {phase === 'error' && <AlertCircle size={36} style={{ color: '#ef4444' }} />}

        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)',
            marginBottom: '6px',
          }}>
            {phase === 'ingesting' && '⚙ Ingesting Session Data'}
            {phase === 'done' && '✓ Ingestion Complete'}
            {phase === 'error' && '✕ Ingestion Failed'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
            {phase === 'ingesting' && (
              <>
                <strong style={{ color: 'var(--text-secondary)' }}>
                  {session.year} {session.event} — {session.label}
                </strong>
                <br />
                FastF1 is downloading and processing telemetry. This typically takes<br />
                <strong>1–3 minutes</strong> on first load, less if the session is already in the local cache.
              </>
            )}
            {phase === 'done' && 'Session is ready. Loading now…'}
            {phase === 'error' && (
              <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#ef4444' }}>
                {errorMsg}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar for ingesting phase */}
        {phase === 'ingesting' && (
          <div style={{
            width: '100%', height: '3px', backgroundColor: 'var(--bg-color)',
            borderRadius: '2px', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: '40%',
              background: 'linear-gradient(90deg, var(--f1-red), #ff6b35)',
              borderRadius: '2px',
              animation: 'progress-slide 1.8s ease-in-out infinite',
            }} />
          </div>
        )}

        {/* Dismiss button for error */}
        {phase === 'error' && (
          <button
            onClick={onCancel}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--card-border)',
              borderRadius: '6px',
              padding: '8px 20px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
            }}
          >
            Dismiss
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes progress-slide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(150%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
};

// ── CachedBadge ───────────────────────────────────────────────────────────────
const CachedDot = ({ cached }) => (
  <span title={cached ? 'Cached — loads instantly' : 'Not yet cached — will ingest on select'} style={{
    display: 'inline-block',
    width: '6px', height: '6px',
    borderRadius: '50%',
    backgroundColor: cached ? '#22c55e' : '#64748b',
    flexShrink: 0,
    marginLeft: '2px',
  }} />
);

// ── Main component ────────────────────────────────────────────────────────────
const SessionSelector = () => {
  const { sessionId, setSessionId, isLoading } = usePlayback();
  const [isOpen, setIsOpen] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [catalogError, setCatalogError] = useState(false);
  const [ingestTarget, setIngestTarget] = useState(null); // session entry being ingested
  const dropdownRef = useRef(null);

  // Load catalog.json (falls back to index.json if catalog doesn't exist yet)
  useEffect(() => {
    fetch('/data/catalog.json')
      .then(res => {
        if (!res.ok) throw new Error('catalog.json not found');
        return res.json();
      })
      .then(data => setCatalog(data))
      .catch(() => {
        // fallback: load index.json and mark everything as cached
        fetch('/data/index.json')
          .then(r => r.json())
          .then(data => {
            setCatalog(data.map(s => ({
              ...s,
              session_type: s.session || 'R',
              label: s.session || 'Race',
              sessionId: s.id,
              cached: true,
            })));
          })
          .catch(() => setCatalogError(true));
      });
  }, [sessionId]); // re-check cache status when session changes

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Find active session label — check both catalog sessionId and id fields
  const activeEntry = catalog.find(s => (s.sessionId || s.id) === sessionId);

  const handleSelect = useCallback((entry) => {
    setIsOpen(false);
    const entrySessionId = entry.sessionId || entry.id;
    if (entry.cached) {
      setSessionId(entrySessionId);
    } else {
      // Trigger on-demand ingestion
      setIngestTarget(entry);
    }
  }, [setSessionId]);

  const handleIngestSuccess = useCallback((newSessionId) => {
    setIngestTarget(null);
    // Refresh catalog cache markers
    setCatalog(prev => prev.map(s =>
      (s.sessionId || s.id) === newSessionId ? { ...s, cached: true } : s
    ));
    setSessionId(newSessionId);
  }, [setSessionId]);

  const handleIngestCancel = useCallback(() => {
    setIngestTarget(null);
  }, []);

  // Group by year (descending)
  const groupedByYear = catalog.reduce((acc, entry) => {
    const y = entry.year || 2024;
    if (!acc[y]) acc[y] = [];
    acc[y].push(entry);
    return acc;
  }, {});

  return (
    <>
      {/* Ingestion overlay (renders outside the dropdown) */}
      {ingestTarget && (
        <IngestOverlay
          session={ingestTarget}
          onSuccess={handleIngestSuccess}
          onCancel={handleIngestCancel}
        />
      )}

      <div className="session-selector-container" ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          className={`session-selector-btn ${isOpen ? 'active' : ''}`}
          onClick={() => !isLoading && setIsOpen(!isOpen)}
          disabled={isLoading}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            backgroundColor: 'var(--bg-color)',
            border: '1px solid var(--card-border)',
            borderRadius: '6px', padding: '8px 12px',
            color: 'var(--text-primary)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: '500',
            transition: 'all 0.2s ease', opacity: isLoading ? 0.7 : 1,
          }}
        >
          <Globe size={14} style={{ color: 'var(--f1-red)' }} />
          <span>
            {activeEntry
              ? `${activeEntry.year} ${activeEntry.event} (${activeEntry.label || activeEntry.session})`
              : 'Select Session…'}
          </span>
          <ChevronDown size={14} style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
            color: 'var(--text-muted)'
          }} />
        </button>

        {isOpen && (
          <div
            className="session-selector-dropdown"
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0,
              zIndex: 999,
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '6px',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -2px rgba(0,0,0,0.5)',
              width: '310px', maxHeight: '360px', overflowY: 'auto', padding: '4px',
            }}
          >
            {catalogError ? (
              <div style={{ padding: '12px', fontSize: '12px', color: '#ef4444', lineHeight: '1.5' }}>
                Could not load catalog.json or index.json.<br />
                Run <code>python generate_catalog.py</code> first.
              </div>
            ) : catalog.length === 0 ? (
              <div style={{ padding: '8px 12px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Loading sessions…
              </div>
            ) : (
              /* Group by year, descending */
              Object.entries(groupedByYear)
                .sort(([a], [b]) => Number(b) - Number(a))
                .map(([year, entries]) => (
                  <div key={year}>
                    <div style={{
                      fontSize: '9px', fontWeight: '700', color: 'var(--f1-red)',
                      padding: '6px 12px 2px 12px', textTransform: 'uppercase',
                      letterSpacing: '1px',
                      borderBottom: '1px solid rgba(225, 6, 0, 0.1)', marginBottom: '4px',
                    }}>
                      {year} Season
                    </div>

                    {entries.map((entry) => {
                      const entryId = entry.sessionId || entry.id;
                      const isActive = entryId === sessionId;
                      return (
                        <button
                          key={`${entryId}-${entry.session_type}`}
                          onClick={() => handleSelect(entry)}
                          title={entry.cached ? 'Cached — click to load instantly' : 'Not cached — click to ingest (1–3 min)'}
                          style={{
                            width: '100%', textAlign: 'left',
                            backgroundColor: isActive ? 'rgba(225, 6, 0, 0.1)' : 'transparent',
                            border: 'none', borderRadius: '4px',
                            padding: '7px 12px',
                            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer', fontSize: '12px',
                            fontFamily: 'var(--font-sans)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            transition: 'background-color 0.15s ease',
                          }}
                          onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#1f2937'; }}
                          onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', overflow: 'hidden' }}>
                            {entry.countryCode && entry.countryCode !== 'un' && (
                              <img
                                src={`https://flagcdn.com/w20/${entry.countryCode}.png`}
                                alt=""
                                style={{ width: '14px', height: '10px', objectFit: 'cover', borderRadius: '1px', flexShrink: 0 }}
                              />
                            )}
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {entry.event}
                            </span>
                            <CachedDot cached={entry.cached} />
                          </div>
                          <span style={{
                            fontSize: '9px', color: 'var(--text-muted)',
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                          }}>
                            {entry.label || entry.session}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))
            )}

            {/* Legend */}
            <div style={{
              borderTop: '1px solid var(--card-border)', margin: '4px 0 0',
              padding: '6px 12px', display: 'flex', gap: '14px', fontSize: '9px',
              color: 'var(--text-muted)',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block' }} />
                Cached
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#64748b', display: 'inline-block' }} />
                Will ingest (~1–3 min)
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default SessionSelector;
