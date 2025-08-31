import { useState, useEffect, useRef, useCallback } from 'react';
import { BATCH_INTERVAL_MS, CALLS_PER_WINDOW, WINDOW_MS } from '../constants';

export const useBatchingSystem = ({ 
  activeSession, 
  loadedIcaosSet, 
  loadingIcaosSet, 
  setLoadingIcaosSet, 
  onFetchNotams 
}) => {
  const [icaoQueue, setIcaoQueue] = useState([]);
  const [batchingActive, setBatchingActive] = useState(false);
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

    // Use a function to get the next ICAO from the queue to avoid stale closures
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
      const waitTime = WINDOW_MS - (now - oldestCall) + 500; // Add a small buffer
      console.log(`[Batching] Rate limit active. Re-queueing ${nextIcao} and waiting for ${Math.ceil(waitTime / 1000)}s`);
      setIcaoQueue(prev => [...prev, nextIcao]); // Put it back at the end
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      batchTimerRef.current = setTimeout(processIcaoBatch, waitTime);
      return;
    }

    if (loadedIcaosSet.has(nextIcao) || loadingIcaosSet.has(nextIcao)) {
      console.log(`[Batching] Skipping already loaded/loading ICAO: ${nextIcao}`);
      // Immediately process the next item in the queue if it exists
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      batchTimerRef.current = setTimeout(processIcaoBatch, 50);
      return;
    }

    setLoadingIcaosSet(prev => new Set(prev).add(nextIcao));
    callTimestampsRef.current.push(now);

    try {
      const result = await onFetchNotams(nextIcao);
      if (result && result.error) {
        console.warn(`[Batching] Re-queueing ${nextIcao} due to error:`, result.error);
        setIcaoQueue(prev => [...prev, nextIcao]);
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
      // Always schedule the next attempt
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      batchTimerRef.current = setTimeout(processIcaoBatch, BATCH_INTERVAL_MS);
    }
  }, [
    activeSession, loadedIcaosSet, loadingIcaosSet, 
    onFetchNotams, stopBatching, setLoadingIcaosSet
  ]);

  const startBatching = useCallback(() => {
    if (!batchingActive && icaoQueue.length > 0 && activeSession) {
      console.log('[Batching] Starting batch processing...');
      setBatchingActive(true);
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      batchTimerRef.current = setTimeout(processIcaoBatch, 0);
    }
  }, [batchingActive, icaoQueue.length, activeSession, processIcaoBatch]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    };
  }, []);

  return {
    icaoQueue,
    setIcaoQueue,
    batchingActive,
    startBatching,
  };
};
