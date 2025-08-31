import { useState } from 'react';
import { DEFAULT_FILTERS } from '../constants';
import { useLocalStorage } from './useLocalStorage';

export const useUiState = () => {
  const [tabMode, setTabMode] = useState("ALL");
  const [expandedCardKey, setExpandedCardKey] = useState(null);
  
  // ICAO Sets functionality state
  const [showIcaoSetsModal, setShowIcaoSetsModal] = useState(false);
  const [newSetName, setNewSetName] = useState('');
  const [showSaveSetModal, setShowSaveSetModal] = useState(false);
  
  // Other Modal state
  const [showIcaoRawModal, setShowIcaoRawModal] = useState(false);
  
  // UI state
  const [icaoListExpanded, setIcaoListExpanded] = useState(true);
  const [cardScale, setCardScale] = useLocalStorage('notamCardScale', 1.0);
  
  // Filter state
  const [filters, setFilters] = useLocalStorage('notamFilters', DEFAULT_FILTERS);
  const [keywordFilter, setKeywordFilter] = useState('');

  return {
    tabMode, setTabMode,
    expandedCardKey, setExpandedCardKey,
    newSetName, setNewSetName,
    showIcaoSetsModal, setShowIcaoSetsModal,
    showSaveSetModal, setShowSaveSetModal,
    showIcaoRawModal, setShowIcaoRawModal,
    icaoListExpanded, setIcaoListExpanded,
    cardScale, setCardScale,
    filters, setFilters,
    keywordFilter, setKeywordFilter,
  };
};
