import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

// Components
import Header from './components/Header';
import IcaoInput from './components/IcaoInput';
import IcaoSetsBar from './components/IcaoSetsBar';
import FilterBar from './components/FilterBar';
import IcaoTabs from './components/IcaoTabs';
import NotamGrid from './components/NotamGrid';
import ProgressBar from './components/ProgressBar';
import BackToTopButton from './components/BackToTopButton';
import NotificationSystem from './components/NotificationSystem';

// Modals
import { IcaoRawModal, IcaoSetsModal, SaveSetModal } from './components/modal';

// Services and Utils
import { fetchNotamsForIcao } from './services/notamService';
import { 
  getIcaoSets, 
  saveIcaoSets, 
  getSavedIcaos, 
  saveIcaos,
  getCachedNotamData,
  setCachedNotamData 
} from './utils/storageUtils';
import { 
  compareNotamSets
} from './utils/notamUtils';

// Hooks
import { useSessionManagement, useBatchingSystem } from './hooks';

import { 
  DEFAULT_FILTERS,
  AUTO_REFRESH_INTERVAL_MS,
  NEW_NOTAM_HIGHLIGHT_DURATION_MS
} from './constants';

function App() {
  // Core state
  const [icaoSet, setIcaoSet] = useState([]);
  const [notamDataByIcao, setNotamDataByIcao] = useState({});
  const [loadedIcaosSet, setLoadedIcaosSet] = useState(new Set());
  const [loadingIcaosSet, setLoadingIcaosSet] = useState(new Set());
  const [tabMode, setTabMode] = useState("ALL");
  const [expandedCardKey, setExpandedCardKey] = useState(null);
  
  // New NOTAM notification state
  const [newNotamsByIcao, setNewNotamsByIcao] = useState({});
  
  // ICAO Sets functionality
  const [icaoSets, setIcaoSets] = useState([]);
  const [showIcaoSetsModal, setShowIcaoSetsModal] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [showSaveSetModal, setShowSaveSetModal] = useState(false);
  
  // Modal state
  const [showIcaoRawModal, setShowIcaoRawModal] = useState(false);
  
  // UI state
  const [notifications, setNotifications] = useState([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [icaoListExpanded, setIcaoListExpanded] = useState(true);
  const [cardScale, setCardScale] = useState(1.0);
  const [autoRefreshCountdown, setAutoRefreshCountdown] = useState(AUTO_REFRESH_INTERVAL_MS / 1000);
  
  // Filter state
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [keywordFilter, setKeywordFilter] = useState('');

  // Session management and batching
  const { activeSession } = useSessionManagement();

  const showNotification = useCallback((text, icao) => {
    const newNotification = {
      id: Date.now(),
      text,
      icao,
      timestamp: new Date().toLocaleTimeString(),
      read: false
    };
    setNotifications(prev => [newNotification, ...prev.slice(0, 9)]);
  }, []);

  // Main NOTAM fetching logic
  const handleFetchNotams = useCallback(async (icao, isAutoRefresh = false) => {
    if (!activeSession) return { error: true };
    
    try {
      const result = await fetchNotamsForIcao(icao);
      
      if (result?.error) {
        console.error(`Error fetching NOTAMs for ${icao}:`, result.error);
        return { error: result.error };
      }
      
      const notams = Array.isArray(result) ? result : [];
      const previousNotams = notamDataByIcao[icao] || [];
      const comparison = compareNotamSets(icao, previousNotams, notams);
      
      if (comparison.added.length > 0) {
        const newNotamInfo = comparison.added.map(notam => ({
          id: notam.id || notam.number,
          timestamp: Date.now()
        }));

        setNewNotamsByIcao(prev => ({
          ...prev,
          [icao]: [...(prev[icao] || []), ...newNotamInfo]
        }));
        
        if (!isAutoRefresh) {
            showNotification(`${icao}: ${comparison.added.length} new NOTAM(s) detected!`, icao);
        }
      }
      
      if (!isAutoRefresh && comparison.removed.length > 0) {
        showNotification(`${icao}: ${comparison.removed.length} NOTAM(s) cancelled/expired.`, icao);
      }
      
      setNotamDataByIcao(prev => ({ ...prev, [icao]: notams }));
      setLoadedIcaosSet(prev => new Set(prev).add(icao));
      
      return notams;
    } catch (error) {
      console.error(`Unhandled error fetching for ${icao}:`, error);
      return { error: error.message };
    }
  }, [activeSession, notamDataByIcao, showNotification]);

  const { 
    icaoQueue, 
    setIcaoQueue,
    batchingActive, 
    startBatching,
  } = useBatchingSystem({
    activeSession,
    loadedIcaosSet,
    loadingIcaosSet,
    setLoadingIcaosSet,
    onFetchNotams: handleFetchNotams
  });

  // Effect for auto-refresh
  useEffect(() => {
    if (!activeSession || icaoSet.length === 0) return;
    
    const performAutoRefresh = () => {
      console.log('🔄 Performing auto-refresh...');
      const refreshIcaos = [...loadedIcaosSet].filter(icao => icaoSet.includes(icao) && !loadingIcaosSet.has(icao));
      
      if (refreshIcaos.length > 0) {
        refreshIcaos.forEach(icao => handleFetchNotams(icao, true));
      }
    };
    
    const refreshInterval = setInterval(performAutoRefresh, AUTO_REFRESH_INTERVAL_MS);
    const countdownInterval = setInterval(() => {
      setAutoRefreshCountdown(prev => (prev > 0 ? prev - 1 : AUTO_REFRESH_INTERVAL_MS / 1000));
    }, 1000);
    
    return () => {
      clearInterval(refreshInterval);
      clearInterval(countdownInterval);
    };
  }, [activeSession, icaoSet, loadedIcaosSet, loadingIcaosSet, handleFetchNotams]);

  // Cleanup effect for old "new" notam indicators
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setNewNotamsByIcao(prev => {
        const cleaned = {};
        Object.entries(prev).forEach(([icao, notams]) => {
          const freshNotams = notams.filter(n => now - n.timestamp < NEW_NOTAM_HIGHLIGHT_DURATION_MS);
          if (freshNotams.length > 0) {
            cleaned[icao] = freshNotams;
          }
        });
        return cleaned;
      });
    }, 10000); // Run every 10 seconds
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // ICAO Sets Management
  const handleCreateSet = () => {
    if (!newSetName.trim() || icaoSet.length === 0) return;
    const newSet = { name: newSetName.trim(), icaos: icaoSet, created: new Date().toISOString() };
    const updatedSets = [...icaoSets, newSet];
    setIcaoSets(updatedSets);
    saveIcaoSets(updatedSets);
    setNewSetName('');
    setShowIcaoSetsModal(false);
  };

  const handleLoadSet = (icaosToLoad) => {
    if (!icaosToLoad || icaosToLoad.length === 0) return;
    setIcaoSet(icaosToLoad);
    saveIcaos(icaosToLoad);
    setNotamDataByIcao({});
    setLoadedIcaosSet(new Set());
    setIcaoQueue(icaosToLoad);
    setShowIcaoSetsModal(false);
  };
  
  const handleDeleteSet = (indexToDelete) => {
      const updatedSets = icaoSets.filter((_, index) => index !== indexToDelete);
      setIcaoSets(updatedSets);
      saveIcaoSets(updatedSets);
  };

  const handleNewSetClick = () => {
    if (icaoSet.length > 0) {
      setShowSaveSetModal(true);
    }
  };
  
  const handleSaveSetModalClose = (shouldSave) => {
    setShowSaveSetModal(false);
    if (shouldSave) {
        setShowIcaoSetsModal(true);
    }
  };

  // Event handlers
  const handleIcaoSubmit = (newIcaos) => {
    if (newIcaos.length === 0) return;
    const updatedIcaos = [...new Set([...icaoSet, ...newIcaos])];
    setIcaoSet(updatedIcaos);
    saveIcaos(updatedIcaos);
    setIcaoQueue(prev => [...prev, ...newIcaos.filter(icao => !icaoSet.includes(icao))]);
  };

  const handleRemoveIcao = (icaoToRemove) => {
    const updatedIcaos = icaoSet.filter(icao => icao !== icaoToRemove);
    setIcaoSet(updatedIcaos);
    saveIcaos(updatedIcaos);
    // Clean up associated state
    const newNotamData = { ...notamDataByIcao };
    delete newNotamData[icaoToRemove];
    setNotamDataByIcao(newNotamData);
    
    const newLoaded = new Set(loadedIcaosSet);
    newLoaded.delete(icaoToRemove);
    setLoadedIcaosSet(newLoaded);
  };

  const handleReloadAll = () => {
    if (!icaoSet.length) return;
    console.log('🔄 Manual reload all triggered');
    setCachedNotamData({}); // Invalidate cache
    setNotamDataByIcao({});
    setLoadedIcaosSet(new Set());
    setIcaoQueue([...icaoSet]);
  };

  const handleCardClick = (cardKey) => {
    setExpandedCardKey(prev => prev === cardKey ? null : cardKey);
  };

  const handleNotificationClick = (notification) => {
    if (notification.icao) {
        setTabMode(notification.icao);
    }
    setShowNotificationModal(false);
    setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load saved data on mount
  useEffect(() => {
    try {
      const savedIcaos = getSavedIcaos();
      const savedSets = getIcaoSets();
      const cachedData = getCachedNotamData();
      
      setIcaoSets(Array.isArray(savedSets) ? savedSets : []);
      
      if (savedIcaos.length > 0) {
        setIcaoSet(savedIcaos);
        if (cachedData.notamData && Object.keys(cachedData.notamData).length > 0 && (Date.now() - (cachedData.timestamp || 0) < AUTO_REFRESH_INTERVAL_MS)) {
          setNotamDataByIcao(cachedData.notamData);
          const cachedIcaos = Object.keys(cachedData.notamData);
          setLoadedIcaosSet(new Set(cachedIcaos));
          const icaosToQueue = savedIcaos.filter(icao => !cachedIcaos.includes(icao));
          if (icaosToQueue.length > 0) setIcaoQueue(icaosToQueue);
        } else {
          setIcaoQueue(savedIcaos);
        }
      }
    } catch (e) {
      console.error('Failed to load saved data:', e);
    }
  }, [setIcaoQueue]);

  // Cache NOTAM data when it changes
  useEffect(() => {
    if (Object.keys(notamDataByIcao).length > 0) {
      setCachedNotamData({
        notamData: notamDataByIcao,
        timestamp: Date.now()
      });
    }
  }, [notamDataByIcao]);

  // Start batching when queue changes
  useEffect(() => {
    if (icaoQueue.length > 0 && !batchingActive && activeSession) {
      startBatching();
    }
  }, [icaoQueue.length, batchingActive, activeSession, startBatching]);

  if (!activeSession) {
    return null; // The session management hook will render the inactive message
  }

  const notificationCount = notifications.filter(n => !n.read).length;

  return (
    <div className="App">
      <Header />
      
      <main className="container mx-auto p-4">
        <IcaoInput
          icaoSet={icaoSet}
          setIcaoListExpanded={setIcaoListExpanded}
          icaoListExpanded={icaoListExpanded}
          onSubmit={handleIcaoSubmit}
          onRemoveIcao={handleRemoveIcao}
        />

        <IcaoSetsBar
          icaoSets={icaoSets}
          onShowSetsModal={() => setShowIcaoSetsModal(true)}
          onNewSetClick={handleNewSetClick}
          onLoadSet={handleLoadSet}
          icaoSet={icaoSet}
        />

        <FilterBar
          filters={filters}
          onFilterChange={(key) => setFilters(prev => ({ ...prev, [key]: !prev[key] }))}
          keywordFilter={keywordFilter}
          setKeywordFilter={setKeywordFilter}
          cardScale={cardScale}
          setCardScale={setCardScale}
          onReloadAll={handleReloadAll}
          onShowRaw={() => setShowIcaoRawModal(true)}
          tabMode={tabMode}
          notamDataByIcao={notamDataByIcao}
        />

        <ProgressBar
          loadedCount={loadedIcaosSet.size}
          totalIcaos={icaoSet.length}
          loadingCount={loadingIcaosSet.size}
          queuedCount={icaoQueue.length}
          autoRefreshCountdown={autoRefreshCountdown}
          batchingActive={batchingActive}
        />

        <IcaoTabs
          icaoSet={icaoSet}
          tabMode={tabMode}
          onTabClick={setTabMode}
          notamDataByIcao={notamDataByIcao}
          newNotamsByIcao={newNotamsByIcao}
        />

        <NotamGrid
          tabMode={tabMode}
          notamDataByIcao={notamDataByIcao}
          filters={filters}
          keywordFilter={keywordFilter}
          expandedCardKey={expandedCardKey}
          cardScale={cardScale}
          onCardClick={handleCardClick}
          newNotamsByIcao={newNotamsByIcao}
        />
      </main>

      <BackToTopButton />
      
      <NotificationSystem
        notifications={notifications}
        notificationCount={notificationCount}
        showNotificationModal={showNotificationModal}
        setShowNotificationModal={setShowNotificationModal}
        setNotifications={setNotifications}
        onNotificationClick={handleNotificationClick}
      />

      {/* Modals */}
      <IcaoRawModal
        show={showIcaoRawModal}
        tabMode={tabMode}
        notamDataByIcao={notamDataByIcao}
        onClose={() => setShowIcaoRawModal(false)}
      />

      <SaveSetModal
        show={showSaveSetModal}
        onClose={() => setShowSaveSetModal(false)}
        onSave={handleSaveSetModalClose}
      />

      <IcaoSetsModal
        show={showIcaoSetsModal}
        onClose={() => setShowIcaoSetsModal(false)}
        icaoSets={icaoSets}
        newSetName={newSetName}
        setNewSetName={setNewSetName}
        icaoSet={icaoSet}
        onCreateSet={handleCreateSet}
        onLoadSet={handleLoadSet}
        onDeleteSet={handleDeleteSet}
      />
    </div>
  );
}

export default App;
