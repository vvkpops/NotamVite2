// Central export file for all hooks

// Session Management Hook - remains the same
import { useState, useEffect, useRef } from 'react';

export const useSessionManagement = () => {
  const [activeSession, setActiveSession] = useState(true);
  const bcRef = useRef(null);
  const sessionIdRef = useRef(Math.random().toString(36).substr(2, 9));

  useEffect(() => {
    const SESSION_CHANNEL = 'notamDashboardSession';
    
    const claimActiveSession = () => {
      try {
        if (window.BroadcastChannel) {
          if (!bcRef.current) {
            bcRef.current = new BroadcastChannel(SESSION_CHANNEL);
          }
          bcRef.current.postMessage({ type: 'new-session', sessionId: sessionIdRef.current });
        } else {
          localStorage.setItem(SESSION_CHANNEL, sessionIdRef.current);
        }
      } catch (e) {
        console.error('Failed to initialize session management:', e);
      }
    };
    
    const deactivateSession = () => {
      setActiveSession(false);
      // Display a message indicating the session is inactive
      const inactiveMessage = `
        <div style="padding: 40px; text-align:center; font-size:1.5em; color:#93c5fd; background:#1e293b; height:100vh; display:flex; flex-direction:column; justify-content:center; align-items:center;">
            <h1 style="color:#ef4444; margin-bottom:20px;">Session Inactive</h1>
            <p style="font-size:1rem; color:#94a3b8;">Another NOTAM Dashboard tab has become the active session.</p>
            <p style="font-size:1rem; color:#94a3b8;">Please close this tab or the other one to continue.</p>
        </div>`;
      try {
        document.body.innerHTML = inactiveMessage;
      } catch {
        // Fallback for environments where document.body is not writable
      }
    };
    
    if (window.BroadcastChannel) {
      bcRef.current = new BroadcastChannel(SESSION_CHANNEL);
      bcRef.current.onmessage = (event) => {
        if (event.data?.type === 'new-session' && event.data.sessionId !== sessionIdRef.current) {
          deactivateSession();
        }
      };
    } else {
      const handleStorage = (event) => {
        if (event.key === SESSION_CHANNEL && event.newValue !== sessionIdRef.current) {
          deactivateSession();
        }
      };
      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
    }
    
    claimActiveSession();

    return () => {
      if (bcRef.current) {
        bcRef.current.close();
      }
    };
  }, []);

  return { activeSession };
};

// Export other hooks from their files
export { useBatchingSystem } from './useBatchingSystem';
export { useLocalStorage } from './useLocalStorage';
export { useScrollToTop } from './useScrollToTop';
export { useClickOutside } from './useClickOutside';
