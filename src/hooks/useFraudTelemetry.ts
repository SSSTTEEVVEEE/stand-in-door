import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  collectNavigatorFingerprint,
  collectCanvasWebGLFingerprint,
  collectSensorWebRTCFingerprint,
  collectStorageFeatureFingerprint,
  collectTimingPerformanceFingerprint,
  hashFingerprint,
} from '@/lib/deviceFingerprint';

// Obscured endpoint names to hide telemetry purpose
const REQUEST_ENDPOINTS = {
  navigator: '/api/v3/oauth/refresh-session',
  canvas: '/auth/sso/validate-token',
  sensors: '/oauth/passkey/challenge-response',
  storage: '/api/internal/metrics-sync',
  timing: '/auth/device/heartbeat-verify',
};

const REQUEST_NAMES = {
  navigator: 'xrf_session_renewal',
  canvas: 'tkn_validation_v2',
  sensors: 'pky_challenge_resp',
  storage: 'mtrc_sync_internal',
  timing: 'dev_heartbeat_v3',
};

// Anti-proxy fake endpoints for timing analysis
const ANTI_PROXY_ENDPOINTS = [
  '/api/oauth/token-refresh',
  '/auth/sso/callback',
  '/api/v2/session/validate',
  '/oauth/device/authorize',
  '/api/internal/health',
  '/auth/passkey/register',
  '/api/v3/user/preferences',
  '/oauth/mfa/challenge',
  '/api/metrics/pageview',
  '/auth/logout/confirm',
  '/api/v2/notifications/read',
  '/oauth/consent/approve',
  '/api/internal/feature-flags',
  '/auth/recovery/initiate',
  '/api/v3/profile/update',
  '/oauth/scope/validate',
  '/api/analytics/event',
  '/auth/session/extend',
  '/api/v2/permissions/check',
  '/oauth/client/credentials',
];

interface TelemetryState {
  navigator: Record<string, any> | null;
  canvas: Record<string, any> | null;
  sensors: Record<string, any> | null;
  storage: Record<string, any> | null;
  timing: Record<string, any> | null;
  integrityHashes: Record<string, string>;
  antiProxyResponses: Array<{ endpoint: string; duration: number; status: string }>;
  sessionId: string;
  trackingId: string;
  nonce: string | null;
}

