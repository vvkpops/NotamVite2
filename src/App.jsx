import React, { useEffect } from 'react';
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
import { IcaoRawModal, IcaoSetsModal, SaveSetModal } from './components/modal';

// Hooks
import { useSessionManagement } from './hooks/useSessionManagement';
import { useIcaoManagement } from './hooks/useIcaoManagement';
import { useNotamData } from './hooks/useNotamData';
import { useNotifications } from './hooks/useNotifications';
import { useUiState } from './hooks/useUiState';

function App() {
  const { activeSession } = useSessionManagement();

  const {
    notifications,
    notificationCount,
    showNotificationModal,
    setShowNotificationModal,
    setNotifications,
    onNotificationClick: handleNotificationClick,
    showNotification,
  } = useNotifications();

  const {
    icaoSet,
    setIcaoSet,
    icaoSets,
    setIcaoSets,
    handleIcaoSubmit,
    handleRemoveIcao,
    handleCreateSet,
    handleLoadSet,
    handleDeleteSet,
    isInitialized,
  } = useIcaoManagement({ showNotification });

  const {
    notamDataByIcao,
    loadingIcaosSet,
    loadedIcaosSet,
    failedIcaosSet,
    icaoQueue,
    batchingActive,
    autoRefreshCountdown,
    handleReloadAll,
  } = useNotamData({
    icaoSet,
    activeSession,
    isInitialized,
    showNotification,
  });

  const {
    tabMode, setTabMode,
    expandedCardKey, setExpandedCardKey,
    newSetName, setNewSetName,
    showIcaoSetsModal, setShowIcaoSetsModal,
    showSaveSetModal, setShowSaveSetModal,
    showIcaoRawModal, setShowIcaoRawModal,
    icaoListExpanded, setIcaoListExpanded,
    cardScale, setCardScale,
    filters, setFilters,
    keywordFilter, setKeywordFilter
  } = useUiState();

  // Effect to handle tab mode changes when ICAOs are removed
  useEffect(() => {
    if (!icaoSet.includes(tabMode) && tabMode !== "ALL") {
      setTabMode("ALL");
    }
  }, [icaoSet, tabMode, setTabMode]);
  
  // Handlers that connect different hooks/state
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

  const createAndCloseSetModal = () => {
    handleCreateSet(newSetName, icaoSet);
    setShowIcaoSetsModal(false);
    setNewSetName('');
  };

  const loadAndCloseSetModal = (icaosToLoad) => {
    handleLoadSet(icaosToLoad);
    setShowIcaoSetsModal(false);
  };

  if (!activeSession) {
    // Session management hook renders the inactive message
    return null;
  }

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
          onLoadSet={loadAndCloseSetModal}
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
          failedCount={failedIcaosSet.size}
          autoRefreshCountdown={autoRefreshCountdown}
          batchingActive={batchingActive}
        />

        <IcaoTabs
          icaoSet={icaoSet}
          tabMode={tabMode}
          onTabClick={setTabMode}
          notamDataByIcao={notamDataByIcao}
          newNotamsByIcao={notamDataByIcao.newNotamsByIcao || {}}
          failedIcaosSet={failedIcaosSet}
        />

        <NotamGrid
          tabMode={tabMode}
          notamDataByIcao={notamDataByIcao}
          filters={filters}
          keywordFilter={keywordFilter}
          expandedCardKey={expandedCardKey}
          cardScale={cardScale}
          onCardClick={(key) => setExpandedCardKey(prev => (prev === key ? null : key))}
          newNotamsByIcao={notamDataByIcao.newNotamsByIcao || {}}
        />
      </main>

      <BackToTopButton />
      
      <NotificationSystem
        notifications={notifications}
        notificationCount={notificationCount}
        showNotificationModal={showNotificationModal}
        setShowNotificationModal={setShowNotificationModal}
        setNotifications={setNotifications}
        onNotificationClick={(notification) => handleNotificationClick(notification, setTabMode)}
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
        onCreateSet={createAndCloseSetModal}
        onLoadSet={loadAndCloseSetModal}
        onDeleteSet={handleDeleteSet}
      />
    </div>
  );
}

export default App;
