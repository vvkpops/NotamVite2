import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { STORAGE_KEYS } from '../constants';

export const useIcaoManagement = ({ showNotification }) => {
  const [icaoSet, setIcaoSet] = useLocalStorage(STORAGE_KEYS.SAVED_ICAOS, []);
  const [icaoSets, setIcaoSets] = useLocalStorage(STORAGE_KEYS.ICAO_SETS, []);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    setIsInitialized(true);
  }, []);

  const handleIcaoSubmit = useCallback((newIcaos) => {
    if (newIcaos.length === 0) return;
    setIcaoSet(prevIcaos => [...new Set([...prevIcaos, ...newIcaos])]);
  }, [setIcaoSet]);

  const handleRemoveIcao = useCallback((icaoToRemove) => {
    setIcaoSet(prevIcaos => prevIcaos.filter(icao => icao !== icaoToRemove));
  }, [setIcaoSet]);

  const handleCreateSet = useCallback((name, currentIcaos) => {
    if (!name.trim() || currentIcaos.length === 0) return;
    const newSet = { name: name.trim(), icaos: currentIcaos, created: new Date().toISOString() };
    setIcaoSets(prevSets => [...prevSets, newSet]);
    showNotification(`ICAO Set "${name}" saved successfully!`);
  }, [setIcaoSets, showNotification]);

  const handleLoadSet = useCallback((icaosToLoad) => {
    if (!icaosToLoad || icaosToLoad.length === 0) return;
    setIcaoSet(icaosToLoad);
    const setName = icaoSets.find(s => s.icaos === icaosToLoad)?.name || 'set';
    showNotification(`Loaded ICAO set "${setName}"`);
  }, [setIcaoSet, icaoSets, showNotification]);

  const handleDeleteSet = useCallback((indexToDelete) => {
    const setToDelete = icaoSets[indexToDelete];
    setIcaoSets(prevSets => prevSets.filter((_, index) => index !== indexToDelete));
    if (setToDelete) {
      showNotification(`Deleted ICAO set "${setToDelete.name}"`);
    }
  }, [icaoSets, setIcaoSets, showNotification]);

  return {
    icaoSet,
    setIcaoSet,
    icaoSets,
    setIcaoSets,
    handleIcaoSubmit,
    handleRemoveIcao,
    handleCreateSet,
    handleLoadSet,
    handleDeleteSet,
    isInitialized
  };
};