export function useFraudTelemetry() {
  const [state, setState] = useState<TelemetryState>({
    navigator: null,
    canvas: null,
    sensors: null,
    storage: null,
    timing: null,
    integrityHashes: {},
    antiProxyResponses: [],
    sessionId: crypto.randomUUID(),
    trackingId: getOrCreateTrackingId(),
    nonce: null,
  });
  
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectionComplete, setCollectionComplete] = useState(false);
  const [trackingBlocked, setTrackingBlocked] = useState(false);
  const continuousMonitoringRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get or create persistent tracking ID
  function getOrCreateTrackingId(): string {
    const stored = localStorage.getItem('_tid');
    if (stored) return stored;
    const newId = crypto.randomUUID();
    localStorage.setItem('_tid', newId);
    return newId;
  }
  
  // Collect a single category
  const collectCategory = useCallback(async (
    category: keyof typeof REQUEST_ENDPOINTS,
    collector: () => Promise<Record<string, any>>
  ): Promise<{ data: Record<string, any>; hash: string }> => {
    const data = await collector();
    const hash = await hashFingerprint(data);
    return { data, hash };
  }, []);
  
  // Perform anti-proxy timing checks
  const performAntiProxyChecks = useCallback(async (): Promise<Array<{ endpoint: string; duration: number; status: string }>> => {
    const results: Array<{ endpoint: string; duration: number; status: string }> = [];
    
    for (const endpoint of ANTI_PROXY_ENDPOINTS) {
      const start = performance.now();
      try {
        // These are fake requests that should fail - we're measuring timing
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        await fetch(`https://api.galtsclaim.org${endpoint}`, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal,
        }).catch(() => {});
        
        clearTimeout(timeoutId);
        const duration = performance.now() - start;
        
        let status = 'normal';
        if (duration < 1) status = 'cached_or_blocked';
        else if (duration > 3000) status = 'slow_or_manual';
        
        results.push({ endpoint, duration, status });
      } catch {
        results.push({ endpoint, duration: -1, status: 'error' });
      }
    }
    
    return results;
  }, []);
  
  // Collect all fingerprint data with integrity verification
  const collectAll = useCallback(async (maxRetries = 3): Promise<boolean> => {
    setIsCollecting(true);
    setCollectionComplete(false);
    
    try {
      let retryCount = 0;
      let allValid = false;
      
      while (!allValid && retryCount < maxRetries) {
        // Collect all categories
        const [nav, canvas, sensors, storage, timing] = await Promise.all([
          collectCategory('navigator', collectNavigatorFingerprint),
          collectCategory('canvas', collectCanvasWebGLFingerprint),
          collectCategory('sensors', collectSensorWebRTCFingerprint),
          collectCategory('storage', collectStorageFeatureFingerprint),
          collectCategory('timing', collectTimingPerformanceFingerprint),
        ]);
        
        // Verify integrity (re-hash and compare)
        const verifyNav = await hashFingerprint(nav.data);
        const verifyCanvas = await hashFingerprint(canvas.data);
        const verifySensors = await hashFingerprint(sensors.data);
        const verifyStorage = await hashFingerprint(storage.data);
        
        allValid = 
          verifyNav === nav.hash &&
          verifyCanvas === canvas.hash &&
          verifySensors === sensors.hash &&
          verifyStorage === storage.hash;
        
        if (allValid) {
          // Perform anti-proxy checks
          const antiProxyResponses = await performAntiProxyChecks();
          
          setState(prev => ({
            ...prev,
            navigator: nav.data,
            canvas: canvas.data,
            sensors: sensors.data,
            storage: storage.data,
            timing: timing.data,
            integrityHashes: {
              navigator: nav.hash,
              canvas: canvas.hash,
              sensors: sensors.hash,
              storage: storage.hash,
              timing: timing.hash,
            },
            antiProxyResponses,
          }));
          
          setCollectionComplete(true);
          return true;
        }
        
        retryCount++;
      }
      
      // If we get here, data was tampered with
      setTrackingBlocked(true);
      return false;
    } catch (error) {
      console.error('Telemetry collection failed:', error);
      setTrackingBlocked(true);
      return false;
    } finally {
      setIsCollecting(false);
    }
  }, [collectCategory, performAntiProxyChecks]);
  
  // Send telemetry to edge function
  const sendTelemetry = useCallback(async (
    email: string,
    attemptType: 'login' | 'signup' | 'monitoring',
    continuousMonitoring = false
  ): Promise<{ success: boolean; verified: boolean; nextNonce?: string; continueTelemetry?: boolean }> => {
    try {
      const { data, error } = await supabase.functions.invoke('track-auth-attempt', {
        body: {
          email,
          attemptType,
          sessionId: state.sessionId,
          trackingId: state.trackingId,
          nonce: state.nonce,
          fingerprint: {
            navigator: state.navigator,
            canvas: state.canvas,
            sensors: state.sensors,
            storage: state.storage,
            timing: state.timing,
          },
          integrityHashes: state.integrityHashes,
          antiProxyResponses: state.antiProxyResponses,
          continuousMonitoring,
          navigatorData: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            platform: navigator.platform,
            cookieEnabled: navigator.cookieEnabled,
          },
        },
      });
      
      if (error) {
        console.error('Telemetry send failed:', error);
        setTrackingBlocked(true);
        return { success: false, verified: false };
      }
      
      // Store new nonce for next request
      if (data?.nextNonce) {
        setState(prev => ({ ...prev, nonce: data.nextNonce }));
      }
      
      // Handle continuous monitoring signal
      if (data?.continueTelemetry && !continuousMonitoringRef.current) {
        startContinuousMonitoring(email);
      }
      
      return {
        success: true,
        verified: data?.verified ?? true,
        nextNonce: data?.nextNonce,
        continueTelemetry: data?.continueTelemetry,
      };
    } catch (error) {
      console.error('Telemetry send error:', error);
      setTrackingBlocked(true);
      return { success: false, verified: false };
    }
  }, [state]);
  
  // Start continuous monitoring (30-second intervals)
  const startContinuousMonitoring = useCallback((email: string) => {
    if (continuousMonitoringRef.current) return;
    
    continuousMonitoringRef.current = setInterval(async () => {
      await collectAll(1);
      await sendTelemetry(email, 'monitoring', true);
    }, 30000);
  }, [collectAll, sendTelemetry]);
  
  // Stop continuous monitoring
  const stopContinuousMonitoring = useCallback(() => {
    if (continuousMonitoringRef.current) {
      clearInterval(continuousMonitoringRef.current);
      continuousMonitoringRef.current = null;
    }
  }, []);
  
  // Reset state for new auth attempt
  const reset = useCallback(() => {
    stopContinuousMonitoring();
    setState({
      navigator: null,
      canvas: null,
      sensors: null,
      storage: null,
      timing: null,
      integrityHashes: {},
      antiProxyResponses: [],
      sessionId: crypto.randomUUID(),
      trackingId: getOrCreateTrackingId(),
      nonce: null,
    });
    setCollectionComplete(false);
    setTrackingBlocked(false);
  }, [stopContinuousMonitoring]);
  
  // Check if collection is complete
  const isComplete = useCallback((): boolean => {
    return collectionComplete && 
      !!state.navigator && 
      !!state.canvas && 
      !!state.sensors && 
      !!state.storage && 
      !!state.timing;
  }, [collectionComplete, state]);
  
  return {
    collectAll,
    sendTelemetry,
    reset,
    isComplete,
    isCollecting,
    collectionComplete,
    trackingBlocked,
    sessionId: state.sessionId,
    startContinuousMonitoring,
    stopContinuousMonitoring,
  };
}
