// ICAO Classification mapping
export const ICAO_CLASSIFICATION_MAP = {
  AA: "Aerodrome",
  RW: "Runway", 
  TW: "Taxiway",
  AB: "Obstacle",
  AC: "Communications",
  AD: "Navigation Aid",
  AE: "Airspace Restriction",
  AO: "Other",
  GP: "GPS",
  NAV: "Navigation",
  COM: "Communication",
  SVC: "Service",
  DOM: "Domestic",
  INTL: "International",
  MISC: "Miscellaneous",
  SEC: "Security",
  FDC: "Flight Data Center",
  SAA: "Special Activity Airspace"
};

// Timing constants
export const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const NEW_NOTAM_HIGHLIGHT_DURATION_MS = 60 * 1000; // 60 seconds

// Batching constants
export const BATCH_SIZE = 1; // Process one at a time to avoid rate limits
export const BATCH_INTERVAL_MS = 3000; // 3 second intervals between requests
export const CALLS_PER_WINDOW = 25; // Conservative limit
export const WINDOW_MS = 65000; // 65 second window
export const MAX_RETRIES = 3; // Max retries for a failing ICAO

// NOTAM Types and titles
export const NOTAM_TYPES = {
  rwy: 'RUNWAY CLOSURE',
  twy: 'TAXIWAY CLOSURE', 
  rsc: 'RUNWAY CONDITIONS',
  crfi: 'FRICTION INDEX',
  ils: 'ILS/NAV AID',
  fuel: 'FUEL SERVICES',
  cancelled: 'CANCELLED',
  other: 'GENERAL NOTAM'
};

// Head color styles for NOTAM cards
export const HEAD_COLOR_STYLES = {
  'head-rwy': { backgroundColor: 'rgba(220, 38, 38, 0.4)', color: '#fca5a5' },
  'head-twy': { backgroundColor: 'rgba(245, 158, 11, 0.4)', color: '#fcd34d' },
  'head-rsc': { backgroundColor: 'rgba(16, 185, 129, 0.4)', color: '#6ee7b7' },
  'head-crfi': { backgroundColor: 'rgba(139, 92, 246, 0.4)', color: '#c4b5fd' },
  'head-ils': { backgroundColor: 'rgba(59, 130, 246, 0.4)', color: '#93c5fd' },
  'head-fuel': { backgroundColor: 'rgba(236, 72, 153, 0.4)', color: '#f9a8d4' },
  'head-cancelled': { backgroundColor: 'rgba(107, 114, 128, 0.4)', color: '#d1d5db' },
  'head-other': { backgroundColor: 'rgba(75, 85, 99, 0.4)', color: '#d1d5db' }
};

// Time status styles
export const TIME_STATUS_STYLES = {
  current: { backgroundColor: 'rgba(16, 185, 129, 0.3)', color: '#6ee7b7' },
  future: { backgroundColor: 'rgba(251, 191, 36, 0.3)', color: '#fde68a' }
};

// Filter labels for UI
export const FILTER_LABELS = {
  rwy: 'RWY Closure',
  twy: 'TWY Closure', 
  rsc: 'RSC',
  crfi: 'CRFI',
  ils: 'ILS',
  fuel: 'FUEL',
  other: 'Other',
  cancelled: 'Cancelled',
  dom: 'DOM',
  current: 'Current',
  future: 'Future'
};

// Default filter state
export const DEFAULT_FILTERS = {
  rwy: true,
  twy: true,
  rsc: true,
  crfi: true,
  ils: true,
  fuel: true,
  other: true,
  cancelled: false,
  dom: false,
  current: true,
  future: true
};

// API Configuration
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_BASE_URL || '',
  TIMEOUT: 15000, // 15 seconds
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY: 1000 // 1 second
};

// UI Constants
export const UI_CONSTANTS = {
  MAX_ICAO_INPUT_LENGTH: 100,
  MIN_CARD_SCALE: 0.5,
  MAX_CARD_SCALE: 1.5,
  CARD_SCALE_STEP: 0.01,
  BACK_TO_TOP_THRESHOLD: 300, // pixels
  NOTIFICATION_AUTO_HIDE_DELAY: 5000, // 5 seconds
  MAX_NOTIFICATIONS: 10
};

// Local Storage Keys
export const STORAGE_KEYS = {
  ICAO_SETS: 'icaoSets',
  SAVED_ICAOS: 'notamIcaos',
  NOTAM_DATA_CACHE: 'notamDataCache',
  LAST_NOTAM_IDS_CACHE: 'lastNotamIdsCache',
  CACHE_TIMESTAMP: 'notamCacheTimestamp',
  USER_PREFERENCES: 'notamUserPreferences',
  SESSION_ID: 'notamDashboardSession'
};

// Date Formats
export const DATE_FORMATS = {
  NOTAM: 'YYMMDDHHmm',
  DISPLAY: 'MMM DD, YYYY HH:mm',
  ISO: 'YYYY-MM-DDTHH:mm:ss.sssZ',
  SHORT: 'MM/DD/YY HH:mm'
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error occurred. Please check your connection.',
  API_ERROR: 'API error occurred. Please try again later.',
  INVALID_ICAO: 'Invalid ICAO code format. Must be 4 uppercase letters.',
  NO_DATA: 'No NOTAM data available.',
  TIMEOUT: 'Request timed out. Please try again.',
  RATE_LIMITED: 'Too many requests. Please wait before trying again.',
  SERVER_ERROR: 'Server error occurred. Please try again later.',
  PARSE_ERROR: 'Failed to parse NOTAM data.',
  STORAGE_ERROR: 'Failed to save data to local storage.'
};

// NOTAM Priorities (for sorting)
export const NOTAM_PRIORITIES = {
  rwy: 1,      // Highest priority
  twy: 2,
  rsc: 3,
  crfi: 4,
  ils: 5,
  fuel: 6,
  other: 7,
  cancelled: 8  // Lowest priority
};
