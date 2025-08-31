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
  }, []);

  const processIcaoBatch = useCallback(async () => {
    if (!activeSession || icaoQueue.length === 0) {
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
      console.log(`[Batching] Rate limit active. Waiting for ${Math.ceil(waitTime / 1000)}s`);
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
      batchTimerRef.current = setTimeout(processIcaoBatch, waitTime);
      return;
    }

    const nextIcao = icaoQueue[0];
    
    // Dequeue immediately to prevent reprocessing
    setIcaoQueue(prev => prev.slice(1));

    if (!nextIcao || loadedIcaosSet.has(nextIcao) || loadingIcaosSet.has(nextIcao)) {
      // ICAO is already loaded, being loaded, or invalid. Process next one.
      if (icaoQueue.length > 1) { // Check original queue length - 1
         if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
         batchTimerRef.current = setTimeout(processIcaoBatch, 50); // Small delay to prevent tight loop
      } else {
        stopBatching();
      }
      return;
    }

    setLoadingIcaosSet(prev => new Set(prev).add(nextIcao));
    callTimestampsRef.current.push(now);

    try {
      const result = await onFetchNotams(nextIcao);
      if (result && result.error) {
        console.warn(`[Batching] Re-queueing ${nextIcao} due to error:`, result.error);
        // Add to the end of the queue to retry later
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
      // Schedule the next batch regardless of success or failure
      if (icaoQueue.length > 1) {
        if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
        batchTimerRef.current = setTimeout(processIcaoBatch, BATCH_INTERVAL_MS);
      } else {
        stopBatching();
      }
    }
  }, [
    activeSession, icaoQueue, loadedIcaosSet, loadingIcaosSet, 
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
