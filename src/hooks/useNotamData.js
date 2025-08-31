import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchNotamsForIcao } from '../services/notamService';
import { getCachedNotamData, setCachedNotamData, isCacheValid } from '../utils/storageUtils';
import { compareNotamSets } from '../utils/notamUtils';
import { AUTO_REFRESH_INTERVAL_MS, BATCH_INTERVAL_MS, NEW_NOTAM_HIGHLIGHT_DURATION_MS } from '../constants';

export const useNotamData = ({ icaoSet, activeSession, isInitialized, showNotification }) => {
  const [notamDataByIcao, setNotamDataByIcao] = useState({});
  const [icaoStatus, setIcaoStatus] = useState({}); // e.g. { KJFK: 'loaded', KLAX: 'loading' }
  const [newNotamsByIcao, setNewNotamsByIcao] = useState({});
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(AUTO_REFRESH_INTERVAL_MS / 1000);

  const queueRef = useRef([]);
  const isProcessingRef = useRef(false);
  const isAutoRefreshingRef = useRef(false);
  const retryCountsRef = useRef({});

  const stableShowNotification = useCallback(showNotification, []);

  // The core function to process a single ICAO
  const fetchAndProcessIcao = useCallback(async (icao) => {
    if (!activeSession) return;

    setIcaoStatus(prev => ({ ...prev, [icao]: 'loading' }));

    const result = await fetchNotamsForIcao(icao);

    // Handle fetch failure
    if (result?.error) {
      const retries = (retryCountsRef.current[icao] || 0) + 1;
      if (retries < 3) {
        retryCountsRef.current[icao] = retries;
        console.warn(`[Fetcher] Re-queueing ${icao} (attempt ${retries}) due to error:`, result.error);
        queueRef.current.push(icao); // Add to back of the queue
      } else {
        console.error(`[Fetcher] ICAO ${icao} failed after 3 attempts. Giving up.`);
        setIcaoStatus(prev => ({ ...prev, [icao]: 'failed' }));
        stableShowNotification(`Failed to load NOTAMs for ${icao}.`, icao);
      }
      return;
    }

    // Handle fetch success
    retryCountsRef.current[icao] = 0; // Reset retry count on success
    const notams = result.data || [];

    setNotamDataByIcao(prevData => {
      const comparison = compareNotamSets(icao, prevData[icao], notams);
      if (comparison.added.length > 0) {
        const newNotamInfo = comparison.added.map(n => ({ id: n.id || n.number, timestamp: Date.now() }));
        setNewNotamsByIcao(p => ({ ...p, [icao]: [...(p[icao] || []), ...newNotamInfo] }));
        if (!isAutoRefreshingRef.current) {
          stableShowNotification(`${icao}: ${comparison.added.length} new NOTAM(s) detected!`, icao);
        }
      }
      return { ...prevData, [icao]: notams };
    });

    setIcaoStatus(prev => ({ ...prev, [icao]: 'loaded' }));

  }, [activeSession, stableShowNotification]);


  // The loop that processes the queue
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current || queueRef.current.length === 0) {
      isProcessingRef.current = false;
      return;
    }

    isProcessingRef.current = true;
    const icaoToProcess = queueRef.current.shift();

    if (icaoToProcess) {
      await fetchAndProcessIcao(icaoToProcess);
    }
    
    // Schedule the next run
    setTimeout(() => {
      isProcessingRef.current = false;
      processQueue();
    }, BATCH_INTERVAL_MS);

  }, [fetchAndProcessIcao]);

  // Effect to queue ICAOs when the `icaoSet` changes
  useEffect(() => {
    if (!isInitialized) return;

    const newIcaos = icaoSet.filter(icao => !(icao in icaoStatus));
    if (newIcaos.length > 0) {
      setIcaoStatus(prev => {
        const newStatuses = { ...prev };
        newIcaos.forEach(icao => { newStatuses[icao] = 'queued' });
        return newStatuses;
      });
      queueRef.current.push(...newIcaos);
      if (!isProcessingRef.current) {
        processQueue();
      }
    }
    
    // Remove statuses for ICAOs that are no longer in the set
    setIcaoStatus(prev => {
        const nextStatus = {};
        icaoSet.forEach(icao => {
            if(prev[icao]) nextStatus[icao] = prev[icao];
        });
        return nextStatus;
    });

  }, [isInitialized, icaoSet, processQueue]);


  // Effect for initial load from cache
  useEffect(() => {
    if (!isInitialized) return;
    
    const cached = getCachedNotamData();
    if (isCacheValid() && cached.notamData) {
      console.log("✅ Loading from valid cache.");
      setNotamDataByIcao(cached.notamData);
      const cachedIcaos = Object.keys(cached.notamData);
      setIcaoStatus(prev => {
          const newStatuses = {...prev};
          cachedIcaos.forEach(icao => { newStatuses[icao] = 'loaded' });
          return newStatuses;
      });
    }
  }, [isInitialized]);

  // Effect to cache data when it changes
  useEffect(() => {
    if (Object.keys(notamDataByIcao).length > 0) {
      setCachedNotamData({ notamData: notamDataByIcao, timestamp: Date.now() });
    }
  }, [notamDataByIcao]);

  // Effect for the auto-refresh timer
  useEffect(() => {
    if (!activeSession || icaoSet.length === 0) return;

    const performAutoRefresh = () => {
      console.log('🔄 Performing auto-refresh...');
      isAutoRefreshingRef.current = true;
      retryCountsRef.current = {}; // Reset all retry counts
      
      setIcaoStatus(prev => {
        const newStatuses = {};
        icaoSet.forEach(icao => { newStatuses[icao] = 'queued' });
        return newStatuses;
      });
      
      queueRef.current.push(...icaoSet);
      if (!isProcessingRef.current) {
        processQueue();
      }

      setTimeout(() => { isAutoRefreshingRef.current = false; }, 5000);
    };

    const refreshInterval = setInterval(performAutoRefresh, AUTO_REFRESH_INTERVAL_MS);
    const countdownInterval = setInterval(() => {
      setAutoRefreshCountdown(prev => (prev > 0 ? prev - 1 : AUTO_REFRESH_INTERVAL_MS / 1000));
    }, 1000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
  }, [activeSession, icaoSet, processQueue]);
  
  // Cleanup for old "new notam" highlights
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setNewNotamsByIcao(prev => {
        const cleaned = {};
        Object.entries(prev).forEach(([icao, notams]) => {
          const fresh = notams.filter(n => now - n.timestamp < NEW_NOTAM_HIGHLIGHT_DURATION_MS);
          if (fresh.length > 0) cleaned[icao] = fresh;
        });
        return cleaned;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleReloadAll = useCallback(() => {
    if (!icaoSet.length) return;
    console.log('🔄 Manual reload all triggered');
    setCachedNotamData(null); // Invalidate cache
    isAutoRefreshingRef.current = false; // Treat as a manual load
    retryCountsRef.current = {};
    queueRef.current = [];

    setNotamDataByIcao({});
    const newStatuses = {};
    icaoSet.forEach(icao => { newStatuses[icao] = 'queued' });
    setIcaoStatus(newStatuses);

    queueRef.current.push(...icaoSet);
    if (!isProcessingRef.current) {
      processQueue();
    }
  }, [icaoSet, processQueue]);

  // Derive counts for the progress bar from the status object
  const loadedCount = Object.values(icaoStatus).filter(s => s === 'loaded').length;
  const loadingCount = Object.values(icaoStatus).filter(s => s === 'loading').length;
  const failedCount = Object.values(icaoStatus).filter(s => s === 'failed').length;
  const queuedCount = queueRef.current.length;

  return {
    notamDataByIcao: { ...notamDataByIcao, newNotamsByIcao },
    loadingIcaosSet: new Set(Object.keys(icaoStatus).filter(k => icaoStatus[k] === 'loading')),
    loadedIcaosSet: new Set(Object.keys(icaoStatus).filter(k => icaoStatus[k] === 'loaded')),
    failedIcaosSet: new Set(Object.keys(icaoStatus).filter(k => icaoStatus[k] === 'failed')),
    icaoQueue: queueRef.current,
    batchingActive: isProcessingRef.current || queueRef.current.length > 0,
    autoRefreshCountdown,
    handleReloadAll,
  };
};
