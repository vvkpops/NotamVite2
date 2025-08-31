import React from 'react';
import { 
  getNotamType, 
  getHeadClass, 
  getHeadTitle, 
  extractRunways, 
  needsExpansion,
  isNotamCurrent,
  isNotamFuture,
  getClassificationTitle,
  isNewNotam
} from '../utils/notamUtils';
import { HEAD_COLOR_STYLES, TIME_STATUS_STYLES } from '../constants';

const NotamCard = ({
  notam,
  cardKey,
  expanded,
  cardScale,
  onCardClick,
  newNotamsByIcao
}) => {
  const type = getNotamType(notam);
  const headClass = getHeadClass(notam);
  const headTitle = getHeadTitle(notam);
  const runways = type === "rwy" ? extractRunways(notam.summary + " " + notam.body) : "";
  
  const needsToExpand = needsExpansion(notam.summary, notam.body, cardScale);
  const timeStatus = isNotamCurrent(notam) ? "Current" : isNotamFuture(notam) ? "Future" : "";
  const isNew = isNewNotam(notam, newNotamsByIcao);

  const cardDynamicStyles = {
    transform: `scale(${cardScale})`,
    transformOrigin: 'top left',
    marginBottom: cardScale > 1 ? `${(cardScale - 1) * 280}px` : '0',
    marginRight: cardScale > 1 ? `${(cardScale - 1) * 320 * 0.5}px` : '0',
    zIndex: expanded ? 10 : 1,
    cursor: needsToExpand ? 'pointer' : 'default'
  };

  const handleCardClick = () => {
    if (needsToExpand) {
      onCardClick(cardKey);
    }
  };
  
  return (
    <div
      className={`notam-card notam-animate glass ${expanded ? 'expanded-card' : ''} ${isNew ? 'new-notam-highlight' : ''}`}
      id={`notam-${cardKey}`}
      onClick={handleCardClick}
      style={cardDynamicStyles}
    >
      <div 
        className={`card-head ${headClass}`} 
        style={HEAD_COLOR_STYLES[headClass]}
      >
        <span className="truncate">{headTitle}</span>
        {type === 'rwy' && runways && (
          <span className="font-mono font-bold">{runways}</span>
        )}
      </div>
      
      <div className="notam-card-content">
        <div className="notam-head">
          <span>{notam.number}</span>
          <span className="text-cyan-300 ml-2">{notam.icao}</span>
          {isNew && (
            <span className="new-notam-badge ml-2">NEW</span>
          )}
        </div>
        
        <div className="notam-meta">
          <span><b>Class:</b> {getClassificationTitle(notam.classification)}</span>
          <span>
            {timeStatus && (
              <span className="time-status" style={TIME_STATUS_STYLES[timeStatus.toLowerCase()]}>
                {timeStatus}
              </span>
            )}
            <b>Valid:</b> {notam.validFrom?.replace('T', ' ').slice(0,16)} → {notam.validTo?.replace('T', ' ').slice(0,16) || 'PERM'}
          </span>
        </div>
        
        <div 
          className={expanded ? "notam-full-text" : "notam-summary"}
          dangerouslySetInnerHTML={{ __html: notam.summary ? notam.summary.replace(/\n/g, '<br>') : "" }} 
        />
        
        {needsToExpand && (
          <button 
            onClick={(e) => { e.stopPropagation(); onCardClick(cardKey); }}
            className="card-expand-btn"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            <i className={`fa fa-angle-${expanded ? "up" : "down"}`}></i>
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(NotamCard);
