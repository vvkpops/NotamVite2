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
}) => {
  
  const getFilteredAndSortedNotams = () => {
    let notamsToDisplay = [];
    
    if (tabMode === "ALL") {
      // Collect all NOTAMs from all loaded ICAOs into a single array
      let allNotams = [];
      Object.entries(notamDataByIcao).forEach(([icao, notams]) => {
        if (Array.isArray(notams) && notams.length > 0) {
          // Add the ICAO code to each NOTAM object for context
          allNotams.push(...notams.map(n => ({ ...n, icao })));
        }
      });
      notamsToDisplay = allNotams;

    } else {
      // For a specific tab, just use its NOTAMs
      const notams = notamDataByIcao[tabMode] || [];
      notamsToDisplay = notams.map(n => ({ ...n, icao: tabMode }));
    }

    // Apply user filters and keyword search
    const filtered = applyNotamFilters(notamsToDisplay, filters, keywordFilter);
    
    // Sort the final list by priority, exactly like the original app
    return sortNotams(filtered, 'priority');
  };

  const finalNotams = getFilteredAndSortedNotams();

  return (
    <div id="result">
      {finalNotams.length > 0 ? (
        <div className="notam-grid">
          {finalNotams.map((notam, index) => {
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
                newNotamsByIcao={notamDataByIcao.newNotamsByIcao || {}}
              />
            );
          })}
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
