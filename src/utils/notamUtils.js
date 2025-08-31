// src/utils/notamUtils.js - Complete file with all exports

import { 
  ICAO_CLASSIFICATION_MAP, 
  NOTAM_TYPES,
  NOTAM_PRIORITIES,
  NEW_NOTAM_HIGHLIGHT_DURATION_MS
} from '../constants';

// Classification and type utilities
export const getClassificationTitle = (classification) => {
  if (!classification) return "Other";
  const code = classification.trim().toUpperCase();
  return ICAO_CLASSIFICATION_MAP[code] || "Other";
};

export const parseDate = (s) => {
  if (!s) return null;
  // Handle different date formats that might come from APIs
  let d = new Date(s);
  if (!isNaN(d)) return d;
  
  // Try parsing YYMMDDHHMM
  if (/^\d{10}$/.test(s)) {
      const year = 2000 + parseInt(s.substring(0, 2), 10);
      const month = parseInt(s.substring(2, 4), 10) - 1;
      const day = parseInt(s.substring(4, 6), 10);
      const hour = parseInt(s.substring(6, 8), 10);
      const minute = parseInt(s.substring(8, 10), 10);
      d = new Date(Date.UTC(year, month, day, hour, minute));
      if (!isNaN(d)) return d;
  }
  
  return null;
};

export const isNotamCurrent = (notam) => {
  const validFrom = parseDate(notam.validFrom);
  const now = new Date();
  return !validFrom || validFrom <= now;
};

export const isNotamFuture = (notam) => {
  const validFrom = parseDate(notam.validFrom);
  const now = new Date();
  return validFrom && validFrom > now;
};

export const getNotamFlags = (notam) => {
  const s = (notam.summary + ' ' + notam.body).toUpperCase();
  return {
    isRunwayClosure: /\b(RWY|RUNWAY)[^\n]*\b(CLSD|CLOSED)\b/.test(s),
    isTaxiwayClosure: /\b(TWY|TAXIWAY)[^\n]*\b(CLSD|CLOSED)\b/.test(s),
    isRSC: /\bRSC\b/.test(s),
    isCRFI: /\bCRFI\b/.test(s),
    isILS: /\bILS\b/.test(s) && !/\bCLOSED|CLSD\b/.test(s),
    isFuel: /\bFUEL\b/.test(s),
    isCancelled: notam.type === "C" || /\b(CANCELLED|CNL)\b/.test(s),
    isDom: isDomesticNotam(notam)
  };
};

export const isDomesticNotam = (notam) => {
  if (notam.classification === 'DOM' || notam.classification === 'DOMESTIC') return true;
  if (notam.type === 'DOM') return true;
  if (notam.source === 'NAVCAN' && notam.summary && /\bDOMESTIC\s+(OPERATIONS?|FLIGHTS?|ONLY)\b/i.test(notam.summary)) return true;
  if (notam.qLine && /\/NBO\//.test(notam.qLine)) return true;
  const content = ((notam.summary || '') + ' ' + (notam.body || '')).toUpperCase();
  return /\b(DOMESTIC\s+(ONLY|FLIGHTS?|OPERATIONS?)|FOR\s+DOMESTIC\s+USE)\b/.test(content);
};

export const getNotamType = (notam) => {
  const flags = getNotamFlags(notam);
  if (flags.isRunwayClosure) return 'rwy';
  if (flags.isTaxiwayClosure) return 'twy';
  if (flags.isRSC) return 'rsc';
  if (flags.isCRFI) return 'crfi';
  if (flags.isILS) return 'ils';
  if (flags.isFuel) return 'fuel';
  if (flags.isCancelled) return 'cancelled';
  return 'other';
};

export const getHeadClass = (notam) => `head-${getNotamType(notam)}`;

export const getHeadTitle = (notam) => NOTAM_TYPES[getNotamType(notam)] || 'GENERAL NOTAM';

export const extractRunways = (text) => {
  const rwyMatches = [];
  const regex = /\bRWY\s*(\d{2,3}(?:[LRC])?(?:\/\d{2,3}(?:[LRC])?)*)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    rwyMatches.push(match[1]);
  }
  return [...new Set(rwyMatches)].join(', ');
};

export const needsExpansion = (summary, body, cardScale = 1.0) => {
  if (!summary) return false;
  const baseLength = 250;
  const adjustedThreshold = Math.round(baseLength / cardScale);
  const summaryLength = summary ? summary.length : 0;
  return summaryLength > adjustedThreshold;
};

export const isNewNotam = (notam, newNotamsByIcao) => {
  if (!notam || !newNotamsByIcao) return false;
  const notamKey = notam.id || notam.number;
  const newNotamRecords = newNotamsByIcao[notam.icao] || [];
  const now = Date.now();
  return newNotamRecords.some(n => n.id === notamKey && (now - n.timestamp < NEW_NOTAM_HIGHLIGHT_DURATION_MS));
};

export const compareNotamSets = (icao, previousNotams, newNotams) => {
  const createNotamKey = (notam) => notam.id || notam.number || notam.summary;
  
  const prevKeys = new Set((previousNotams || []).map(createNotamKey));
  const newKeys = new Set((newNotams || []).map(createNotamKey));
  
  const addedNotams = (newNotams || []).filter(notam => !prevKeys.has(createNotamKey(notam)));
  const removedNotams = (previousNotams || []).filter(notam => !newKeys.has(createNotamKey(notam)));
  
  return {
    added: addedNotams,
    removed: removedNotams,
    total: newNotams ? newNotams.length : 0
  };
};

// Filter and sorting utilities
export const applyNotamFilters = (notams, filters, keywordFilter) => {
  return notams.filter(notam => {
    const notamType = getNotamType(notam);
    
    if (!filters[notamType]) return false;
    
    if (keywordFilter && !(notam.summary + ' ' + notam.body).toLowerCase().includes(keywordFilter.toLowerCase())) {
      return false;
    }
    
    if (isDomesticNotam(notam) && !filters.dom) return false;
    
    const isCurrent = isNotamCurrent(notam);
    const isFuture = isNotamFuture(notam);
    
    if ((isCurrent && !filters.current) || (isFuture && !filters.future)) {
        if(!(isCurrent && isFuture)){ // Don't filter out notams that are both current and future if one is checked
            return false;
        }
    }
    
    return true;
  });
};

export const sortNotams = (notams, sortBy = 'priority') => {
  const sortFunctions = {
    priority: (a, b) => {
      const aPrio = NOTAM_PRIORITIES[getNotamType(a)] || 99;
      const bPrio = NOTAM_PRIORITIES[getNotamType(b)] || 99;
      
      if (aPrio !== bPrio) return aPrio - bPrio;
      
      const aDate = parseDate(a.validFrom) || new Date(0);
      const bDate = parseDate(b.validFrom) || new Date(0);
      return bDate - aDate;
    },
    date: (a, b) => (parseDate(b.validFrom) || 0) - (parseDate(a.validFrom) || 0),
    icao: (a, b) => a.icao.localeCompare(b.icao) || sortFunctions.priority(a, b),
    type: (a, b) => getNotamType(a).localeCompare(getNotamType(b)) || sortFunctions.date(a, b)
  };
  
  return [...notams].sort(sortFunctions[sortBy] || sortFunctions.priority);
};

// Other utilities remain the same...
