import { useState, useEffect, useMemo } from 'react';
import { usePlayback } from '../context/PlaybackContext';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

const TelemetryComparison = () => {
  const { 
    sessionId, 
    meta, 
    selectedDriver, 
    compareDriver, 
    setCompareDriver, 
    selectedLap, 
    setSelectedLap 
  } = usePlayback();

  const [driver1Data, setDriver1Data] = useState(null);
  const [driver2Data, setDriver2Data] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error1, setError1] = useState(false);
  const [error2, setError2] = useState(false);

  // Get available lap numbers (e.g. 1 to totalLaps)
  const lapsList = useMemo(() => {
    if (!meta) return [];
    return Array.from({ length: meta.totalLaps }, (_, i) => i + 1);
  }, [meta]);

  // Load telemetry data on demand
  useEffect(() => {
    if (!selectedDriver || !selectedLap) return;
    
    const fetchTelemetry = async () => {
      setLoading(true);
      setError1(false);
      setError2(false);
      
      const basePath = `/data/${sessionId}/telemetry`;
      
      // Fetch Driver 1
      try {
        const d1Res = await fetch(`${basePath}/${selectedDriver}_${selectedLap}.json`);
        if (!d1Res.ok) throw new Error();
        const data1 = await d1Res.json();
        setDriver1Data(data1);
      } catch {
        setDriver1Data(null);
        setError1(true);
      }

      // Fetch Driver 2
      if (compareDriver) {
        try {
          const d2Res = await fetch(`${basePath}/${compareDriver}_${selectedLap}.json`);
          if (!d2Res.ok) throw new Error();
          const data2 = await d2Res.json();
          setDriver2Data(data2);
        } catch {
          setDriver2Data(null);
          setError2(true);
        }
      } else {
        setDriver2Data(null);
      }
      
      setLoading(false);
    };

    fetchTelemetry();
  }, [sessionId, selectedDriver, compareDriver, selectedLap]);

  // Chart configuration builder
  const createChartConfig = (label, key, color1, color2, yMin, yMax, yLabel) => {
    const d1Dist = driver1Data?.distance || [];
    const d1Val = driver1Data?.[key] || [];
    const d2Dist = driver2Data?.distance || [];
    const d2Val = driver2Data?.[key] || [];

    const datasets = [];
    if (driver1Data) {
      datasets.push({
        label: `${selectedDriver} (${label})`,
        data: d1Dist.map((dist, idx) => ({ x: dist, y: d1Val[idx] })),
        borderColor: color1,
        borderWidth: 1.5,
        pointRadius: 0,
      });
    }
    if (driver2Data) {
      datasets.push({
        label: `${compareDriver} (${label})`,
        data: d2Dist.map((dist, idx) => ({ x: dist, y: d2Val[idx] })),
        borderColor: color2,
        borderWidth: 1.5,
        pointRadius: 0,
      });
    }

    return {
      data: { datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              title: (context) => `Distance: ${Math.round(context[0].raw.x)} m`
            }
          }
        },
        scales: {
          x: {
            type: 'linear',
            ticks: { font: { size: 8 }, color: '#64748b', maxTicksLimit: 8 },
            grid: { color: 'rgba(34, 40, 48, 0.3)' },
            title: { display: yLabel === 'RPM', text: 'Distance (m)', font: { size: 9 }, color: '#64748b' }
          },
          y: {
            type: 'linear',
            min: yMin,
            max: yMax,
            ticks: { font: { size: 8 }, color: '#64748b' },
            grid: { color: 'rgba(34, 40, 48, 0.3)' },
            title: { display: true, text: yLabel, font: { size: 9 }, color: '#94a3b8' }
          }
        }
      }
    };
  };

  const d1Color = meta?.drivers[selectedDriver]?.color || '#ef4444';
  const d2Color = meta?.drivers[compareDriver]?.color || '#3b82f6';

  const speedConfig = createChartConfig('Speed', 'speed', d1Color, d2Color, 0, 310, 'SPEED (KM/H)');
  const throttleConfig = createChartConfig('Throttle', 'throttle', d1Color, d2Color, 0, 100, 'THROTTLE (%)');
  const brakeConfig = createChartConfig('Brake', 'brake', d1Color, d2Color, 0, 1, 'BRAKE');
  const rpmConfig = createChartConfig('RPM', 'rpm', d1Color, d2Color, 0, 15000, 'RPM');

  return (
    <div className="dashboard-card telemetry-compare-card">
      <div className="card-header">
        <h2 className="card-title">Telemetry Comparison</h2>
        <div className="telemetry-compare-selects">
          <select 
            className="compare-dropdown"
            value={compareDriver || ''}
            onChange={(e) => setCompareDriver(e.target.value || null)}
          >
            <option value="">-- VS --</option>
            {meta && Object.keys(meta.drivers)
              .filter(d => d !== selectedDriver)
              .map(d => (
                <option key={d} value={d}>{d} ({meta.drivers[d].team.split(' ')[0]})</option>
              ))
            }
          </select>
          
          <select 
            className="compare-dropdown"
            value={selectedLap}
            onChange={(e) => setSelectedLap(Number(e.target.value))}
          >
            {lapsList.map(lapNum => (
              <option key={lapNum} value={lapNum}>Lap {lapNum}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="chart-container-large" style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading telemetry...</div>
        ) : (
          <>
            {(error1 || error2) && (
              <div style={{ color: '#ef4444', fontSize: '11px', textAlign: 'center' }}>
                {error1 && `Telemetry unavailable for ${selectedDriver} on Lap ${selectedLap}. `}
                {error2 && `Telemetry unavailable for ${compareDriver} on Lap ${selectedLap}.`}
              </div>
            )}
            
            {driver1Data || driver2Data ? (
              <>
                <div style={{ height: '70px', position: 'relative' }}>
                  <Line data={speedConfig.data} options={speedConfig.options} />
                </div>
                <div style={{ height: '70px', position: 'relative' }}>
                  <Line data={throttleConfig.data} options={throttleConfig.options} />
                </div>
                <div style={{ height: '70px', position: 'relative' }}>
                  <Line data={brakeConfig.data} options={brakeConfig.options} />
                </div>
                <div style={{ height: '80px', position: 'relative' }}>
                  <Line data={rpmConfig.data} options={rpmConfig.options} />
                </div>
              </>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                Select a valid lap and drivers to see telemetry comparison.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TelemetryComparison;
