import { useMemo, useEffect, useRef } from 'react';
import { usePlayback } from '../context/PlaybackContext';
import { Thermometer, Droplets, Wind, Compass, CloudRain } from 'lucide-react';
import { formatSessionClock } from '../utils/format';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const getWindDirectionLabel = (deg) => {
  if (deg === undefined || deg === null) return '-';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const val = Math.floor((deg / 22.5) + 0.5);
  return directions[val % 16];
};

const WeatherPanel = () => {
  const { weather, currentTime } = usePlayback();
  const chartRef = useRef(null);

  // Find weather sample closest to currentTime (but not in the future, if possible)
  const currentSample = useMemo(() => {
    if (!weather || weather.length === 0) return null;
    
    // Find closest weather sample
    let closest = weather[0];
    let minDiff = Math.abs(weather[0].time - currentTime);
    
    for (let i = 1; i < weather.length; i++) {
      const diff = Math.abs(weather[i].time - currentTime);
      if (diff < minDiff) {
        minDiff = diff;
        closest = weather[i];
      }
    }
    return closest;
  }, [weather, currentTime]);

  // Update Chart.js vertical red playback cursor
  useEffect(() => {
    const chart = chartRef.current;
    if (chart) {
      chart.update('none'); // Update without animation for 60fps responsiveness
    }
  }, [currentTime]);

  const chartData = useMemo(() => {
    if (!weather || weather.length === 0) return { datasets: [] };

    // Limit weather points shown in chart to ~100 max for performance
    const step = Math.max(1, Math.floor(weather.length / 100));
    const sampledWeather = weather.filter((_, idx) => idx % step === 0);

    return {
      labels: sampledWeather.map(w => w.time),
      datasets: [
        {
          label: 'Air Temp (°C)',
          data: sampledWeather.map(w => w.air_temp),
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.5)',
          borderWidth: 1.5,
          pointRadius: 0,
          yAxisID: 'yTemp',
        },
        {
          label: 'Track Temp (°C)',
          data: sampledWeather.map(w => w.track_temp),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.5)',
          borderWidth: 1.5,
          pointRadius: 0,
          yAxisID: 'yTemp',
        },
        {
          label: 'Humidity (%)',
          data: sampledWeather.map(w => w.humidity),
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderWidth: 1.5,
          pointRadius: 0,
          yAxisID: 'yHum',
        }
      ]
    };
  }, [weather]);

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
          title: (context) => `Session Time: ${formatSessionClock(context[0].label)}`
        }
      }
    },
    scales: {
      x: {
        type: 'linear',
        ticks: {
          callback: (value) => formatSessionClock(value),
          font: { size: 8 },
          color: '#64748b',
          maxTicksLimit: 5
        },
        grid: { color: 'rgba(34, 40, 48, 0.3)' }
      },
      yTemp: {
        type: 'linear',
        position: 'left',
        title: {
          display: true,
          text: 'Temperature (°C)',
          font: { size: 8 },
          color: '#94a3b8'
        },
        ticks: {
          font: { size: 8 },
          color: '#64748b'
        },
        grid: { color: 'rgba(34, 40, 48, 0.3)' }
      },
      yHum: {
        type: 'linear',
        position: 'right',
        title: {
          display: true,
          text: 'Humidity (%)',
          font: { size: 8 },
          color: '#94a3b8'
        },
        ticks: {
          font: { size: 8 },
          color: '#64748b'
        },
        grid: { drawOnChartArea: false } // Only show grid for temp
      }
    }
  };

  // Custom plugin to draw vertical red playback line
  const timeCursorPlugin = {
    id: 'timeCursorPlugin',
    afterDraw: (chart) => {
      const xAxis = chart.scales.x;
      const xPixel = xAxis.getPixelForValue(currentTime);

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

  if (!currentSample) {
    return (
      <div className="dashboard-card weather-card">
        <div className="card-header">
          <h2 className="card-title">Weather</h2>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No weather data loaded</div>
      </div>
    );
  }

  return (
    <div className="dashboard-card weather-card">
      <div className="card-header">
        <h2 className="card-title">Weather</h2>
        <span className="live-badge">Replay Active</span>
      </div>
      
      <div className="weather-stats">
        <div className="weather-stat-box">
          <div className="weather-icon-wrapper"><Thermometer size={16} /></div>
          <div>
            <div className="weather-stat-label">Air Temp</div>
            <div className="weather-stat-value">{currentSample.air_temp.toFixed(1)}°C</div>
          </div>
        </div>
        
        <div className="weather-stat-box">
          <div className="weather-icon-wrapper"><Thermometer size={16} style={{ color: '#f59e0b' }} /></div>
          <div>
            <div className="weather-stat-label">Track Temp</div>
            <div className="weather-stat-value">{currentSample.track_temp.toFixed(1)}°C</div>
          </div>
        </div>
        
        <div className="weather-stat-box">
          <div className="weather-icon-wrapper"><Droplets size={16} style={{ color: '#3b82f6' }} /></div>
          <div>
            <div className="weather-stat-label">Humidity</div>
            <div className="weather-stat-value">{Math.round(currentSample.humidity)}%</div>
          </div>
        </div>
        
        <div className="weather-stat-box">
          <div className="weather-icon-wrapper"><Wind size={16} /></div>
          <div>
            <div className="weather-stat-label">Wind Speed</div>
            <div className="weather-stat-value">{currentSample.wind_speed.toFixed(1)} m/s</div>
          </div>
        </div>
        
        <div className="weather-stat-box">
          <div className="weather-icon-wrapper"><Compass size={16} /></div>
          <div>
            <div className="weather-stat-label">Wind Dir</div>
            <div className="weather-stat-value">{getWindDirectionLabel(currentSample.wind_direction)}</div>
          </div>
        </div>
        
        <div className="weather-stat-box">
          <div className="weather-icon-wrapper">
            <CloudRain size={16} style={{ color: currentSample.rainfall > 0 ? '#3b82f6' : '#64748b' }} />
          </div>
          <div>
            <div className="weather-stat-label">Rainfall</div>
            <div className="weather-stat-value">{currentSample.rainfall > 0 ? 'RAIN' : '0.0 mm'}</div>
          </div>
        </div>
      </div>

      <div className="weather-chart-container">
        <Line 
          ref={chartRef}
          data={chartData} 
          options={chartOptions} 
          plugins={[timeCursorPlugin]} 
        />
      </div>
    </div>
  );
};

export default WeatherPanel;
