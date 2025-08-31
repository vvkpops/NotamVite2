import { NOTAM_PRIORITIES, NOTAM_TYPES, ICAO_CLASSIFICATION_MAP, NEW_NOTAM_HIGHLIGHT_DURATION_MS } from '../constants';

// --- Type and Classification Helpers ---

/**
 * Determines the primary type of a NOTAM based on its content.
 * This is used for sorting and styling.
 */
export const getNotamType = (notam) => {
  if (!notam || !notam.body) return 'other';
  const text = notam.body.toUpperCase();

  if (text.includes('CANCELLED') || text.includes('REPLACED')) return 'cancelled';
  if (/\b(RWY|RUNWAY)\b.*\b(CLSD|CLOSED)\b/.test(text)) return 'rwy';
  if (/\b(TWY|TAXIWAY)\b.*\b(CLSD|CLOSED)\b/.test(text)) return 'twy';
  if (/\b(RSC|RUNWAY SURFACE CONDITION)\b/.test(text)) return 'rsc';
  if (/\bCRFI\b/.test(text)) return 'crfi';
  if (/\b(ILS|GLIDE PATH|GP|LOC|LOCALIZER)\b/.test(text)) return 'ils';
  if (/\b(FUEL|AVGAS|JET)\b/.test(text)) return 'fuel';
  
  return 'other';
};

export const getHeadClass = (notam) => `head-${getNotamType(notam)}`;

export const getHeadTitle = (notam) => NOTAM_TYPES[getNotamType(notam)] || 'GENERAL NOTAM';

export const getClassificationTitle = (classification) => {
    if (!classification) return "Other";
    const code = classification.trim().toUpperCase();
    return ICAO_CLASSIFICATION_MAP[code] || classification;
};

// --- Sorting and Filtering ---

/**
 * Sorts an array of NOTAMs based on priority and then date.
 */
export const sortNotams = (notams) => {
  return notams.sort((a, b) => {
    const priorityA = NOTAM_PRIORITIES[getNotamType(a)] || 99;
    const priorityB = NOTAM_PRIORITIES[getNotamType(b)] || 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // If priorities are the same, sort by most recent validFrom date
    try {
      return new Date(b.validFrom) - new Date(a.validFrom);
    } catch {
      return 0;
    }
  });
};

/**
 * Applies all active filters to a list of NOTAMs.
 */
export const applyNotamFilters = (notams, filters, keyword) => {
  const lowerKeyword = keyword.toLowerCase();

  return notams.filter(notam => {
    const type = getNotamType(notam);

    // Type filters
    if (!filters[type]) return false;
    
    // Time filters
    const isCurrent = isNotamCurrent(notam);
    const isFuture = isNotamFuture(notam);
    if (!filters.current && isCurrent) return false;
    if (!filters.future && isFuture) return false;
    if (!isCurrent && !isFuture && (filters.current || filters.future)) return false;

    // Keyword filter
    if (lowerKeyword) {
      const content = `${notam.body} ${notam.number} ${notam.icao}`.toLowerCase();
      if (!content.includes(lowerKeyword)) {
        return false;
      }
    }
    
    // DOM filter (Placeholder for future implementation)
    // if (filters.dom && !notam.isDomestic) return false;

    return true;
  });
};

// --- Time and Date Helpers ---

export const isNotamCurrent = (notam) => {
  if (!notam.validFrom) return true; // Assume current if no start date
  const now = new Date();
  const from = new Date(notam.validFrom);
  const to = notam.validTo ? new Date(notam.validTo) : null;
  return from <= now && (!to || to >= now);
};

export const isNotamFuture = (notam) => {
  if (!notam.validFrom) return false;
  const now = new Date();
  const from = new Date(notam.validFrom);
  return from > now;
};

// --- UI and Display Helpers ---

/**
 * Extracts runway designators (e.g., 06L/24R) from NOTAM text.
 */
export const extractRunways = (text) => {
  if (!text) return '';
  const rwyMatches = [];
  const regex = /\b(RWY|RUNWAY)\s*(\d{2,3}(?:[LRC])?(?:\/\d{2,3}(?:[LRC])?)*)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    rwyMatches.push(match[2]);
  }
  return [...new Set(rwyMatches)].join(', ');
};

/**
 * Checks if a NOTAM's content is too long to fit in the card, requiring an expand button.
 */
export const needsExpansion = (summary, body, scale) => {
    // Estimate lines based on characters. A line is roughly 50-60 chars.
    const charLimit = (280 / 20) * 55 / scale; // (CardHeight / LineHeight) * CharsPerLine / Scale
    return body.length > charLimit;
};

/**
 * Checks if a NOTAM should be highlighted as new.
 */
export const isNewNotam = (notam, newNotamsByIcao) => {
    if (!newNotamsByIcao || !notam || !notam.icao) return false;
    const newNotamsForIcao = newNotamsByIcao[notam.icao] || [];
    const now = Date.now();
    return newNotamsForIcao.some(n => 
        n.id === notam.id && (now - n.timestamp < NEW_NOTAM_HIGHLIGHT_DURATION_MS)
    );
};


// --- Data Comparison ---

/**
 * Compares two sets of NOTAMs for an ICAO and identifies added/removed ones.
 */
export const compareNotamSets = (icao, oldNotams = [], newNotams = []) => {
    const oldIds = new Set((oldNotams || []).map(n => n.id));
    const newIds = new Set((newNotams || []).map(n => n.id));

    const added = (newNotams || []).filter(n => !oldIds.has(n.id));
    const removed = (oldNotams || []).filter(n => !newIds.has(n.id));

    return { added, removed };
};
