/* eslint-disable react-refresh/only-export-components */
import { createContext, useState, useEffect, useRef, useContext, useMemo, useCallback } from 'react';

const PlaybackContext = createContext(null);

export const PlaybackProvider = ({ children }) => {
  // Read initial session from URL query parameter, fallback to Monaco
  const [sessionId, setSessionId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('session') || '2024-monaco-r';
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [meta, setMeta] = useState(null);
  const [laps, setLaps] = useState(null);
  const [weather, setWeather] = useState([]);
  const [raceControl, setRaceControl] = useState([]);
  const [registry, setRegistry] = useState(null);
  
  // Playback Clock State
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(5);
  
  // Active Data Chunks
  const [activeChunkIndex, setActiveChunkIndex] = useState(-1);
  const [activeChunkData, setActiveChunkData] = useState(null);
  const [nextChunkData, setNextChunkData] = useState(null);
  
  // UI selection states
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [compareDriver, setCompareDriver] = useState(null);
  const [selectedLap, setSelectedLap] = useState(1);
  
  // Refs for animation loop — avoid stale closures without unnecessary re-renders
  const isPlayingRef = useRef(isPlaying);
  const currentTimeRef = useRef(currentTime);
  const speedMultiplierRef = useRef(speedMultiplier);
  const registryRef = useRef(registry);
  const lastFrameTimeRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  // Ref for nextChunkData: lets loadChunk read it without being a dependency
  const nextChunkDataRef = useRef(null);

  // Keep refs in sync with state
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { speedMultiplierRef.current = speedMultiplier; }, [speedMultiplier]);
  useEffect(() => { registryRef.current = registry; }, [registry]);
  useEffect(() => { nextChunkDataRef.current = nextChunkData; }, [nextChunkData]);

  // ─── Shareable Deep Links URL Syncer ─────────────────────────────────────────
  useEffect(() => {
    if (isLoading || !registry) return;
    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
    url.searchParams.set('t', Math.round(currentTime));
    window.history.replaceState(null, '', url.pathname + url.search);
  }, [sessionId, currentTime, isLoading, registry]);

  // ─── Session Load ────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchSessionData = async () => {
      setIsLoading(true);
      setIsPlaying(false);
      // Clear chunk state immediately so stale data from the previous session
      // doesn't bleed through during the load of a new session
      setActiveChunkIndex(-1);
      setActiveChunkData(null);
      setNextChunkData(null);

      try {
        const basePath = `/data/${sessionId}`;
        
        const [metaRes, lapsRes, weatherRes, rcRes, regRes] = await Promise.all([
          fetch(`${basePath}/meta.json`).then(r => r.json()),
          fetch(`${basePath}/laps.json`).then(r => r.json()),
          fetch(`${basePath}/weather.json`).then(r => r.json()),
          fetch(`${basePath}/race-control.json`).then(r => r.json()),
          fetch(`${basePath}/chunks_registry.json`).then(r => r.json()),
        ]);

        setMeta(metaRes);
        setLaps(lapsRes);
        setWeather(weatherRes);
        setRaceControl(rcRes);
        setRegistry(regRes);
        
        // ── Initial clock position (Deep link vs race start) ─────────────────
        const params = new URLSearchParams(window.location.search);
        const urlTime = params.get('t');
        let initialTime = 0;
        
        if (urlTime && !isNaN(parseFloat(urlTime))) {
          initialTime = Math.max(regRes.minTime, Math.min(regRes.maxTime, parseFloat(urlTime)));
        } else {
          const allLap1Starts = Object.values(lapsRes)
            .flatMap(driverLaps =>
              driverLaps
                .filter(l => l.lapNumber === 1 && l.lapStartElapsed != null)
                .map(l => l.lapStartElapsed)
            );
          const raceStart = allLap1Starts.length > 0
            ? Math.min(...allLap1Starts)
            : regRes.minTime;
          // 5 s before lap 1 so users see the initial grid form before cars scatter
          initialTime = Math.max(regRes.minTime, raceStart - 5);
        }
        
        setCurrentTime(initialTime);
        currentTimeRef.current = initialTime;
        
        // Default selected driver = winner (position 1), compare = runner-up
        const winner = Object.keys(metaRes.drivers).find(
          abbr => metaRes.drivers[abbr].position === 1
        );
        setSelectedDriver(winner || Object.keys(metaRes.drivers)[0]);
        
        const second = Object.keys(metaRes.drivers).find(
          abbr => metaRes.drivers[abbr].position === 2
        );
        setCompareDriver(second || Object.keys(metaRes.drivers)[1]);
        
      } catch (err) {
        console.error('Error loading session data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSessionData();
  }, [sessionId]);

  // ─── Chunk Loading ───────────────────────────────────────────────────────────
  const loadChunk = useCallback(async (chunkIndex) => {
    if (!registry || chunkIndex < 0 || chunkIndex >= registry.totalChunks) return;
    
    const basePath = `/data/${sessionId}`;
    
    try {
      let chunkData = null;
      const cached = nextChunkDataRef.current;
      if (cached && cached.chunkIndex === chunkIndex) {
        chunkData = cached;
      } else {
        chunkData = await fetch(
          `${basePath}/chunk_${String(chunkIndex).padStart(4, '0')}.json`
        ).then(r => r.json());
      }
      
      setActiveChunkIndex(chunkIndex);
      setActiveChunkData(chunkData);
      
      // Preload the next chunk in the background
      const nextIndex = chunkIndex + 1;
      if (nextIndex < registry.totalChunks) {
        fetch(`${basePath}/chunk_${String(nextIndex).padStart(4, '0')}.json`)
          .then(r => r.json())
          .then(data => { setNextChunkData(data); })
          .catch(err => console.error('Error preloading next chunk:', err));
      } else {
        setNextChunkData(null);
      }
    } catch (err) {
      console.error(`Error loading chunk ${chunkIndex}:`, err);
    }
  }, [registry, sessionId]);

  // Trigger chunk loads when currentTime crosses a chunk boundary
  useEffect(() => {
    if (!registry || isLoading) return;

    const targetChunkIndex = Math.floor(
      (currentTime - registry.minTime) / registry.chunkSizeSec
    );

    if (targetChunkIndex !== activeChunkIndex) {
      loadChunk(targetChunkIndex);
    }
  }, [currentTime, registry, isLoading, activeChunkIndex, loadChunk]);

  // ─── Playback Loop ───────────────────────────────────────────────────────────
  function playLoop(timestamp) {
    if (!isPlayingRef.current) return;
    
    if (lastFrameTimeRef.current === null) {
      lastFrameTimeRef.current = timestamp;
    }
    
    const elapsedMs = timestamp - lastFrameTimeRef.current;
    lastFrameTimeRef.current = timestamp;
    
    const deltaSec = elapsedMs / 1000;
    const timeStep = deltaSec * speedMultiplierRef.current;
    
    let newTime = currentTimeRef.current + timeStep;
    const maxTime = registryRef.current ? registryRef.current.maxTime : 0;
    
    if (newTime >= maxTime) {
      newTime = maxTime;
      setIsPlaying(false);
      isPlayingRef.current = false;
    }
    
    setCurrentTime(newTime);
    currentTimeRef.current = newTime;
    
    if (isPlayingRef.current) {
      animationFrameIdRef.current = requestAnimationFrame(playLoop);
    }
  }

  useEffect(() => {
    if (isPlaying) {
      lastFrameTimeRef.current = null;
      animationFrameIdRef.current = requestAnimationFrame(playLoop);
    } else {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    }
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = () => setIsPlaying(prev => !prev);
  
  const scrubTo = (timeSec) => {
    if (!registry) return;
    const clampedTime = Math.max(registry.minTime, Math.min(registry.maxTime, timeSec));
    setCurrentTime(clampedTime);
    currentTimeRef.current = clampedTime;
  };

  // ─── Derived: Current Lap ────────────────────────────────────────────
  // Pulled directly from meta.raceStartElapsed (ingested value). Fallback: derive
  // from laps when an older session was ingested without this field.
  const raceStartElapsed = useMemo(() => {
    if (meta?.raceStartElapsed != null) return meta.raceStartElapsed;
    if (!laps) return null;
    const allLap1Starts = Object.values(laps)
      .flatMap(driverLaps =>
        driverLaps
          .filter(l => l.lapNumber === 1 && l.lapStartElapsed != null)
          .map(l => l.lapStartElapsed)
      );
    return allLap1Starts.length > 0 ? Math.min(...allLap1Starts) : null;
  }, [meta, laps]);

  const currentLap = useMemo(() => {
    if (!laps || !selectedDriver) return 0;
    const driverLaps = laps[selectedDriver] || [];
    if (driverLaps.length === 0) return 0;
    
    if (currentTime < driverLaps[0].lapStartElapsed) return 0;
    
    const active = driverLaps.find(
      lap => currentTime >= lap.lapStartElapsed && currentTime <= lap.sector3Elapsed
    );
    if (active) return active.lapNumber;
    
    const lastLap = driverLaps[driverLaps.length - 1];
    if (lastLap && currentTime > lastLap.sector3Elapsed) {
      return lastLap.lapNumber;
    }
    
    return 0;
  }, [laps, selectedDriver, currentTime]);

  // ─── Derived: Live Standings ─────────────────────────────────────────────────
  const standings = useMemo(() => {
    if (!meta || !laps) return [];

    const driverStats = Object.keys(meta.drivers).map(driver => {
      const driverMeta = meta.drivers[driver];
      const driverLaps = laps[driver] || [];
      
      let activeLap = null;
      let activeLapIdx = -1;
      let sectorCompleted = 0;
      let milestoneTime = 0;
      let pitCount = 0;

      for (let i = 0; i < driverLaps.length; i++) {
        const lap = driverLaps[i];
        
        if (lap.isPit && lap.lapStartElapsed <= currentTime) {
          pitCount++;
        }

        if (lap.lapStartElapsed <= currentTime) {
          activeLap = lap;
          activeLapIdx = i;
          
          if (lap.sector3Elapsed <= currentTime) {
            sectorCompleted = 3;
            milestoneTime = lap.sector3Elapsed;
          } else if (lap.sector2Elapsed <= currentTime) {
            sectorCompleted = 2;
            milestoneTime = lap.sector2Elapsed;
          } else if (lap.sector1Elapsed <= currentTime) {
            sectorCompleted = 1;
            milestoneTime = lap.sector1Elapsed;
          } else {
            sectorCompleted = 0;
            milestoneTime = lap.lapStartElapsed;
          }
        } else {
          break;
        }
      }

      if (!activeLap) {
        return {
          driver,
          name: driverMeta.name,
          number: driverMeta.number,
          team: driverMeta.team,
          color: driverMeta.color,
          grid: driverMeta.grid,
          position: null,
          lastLap: null,
          tyre: 'unknown',
          tyreLife: 0,
          pits: 0,
          milestoneCount: -1,
          milestoneTime: 0,
          lapNumber: 0,
          retired: false
        };
      }

      const lapNumber = activeLap.lapNumber;
      const lastLapOfDriver = driverLaps[driverLaps.length - 1];
      const retired = lastLapOfDriver &&
        currentTime > lastLapOfDriver.sector3Elapsed &&
        driverMeta.status !== 'Finished';
      const tyre = activeLap.compound.toLowerCase();
      const tyreLife = activeLap.tyreLife;
      const lastLapObj = sectorCompleted === 3
        ? activeLap
        : (activeLapIdx > 0 ? driverLaps[activeLapIdx - 1] : null);
      const lastLap = lastLapObj ? lastLapObj.lapTime : null;
      const milestoneCount = lapNumber * 3 + sectorCompleted;

      return {
        driver,
        name: driverMeta.name,
        number: driverMeta.number,
        team: driverMeta.team,
        color: driverMeta.color,
        grid: driverMeta.grid,
        lastLap,
        tyre,
        tyreLife,
        pits: pitCount,
        milestoneCount,
        milestoneTime,
        lapNumber,
        retired
      };
    });

    const sorted = [...driverStats].sort((a, b) => {
      if (a.retired && !b.retired) return 1;
      if (!a.retired && b.retired) return -1;
      if (a.milestoneCount === -1 && b.milestoneCount === -1) {
        return (a.grid || 99) - (b.grid || 99);
      }
      if (a.milestoneCount === -1 && b.milestoneCount !== -1) return 1;
      if (a.milestoneCount !== -1 && b.milestoneCount === -1) return -1;
      if (a.milestoneCount !== b.milestoneCount) {
        return b.milestoneCount - a.milestoneCount;
      }
      return a.milestoneTime - b.milestoneTime;
    });

    const leader = sorted[0];
    return sorted.map((stat, index) => {
      let gap = null;
      let interval = null;

      if (stat.milestoneCount === -1) {
        gap = 'GRID';
        interval = '-';
      } else if (index === 0) {
        gap = '-';
        interval = '-';
      } else if (stat.retired) {
        gap = 'OUT';
        interval = 'OUT';
      } else if (leader && stat.milestoneCount !== -1) {
        const lapDiff = Math.floor(leader.milestoneCount / 3) - Math.floor(stat.milestoneCount / 3);
        
        if (lapDiff > 0) {
          gap = `+${lapDiff} ${lapDiff === 1 ? 'LAP' : 'LAPS'}`;
          interval = gap;
        } else {
          const driverLapsList = laps[stat.driver] || [];
          const leaderLaps = laps[leader.driver] || [];
          const currentLapIdx = Math.floor(stat.milestoneCount / 3) - 1;
          const currentSector = stat.milestoneCount % 3;
          const dLap = driverLapsList[currentLapIdx];
          const lLap = leaderLaps[currentLapIdx];

          if (dLap && lLap) {
            let dTime, lTime;
            if (currentSector === 0) {
              dTime = dLap.lapStartElapsed; lTime = lLap.lapStartElapsed;
            } else if (currentSector === 1) {
              dTime = dLap.sector1Elapsed; lTime = lLap.sector1Elapsed;
            } else if (currentSector === 2) {
              dTime = dLap.sector2Elapsed; lTime = lLap.sector2Elapsed;
            } else {
              dTime = dLap.sector3Elapsed; lTime = lLap.sector3Elapsed;
            }
            if (dTime && lTime) gap = dTime - lTime;
          }
          
          const ahead = sorted[index - 1];
          const aheadLaps = laps[ahead.driver] || [];
          const aLap = aheadLaps[currentLapIdx];
          if (dLap && aLap) {
            let dTime, aTime;
            if (currentSector === 0) {
              dTime = dLap.lapStartElapsed; aTime = aLap.lapStartElapsed;
            } else if (currentSector === 1) {
              dTime = dLap.sector1Elapsed; aTime = aLap.sector1Elapsed;
            } else if (currentSector === 2) {
              dTime = dLap.sector2Elapsed; aTime = aLap.sector2Elapsed;
            } else {
              dTime = dLap.sector3Elapsed; aTime = aLap.sector3Elapsed;
            }
            if (dTime && aTime) interval = dTime - aTime;
          }
        }
      }

      return { ...stat, position: index + 1, gap, interval };
    });
  }, [meta, laps, currentTime]);

  return (
    <PlaybackContext.Provider value={{
      sessionId,
      setSessionId,
      isLoading,
      meta,
      laps,
      weather,
      raceControl,
      registry,
      currentTime,
      isPlaying,
      speedMultiplier,
      setSpeedMultiplier,
      activeChunkData,
      selectedDriver,
      setSelectedDriver,
      compareDriver,
      setCompareDriver,
      selectedLap,
      setSelectedLap,
      togglePlay,
      scrubTo,
      currentLap,
      raceStartElapsed,
      standings
    }}>
      {children}
    </PlaybackContext.Provider>
  );
};

export const usePlayback = () => {
  const context = useContext(PlaybackContext);
  if (!context) {
    throw new Error('usePlayback must be used within a PlaybackProvider');
  }
  return context;
};
