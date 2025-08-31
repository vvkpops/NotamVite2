import React from 'react';

const ProgressBar = ({ 
  loadedCount, 
  totalIcaos, 
  loadingCount, 
  queuedCount,
  failedCount,
  autoRefreshCountdown, 
  batchingActive 
}) => {
  if (totalIcaos === 0) return null;

  const progressPercentage = totalIcaos > 0 ? (loadedCount / totalIcaos) * 100 : 0;
  const hasFailures = failedCount > 0;

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getStatusText = () => {
    if (loadingCount > 0 || queuedCount > 0) return "🔄 Loading...";
    if (hasFailures) return `⚠️ Complete with ${failedCount} error(s)`;
    if (loadedCount === totalIcaos) return "✅ Complete";
    return "Status unknown";
  };

  return (
    <div className="progress-bar-container">
      <div className="progress-bar-label">
        Loading Progress: {loadedCount}/{totalIcaos} ICAOs
        {loadingCount > 0 && ` (${loadingCount} loading)`}
        {queuedCount > 0 && ` (${queuedCount} queued)`}
        {hasFailures && ` (${failedCount} failed)`}
      </div>
      
      <div className={`progress-bar-bg ${hasFailures ? 'has-failures' : ''}`}>
        <div 
          className="progress-bar" 
          style={{ width: `${progressPercentage}%` }}
        ></div>
        <div className="progress-bar-text">
          {Math.round(progressPercentage)}%
        </div>
      </div>
      
      <div className="progress-bar-timer">
        {batchingActive && <span className="text-cyan-400">⚡ Fetching NOTAMs...</span>}
        {!batchingActive && totalIcaos > 0 && (
          <span>
            Auto-refresh in {formatTime(autoRefreshCountdown)} | 
            Status: {getStatusText()}
          </span>
        )}
      </div>
    </div>
  );
};

export default ProgressBar;
