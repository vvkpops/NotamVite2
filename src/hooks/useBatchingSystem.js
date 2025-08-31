import { useState, useEffect, useRef, useCallback } from 'react';
import { BATCH_INTERVAL_MS, CALLS_PER_WINDOW, WINDOW_MS, MAX_RETRIES } from '../constants';

export const useBatchingSystem = ({ 
  activeSession, 
  onFetchNotams 
}) => {
  const [icaoQueue, setIcaoQueue] = useState([]);
  const [loadingIcaosSet, setLoadingIcaosSet] = useState(new Set());
  const [batchingActive, setBatchingActive] = useState(false);
  const [retryCounts, setRetryCounts] = useState({});

  const callTimestampsRef = useRef([]);
  const batchTimerRef = useRef(null);

  const stopBatching = useCallback(() => {
    setBatchingActive(false);
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    console.log('[Batching] Batch processing stopped.');
  }, []);

  const processIcaoBatch = useCallback(async () => {
    if (!activeSession) {
      stopBatching();
      return;
    }

    let nextIcao;
    setIcaoQueue(currentQueue => {
      if (currentQueue.length === 0) {
        nextIcao = null;
        return [];
      }
      nextIcao = currentQueue[0];
      return currentQueue.slice(1);
    });

    if (!nextIcao) {
      stopBatching();
      return;
    }
    
    // Rate limiting check
    const now = Date.now();
    callTimestampsRef.current = callTimestampsRef.current.filter(
      timestamp => now - timestamp < WINDOW_MS
    );

    if (callTimestampsRef.current.length >= CALLS_PER_WINDOW) {
      const oldestCall = callTimestampsRef.current[0];
      const waitTime = WINDOW_MS - (now - oldestCall) + 500;
      console.log(`[Batching] Rate limit active. Re-queueing ${nextIcao} and waiting for ${Math.ceil(waitTime / 1000)}s`);
      setIcaoQueue(prev => [nextIcao, ...prev]); // Put it back at the front
      batchTimerRef.current = setTimeout(processIcaoBatch, waitTime);
      return;
    }

    setLoadingIcaosSet(prev => new Set(prev).add(nextIcao));
    callTimestampsRef.current.push(now);

    try {
      const result = await onFetchNotams(nextIcao);
      if (result && result.error) {
        const currentRetryCount = retryCounts[nextIcao] || 0;
        if (currentRetryCount < MAX_RETRIES) {
          console.warn(`[Batching] Re-queueing ${nextIcao} (attempt ${currentRetryCount + 1}) due to error:`, result.error);
          setRetryCounts(prev => ({...prev, [nextIcao]: currentRetryCount + 1}));
          setIcaoQueue(prev => [...prev, nextIcao]); // Put it at the end to not block others
        } else {
          console.error(`[Batching] ICAO ${nextIcao} failed after ${MAX_RETRIES} attempts. Giving up.`);
          result.isFinalError = true; // Signal to parent hook this is a permanent failure
        }
      } else {
        // Clear retry count on success
        if (retryCounts[nextIcao]) {
          setRetryCounts(prev => {
            const newCounts = {...prev};
            delete newCounts[nextIcao];
            return newCounts;
          });
        }
      }
    } catch (error) {
      console.error(`[Batching] Critical error processing ${nextIcao}. Re-queueing.`, error);
      setIcaoQueue(prev => [...prev, nextIcao]);
    } finally {
      setLoadingIcaosSet(prev => {
        const newSet = new Set(prev);
        newSet.delete(nextIcao);
        return newSet;
      });
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      batchTimerRef.current = setTimeout(processIcaoBatch, BATCH_INTERVAL_MS);
    }
  }, [activeSession, onFetchNotams, stopBatching, retryCounts]);

  const startBatching = useCallback((queue) => {
    setIcaoQueue(queue);
    if (!batchingActive && queue.length > 0 && activeSession) {
      console.log('[Batching] Starting batch processing...');
      setBatchingActive(true);
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      batchTimerRef.current = setTimeout(processIcaoBatch, 0);
    }
  }, [batchingActive, activeSession, processIcaoBatch]);

  useEffect(() => {
    return () => {
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    };
  }, []);

  return {
    icaoQueue,
    loadingIcaosSet,
    batchingActive,
    startBatching,
    setIcaoQueue
  };
};
