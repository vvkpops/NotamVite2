import { useState, useEffect, useCallback, useRef } from 'react';
import { useBatchingSystem } from './useBatchingSystem';
import { fetchNotamsForIcao } from '../services/notamService';
import { getCachedNotamData, setCachedNotamData, isCacheValid } from '../utils/storageUtils';
import { compareNotamSets } from '../utils/notamUtils';
import { AUTO_REFRESH_INTERVAL_MS, NEW_NOTAM_HIGHLIGHT_DURATION_MS } from '../constants';

export const useNotamData = ({ icaoSet, activeSession, isInitialized, showNotification }) => {
  const [notamDataByIcao, setNotamDataByIcao] = useState({});
  const [loadedIcaosSet, setLoadedIcaosSet] = useState(new Set());
  const [failedIcaosSet, setFailedIcaosSet] = useState(new Set());
  const [newNotamsByIcao, setNewNotamsByIcao] = useState({});

  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(AUTO_REFRESH_INTERVAL_MS / 1000);
  const isAutoRefreshing = useRef(false);

  const stableShowNotification = useCallback(showNotification, []);

  // Main NOTAM fetching logic, passed to the batching system
  const handleFetchNotams = useCallback(async (icao) => {
    if (!activeSession) return { error: 'Session is not active' };
    
    const result = await fetchNotamsForIcao(icao);
    
    if (result?.error) {
      console.error(`Error fetching NOTAMs for ${icao}:`, result.error);
      setFailedIcaosSet(prev => new Set(prev).add(icao));
      stableShowNotification(`Failed to load NOTAMs for ${icao}.`, icao);
      return { error: result.error };
    }

    // On success, remove from failed set if it was there
    setFailedIcaosSet(prev => {
      if (!prev.has(icao)) return prev;
      const newSet = new Set(prev);
      newSet.delete(icao);
      return newSet;
    });

    const notams = result.data || [];
    
    setNotamDataByIcao(prev => {
      const comparison = compareNotamSets(icao, prev[icao], notams);
      if (comparison.added.length > 0) {
        const newNotamInfo = comparison.added.map(n => ({ id: n.id || n.number, timestamp: Date.now() }));
        setNewNotamsByIcao(p => ({ ...p, [icao]: [...(p[icao] || []), ...newNotamInfo] }));
        if (!isAutoRefreshing.current) {
          stableShowNotification(`${icao}: ${comparison.added.length} new NOTAM(s) detected!`, icao);
        }
      }
      
      if (!isAutoRefreshing.current && comparison.removed.length > 0) {
        stableShowNotification(`${icao}: ${comparison.removed.length} NOTAM(s) cancelled/expired.`, icao);
      }
      return { ...prev, [icao]: notams };
    });

    setLoadedIcaosSet(prev => new Set(prev).add(icao));
    
    return { data: notams };
  }, [activeSession, stableShowNotification]);

  const { icaoQueue, loadingIcaosSet, batchingActive, startBatching, setIcaoQueue } = useBatchingSystem({
    activeSession,
    onFetchNotams: handleFetchNotams,
  });

  // Effect for initial load from cache
  useEffect(() => {
    if (!isInitialized) return;
    
    console.log("Initializing data source...");
    const cached = getCachedNotamData();
    if (isCacheValid() && cached.notamData) {
      console.log("✅ Loading from valid cache.");
      setNotamDataByIcao(cached.notamData);
      const cachedIcaos = new Set(Object.keys(cached.notamData));
      setLoadedIcaosSet(cachedIcaos);
    } else {
      console.log("Cache is invalid or empty.");
      setNotamDataByIcao({});
      setLoadedIcaosSet(new Set());
      setFailedIcaosSet(new Set());
    }
  }, [isInitialized]);

  // Effect to queue ICAOs that are not loaded
  useEffect(() => {
    if (!isInitialized) return;
    const icaosToQueue = icaoSet.filter(icao => !loadedIcaosSet.has(icao) && !loadingIcaosSet.has(icao));
    if (icaosToQueue.length > 0) {
      startBatching(icaosToQueue);
    }
  }, [isInitialized, icaoSet, loadedIcaosSet, loadingIcaosSet, startBatching]);
  
  // Cache NOTAM data when it changes
  useEffect(() => {
    if (!isInitialized || Object.keys(notamDataByIcao).length === 0) return;
    setCachedNotamData({ notamData: notamDataByIcao, timestamp: Date.now() });
  }, [notamDataByIcao, isInitialized]);

  // Cleanup effect for old "new notam" indicators
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
  
  // Auto-refresh timer
  useEffect(() => {
    if (!activeSession || icaoSet.length === 0 || !isInitialized) return;

    const performAutoRefresh = () => {
      console.log('🔄 Performing auto-refresh...');
      isAutoRefreshing.current = true;
      const refreshIcaos = [...icaoSet].filter(icao => !loadingIcaosSet.has(icao));
      if (refreshIcaos.length > 0) {
        refreshIcaos.forEach(icao => handleFetchNotams(icao));
      }
      setTimeout(() => { isAutoRefreshing.current = false; }, 5000);
    };

    const refreshInterval = setInterval(performAutoRefresh, AUTO_REFRESH_INTERVAL_MS);
    const countdownInterval = setInterval(() => {
      setAutoRefreshCountdown(prev => (prev > 0 ? prev - 1 : AUTO_REFRESH_INTERVAL_MS / 1000));
    }, 1000);

    return () => {
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
  }, [activeSession, icaoSet, isInitialized, loadingIcaosSet, handleFetchNotams]);

  const handleReloadAll = () => {
    if (!icaoSet.length) return;
    console.log('🔄 Manual reload all triggered');
    setCachedNotamData(null); // Invalidate cache
    setNotamDataByIcao({});
    setLoadedIcaosSet(new Set());
    setFailedIcaosSet(new Set());
    setIcaoQueue([]); // Clear existing queue
    startBatching([...icaoSet]);
  };

  return {
    notamDataByIcao: { ...notamDataByIcao, newNotamsByIcao },
    loadingIcaosSet,
    loadedIcaosSet,
    failedIcaosSet,
    icaoQueue,
    batchingActive,
    autoRefreshCountdown,
    handleReloadAll,
  };
};
