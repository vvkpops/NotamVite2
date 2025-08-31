import React from 'react';
import { NEW_NOTAM_HIGHLIGHT_DURATION_MS } from '../constants';

const IcaoTabs = ({ 
  tabMode, 
  onTabClick, 
  icaoSet, 
  notamDataByIcao, 
  newNotamsByIcao
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
        
        return (
          <button
            key={icao}
            onClick={() => onTabClick(icao)}
            className={`icao-tab ${tabMode === icao ? "active" : ""}`}
          >
            {icao} ({notamCount})
            {renderNotificationBadge(newCount)}
          </button>
        );
      })}
    </div>
  );
};

export default IcaoTabs;
