import { useState, useCallback } from 'react';
import { UI_CONSTANTS } from '../constants';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [showNotificationModal, setShowNotificationModal] = useState(false);

  const showNotification = useCallback((text, icao = null) => {
    const newNotification = {
      id: Date.now(),
      text,
      icao,
      timestamp: new Date().toLocaleTimeString(),
      read: false
    };
    setNotifications(prev => [newNotification, ...prev.slice(0, UI_CONSTANTS.MAX_NOTIFICATIONS - 1)]);
  }, []);

  const onNotificationClick = (notification, setTabMode) => {
    if (notification.icao) {
      setTabMode(notification.icao);
    }
    setShowNotificationModal(false);
    setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read: true } : n));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const notificationCount = notifications.filter(n => !n.read).length;

  return {
    notifications,
    setNotifications,
    notificationCount,
    showNotification,
    showNotificationModal,
    setShowNotificationModal,
    onNotificationClick,
  };
};
