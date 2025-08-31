import React from 'react';
import { NEW_NOTAM_HIGHLIGHT_DURATION_MS } from '../constants';

const IcaoTabs = ({ 
  tabMode, 
  onTabClick, 
  icaoSet, 
  notamDataByIcao, 
  newNotamsByIcao,
  failedIcaosSet
}) => {
  if (icaoSet.length === 0) return null;

  const getNotamCount = (icao) => (notamDataByIcao[icao] || []).length;

  const getNewNotamCount = (icao) => {
    const newNotams = newNotamsByIcao[icao] || [];
    const now = Date.now();
    return newNotams.filter(item => now - item.timestamp < NEW_NOTAM_HIGHLIGHT_DURATION_MS).length;
  };
  
  const totalNotamCount = icaoSet.reduce((sum, icao) => sum + getNotamCount(icao), 0);
  const totalNewNotamCount = icaoSet.reduce((sum, icao) => sum + getNewNotamCount(icao), 0);

  const renderNotificationBadge = (count) => {
    if (count === 0) return null;
    return (
      <span className="notam-notification-badge" title={`${count} new NOTAMs`}>
        {count > 9 ? '9+' : count}
      </span>
    );
  };

  return (
    <div className="icao-tabs">
      {/* ALL Tab */}
      <button
        onClick={() => onTabClick("ALL")}
        className={`icao-tab ${tabMode === "ALL" ? "active" : ""}`}
      >
        ALL ({totalNotamCount})
        {renderNotificationBadge(totalNewNotamCount)}
      </button>
      
      {/* Individual ICAO Tabs */}
      {icaoSet.map(icao => {
        const notamCount = getNotamCount(icao);
        const newCount = getNewNotamCount(icao);
        const hasFailed = failedIcaosSet.has(icao);
        
        let tabClass = `icao-tab ${tabMode === icao ? "active" : ""}`;
        if (hasFailed) {
          tabClass += " failed";
        }

        return (
          <button
            key={icao}
            onClick={() => onTabClick(icao)}
            className={tabClass}
            title={hasFailed ? `Failed to load NOTAMs for ${icao}` : `${icao} NOTAMs`}
          >
            {hasFailed && <i className="fa fa-exclamation-triangle mr-1"></i>}
            {icao} ({notamCount > 0 ? notamCount : '...'})
            {renderNotificationBadge(newCount)}
          </button>
        );
      })}
    </div>
  );
};

export default IcaoTabs;
