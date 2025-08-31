import { useState, useEffect, useRef, useCallback } from 'react';
import { BATCH_SIZE, BATCH_INTERVAL_MS, CALLS_PER_WINDOW, WINDOW_MS } from '../constants';

export const useBatchingSystem = ({ 
  activeSession, 
  loadedIcaosSet, 
  loadingIcaosSet, 
  setLoadingIcaosSet, 
  onFetchNotams 
}) => {
  const [icaoQueue, setIcaoQueue] = useState([]);
  const [batchingActive, setBatchingActive] = useState(false);
  const [callCount, setCallCount] = useState(0);
  const [windowStart, setWindowStart] = useState(Date.now());
  const batchTimerRef = useRef(null);

  const stopBatching = useCallback(() => {
    setBatchingActive(false);
    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
  }, []);

  const scheduleNextBatch = useCallback((delay = BATCH_INTERVAL_MS) => {
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = setTimeout(() => processIcaoBatch(), delay);
  }, [processIcaoBatch]);

  const processIcaoBatch = useCallback(async () => {
    if (!activeSession || icaoQueue.length === 0) {
      stopBatching();
      return;
    }

    const now = Date.now();
    if (now - windowStart > WINDOW_MS) {
      setWindowStart(now);
      setCallCount(0);
    }

    if (callCount >= CALLS_PER_WINDOW) {
      const waitTime = windowStart + WINDOW_MS - now + 1000;
      console.log(`Rate limit reached, waiting ${Math.ceil(waitTime / 1000)}s`);
      scheduleNextBatch(waitTime);
      return;
    }

    const nextIcao = icaoQueue[0];
    if (!nextIcao || loadedIcaosSet.has(nextIcao) || loadingIcaosSet.has(nextIcao)) {
        // This ICAO is already loaded or is being loaded, remove it from queue and continue
        setIcaoQueue(prev => prev.slice(1));
        scheduleNextBatch(10); // Check next in queue quickly
        return;
    }

    setLoadingIcaosSet(prev => new Set(prev).add(nextIcao));
    setIcaoQueue(prev => prev.slice(1)); // Dequeue
    setCallCount(prev => prev + 1);

    try {
      const result = await onFetchNotams(nextIcao);
      if (result && result.error) {
        console.warn(`Re-queueing ${nextIcao} due to error:`, result.error);
        setIcaoQueue(prev => [...prev, nextIcao]); // Re-queue on failure
      }
    } catch (error) {
      console.error(`Error processing ${nextIcao}:`, error);
      setIcaoQueue(prev => [...prev, nextIcao]); // Re-queue on critical failure
    } finally {
      setLoadingIcaosSet(prev => {
        const newSet = new Set(prev);
        newSet.delete(nextIcao);
        return newSet;
      });
    }

    if (icaoQueue.length > 1) { // Check length before dequeue
      scheduleNextBatch();
    } else {
      stopBatching();
    }
  }, [
    activeSession, icaoQueue, loadedIcaosSet, loadingIcaosSet, 
    callCount, windowStart, onFetchNotams, stopBatching, 
    scheduleNextBatch, setLoadingIcaosSet
  ]);

  const startBatching = useCallback(() => {
    if (!batchingActive && icaoQueue.length > 0 && activeSession) {
      setBatchingActive(true);
      scheduleNextBatch(0);
    }
  }, [batchingActive, icaoQueue.length, activeSession, scheduleNextBatch]);

  useEffect(() => {
    return () => {
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    };
  }, []);

  return {
    icaoQueue,
    setIcaoQueue,
    batchingActive,
    startBatching,
    stopBatching,
  };
};
