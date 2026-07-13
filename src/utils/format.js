// Helper to format time (e.g. 72.645 -> "1:12.645")
export const formatLapTime = (timeSec) => {
  if (timeSec === null || timeSec === undefined || isNaN(timeSec)) return '-';
  const mins = Math.floor(timeSec / 60);
  const secs = (timeSec % 60).toFixed(3);
  return mins > 0 ? `${mins}:${secs.padStart(6, '0')}` : secs;
};

// Helper to format session clock time (e.g. 3305 -> "00:55:05")
export const formatSessionClock = (totalSeconds) => {
  const isNegative = totalSeconds < 0;
  const absSeconds = Math.abs(totalSeconds);
  const hrs = Math.floor(absSeconds / 3600);
  const mins = Math.floor((absSeconds % 3600) / 60);
  const secs = Math.floor(absSeconds % 60);
  
  const formatted = [
    String(hrs).padStart(2, '0'),
    String(mins).padStart(2, '0'),
    String(secs).padStart(2, '0')
  ].join(':');
  
  return isNegative ? `-${formatted}` : formatted;
};
