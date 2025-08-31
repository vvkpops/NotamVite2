// src/components/NotamGrid.jsx
import React from 'react';
import NotamCard from './NotamCard';
import { 
  applyNotamFilters, 
  sortNotams
} from '../utils/notamUtils';

const NotamGrid = ({
  tabMode,
  notamDataByIcao,
  filters,
  keywordFilter,
  expandedCardKey,
  cardScale,
  onCardClick,
  newNotamsByIcao
}) => {
  
  const getFilteredNotams = () => {
    let allNotams = [];
    
    if (tabMode === "ALL") {
      let icaoGroups = {};
      Object.entries(notamDataByIcao).forEach(([icao, notams]) => {
        if (Array.isArray(notams) && notams.length > 0) {
          icaoGroups[icao] = notams.map(n => ({ ...n, icao }));
        }
      });
      
      const sortedIcaos = Object.keys(icaoGroups).sort();
      
      sortedIcaos.forEach(icao => {
        const filteredNotamsForIcao = applyNotamFilters(
          icaoGroups[icao], 
          filters, 
          keywordFilter
        );
        
        if (filteredNotamsForIcao.length > 0) {
          const sortedNotams = sortNotams(filteredNotamsForIcao, 'priority');
          allNotams.push({ isIcaoHeader: true, icao, count: sortedNotams.length });
          allNotams.push(...sortedNotams);
        }
      });
      
      return allNotams;
    } 
    else {
      const notams = notamDataByIcao[tabMode] || [];
      const notamsWithIcao = notams.map(n => ({ ...n, icao: tabMode }));
      const filtered = applyNotamFilters(notamsWithIcao, filters, keywordFilter);
      return sortNotams(filtered, 'priority');
    }
  };

  const renderNotam = (notam, index) => {
    if (notam.isIcaoHeader) {
      return (
        <div 
          key={`header-${notam.icao}`} 
          className="glass icao-header-card" 
          style={{
            gridColumn: '1 / -1', 
            margin: '10px 0 5px 0',
            padding: '0.75rem',
            background: 'rgba(30, 41, 59, 0.8)',
            borderBottom: '2px solid #0891b2'
          }}
        >
          <h3 className="text-xl font-bold text-cyan-300">
            {notam.icao} 
            <span className="text-base font-normal text-slate-300 ml-2">
              ({notam.count} NOTAMs)
            </span>
          </h3>
        </div>
      );
    }
    
    const key = notam.id || `${notam.number}-${index}`;
    const cardKey = `${notam.icao}-${key}`;
    
    return (
      <NotamCard
        key={cardKey}
        notam={notam}
        cardKey={cardKey}
        expanded={expandedCardKey === cardKey}
        cardScale={cardScale}
        onCardClick={onCardClick}
        newNotamsByIcao={newNotamsByIcao}
      />
    );
  };

  const filteredNotams = getFilteredNotams();

  return (
    <div id="result">
      {filteredNotams.length > 0 ? (
        <div className="notam-grid">
          {filteredNotams.map(renderNotam)}
        </div>
      ) : (
        <div className="glass p-8 rounded-lg text-center text-base text-slate-400">
          {Object.keys(notamDataByIcao).length === 0 
            ? "Add ICAO codes above to get started."
            : "No NOTAMs found matching the current filters."
          }
        </div>
      )}
    </div>
  );
};

export default NotamGrid;
