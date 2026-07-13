import { useMemo, useEffect, useRef } from 'react';
import { usePlayback } from '../context/PlaybackContext';
import { Line } from 'react-chartjs-2';
import { formatLapTime } from '../utils/format';

const LapTimeHistory = () => {
  const { laps, meta, selectedDriver, compareDriver, currentLap } = usePlayback();
  const chartRef = useRef(null);

  // Find overall race leader
  const currentLeader = useMemo(() => {
    if (!meta) return null;
    return Object.keys(meta.drivers).find(
      abbr => meta.drivers[abbr].position === 1
    ) || Object.keys(meta.drivers)[0];
  }, [meta]);

  // Active drivers to show
  const activeDrivers = useMemo(() => {
    const list = [];
    if (selectedDriver) list.push(selectedDriver);
    if (compareDriver && !list.includes(compareDriver)) list.push(compareDriver);
    if (currentLeader && !list.includes(currentLeader)) list.push(currentLeader);
    return list;
  }, [selectedDriver, compareDriver, currentLeader]);

  useEffect(() => {
    const chart = chartRef.current;
    if (chart) {
      chart.update('none');
    }
  }, [currentLap]);

  const chartData = useMemo(() => {
    if (!laps || activeDrivers.length === 0) return { datasets: [] };
    
    const totalLaps = meta?.totalLaps || 78;
    const labels = Array.from({ length: totalLaps }, (_, i) => i + 1);

    const datasets = activeDrivers.map(driver => {
      const driverMeta = meta?.drivers[driver] || {};
      const driverLaps = laps[driver] || [];
      
      const data = labels.map(lapNum => {
        const lap = driverLaps.find(l => l.lapNumber === lapNum);
        if (!lap || !lap.lapTime) return null;
        return lap.lapTime > 120 ? null : lap.lapTime;
      });

      return {
        label: driver,
        data,
        borderColor: driverMeta.color || '#ffffff',
        backgroundColor: driverMeta.color ? `${driverMeta.color}33` : 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1.5,
        pointRadius: 2,
        pointHoverRadius: 4,
        spanGaps: true
      };
    });

    return { labels, datasets };
  }, [laps, activeDrivers, meta]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          boxWidth: 8,
          font: { size: 9 },
          color: '#94a3b8'
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${formatLapTime(context.raw)}`
        }
      }
    },
    scales: {
      x: {
        title: { display: true, text: 'Lap', font: { size: 9 }, color: '#64748b' },
        ticks: { font: { size: 8 }, color: '#64748b', maxTicksLimit: 15 },
        grid: { color: 'rgba(34, 40, 48, 0.3)' }
      },
      y: {
        title: { display: true, text: 'Lap Time (s)', font: { size: 9 }, color: '#64748b' },
        ticks: {
          callback: (value) => formatLapTime(value),
          font: { size: 8 },
          color: '#64748b'
        },
        grid: { color: 'rgba(34, 40, 48, 0.3)' }
      }
    }
  };

  const lapCursorPlugin = {
    id: 'lapCursorPlugin',
    afterDraw: (chart) => {
      if (!currentLap) return;
      const xAxis = chart.scales.x;
      const xPixel = xAxis.getPixelForValue(currentLap);

      if (xPixel >= xAxis.left && xPixel <= xAxis.right) {
        const ctx = chart.ctx;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(xPixel, chart.chartArea.top);
        ctx.lineTo(xPixel, chart.chartArea.bottom);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();
      }
    }
  };

  // ─── Derived Strategic Analytics ──────────────────────────────────────────
  const consistencyStats = useMemo(() => {
    if (!laps) return [];
    
    return activeDrivers.map(driver => {
      const driverLaps = laps[driver] || [];
      const times = driverLaps
        .map(l => l.lapTime)
        .filter(t => t != null && t > 0);
      
      if (times.length === 0) return { driver, stdDevText: 'N/A', meanText: 'N/A' };
      
      const fastest = Math.min(...times);
      // Exclude pitstops / yellow flag laps (>15% slower than fastest lap)
      const cleanTimes = times.filter(t => t < fastest * 1.15);
      
      if (cleanTimes.length < 2) return { driver, stdDevText: 'N/A', meanText: 'N/A' };
      
      const mean = cleanTimes.reduce((sum, val) => sum + val, 0) / cleanTimes.length;
      const stdDev = Math.sqrt(
        cleanTimes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / cleanTimes.length
      );
      
      return {
        driver,
        stdDevText: `±${stdDev.toFixed(3)}s`,
        meanText: `${mean.toFixed(2)}s`,
        color: meta?.drivers[driver]?.color || '#ffffff'
      };
    });
  }, [laps, activeDrivers, meta]);

  const strategicAnalysis = useMemo(() => {
    if (!laps || !selectedDriver || !compareDriver) return null;
    const aLaps = laps[selectedDriver] || [];
    const bLaps = laps[compareDriver] || [];
    
    const aPits = aLaps.filter(l => l.isPit).map(l => l.lapNumber);
    const bPits = bLaps.filter(l => l.isPit).map(l => l.lapNumber);
    
    return {
      aPits,
      bPits,
      summary: aPits.length > 0 && bPits.length > 0
        ? `${selectedDriver} pitted on Laps [${aPits.join(', ')}], ${compareDriver} pitted on Laps [${bPits.join(', ')}].`
        : `Pit stops: ${selectedDriver} [${aPits.length ? aPits.join(', ') : 'none'}], ${compareDriver} [${bPits.length ? bPits.join(', ') : 'none'}]`
    };
  }, [laps, selectedDriver, compareDriver]);

  return (
    <div className="dashboard-card lap-history-card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div className="card-header">
        <h2 className="card-title">Lap Time History</h2>
      </div>
      <div className="chart-container-medium">
        <Line 
          ref={chartRef}
          data={chartData} 
          options={chartOptions} 
          plugins={[lapCursorPlugin]} 
        />
      </div>

      {/* Strategic Analytics Summary */}
      <div 
        style={{ 
          borderTop: '1px solid var(--card-border)', 
          paddingTop: '10px',
          marginTop: '4px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        <div style={{ fontSize: '9px', fontWeight: '800', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Strategic Insights (Clean Laps Deviation)
        </div>
        
        {/* Consistency Table */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
          {consistencyStats.map(stat => (
            <div 
              key={stat.driver}
              style={{
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--card-border)',
                borderRadius: '4px',
                padding: '6px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span 
                  style={{ 
                    display: 'inline-block',
                    width: '3px',
                    height: '10px',
                    backgroundColor: stat.color,
                    borderRadius: '2px'
                  }}
                />
                <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{stat.driver}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#10b981', fontFamily: 'var(--font-mono)' }}>{stat.stdDevText}</div>
                <div style={{ fontSize: '8px', color: 'var(--text-muted)' }}>Avg: {stat.meanText}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Pit Stop Summary */}
        {strategicAnalysis && (
          <div 
            style={{ 
              fontSize: '10px', 
              color: 'var(--text-secondary)',
              backgroundColor: 'rgba(225, 6, 0, 0.03)',
              borderLeft: '2px solid var(--f1-red)',
              padding: '6px 10px',
              borderRadius: '0 4px 4px 0',
              fontStyle: 'italic'
            }}
          >
            {strategicAnalysis.summary}
          </div>
        )}
      </div>
    </div>
  );
};

export default LapTimeHistory;
