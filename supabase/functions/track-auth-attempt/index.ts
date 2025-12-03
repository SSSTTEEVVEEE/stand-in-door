import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

// CORS Configuration - Only allow specific origins
const ALLOWED_ORIGIN_PATTERN = /^https:\/\/([a-zA-Z0-9-]+\.)*galtsclaim\.org$/;
const DEV_PREVIEW_ORIGIN = 'https://id-preview--ab304a78-53de-4ee9-96fa-4a260e51c65c.lovable.app';

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERN.test(origin) || origin === DEV_PREVIEW_ORIGIN;
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 10;
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(identifier);
  
  if (!record || now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(identifier, { count: 1, windowStart: now });
    return false;
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) return true;
  record.count++;
  return false;
}

function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now - record.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitStore.delete(key);
    }
  }
}

// Nonce management (in-memory, resets on cold start)
const nonceStore = new Map<string, { sessionId: string; createdAt: number }>();
const NONCE_VALIDITY_MS = 10000; // 10 seconds

function generateNonce(): string {
  return crypto.randomUUID();
}

function validateNonce(nonce: string | null, sessionId: string): boolean {
  if (!nonce) return true; // First request doesn't have nonce
  
  const stored = nonceStore.get(nonce);
  if (!stored) return false;
  
  const now = Date.now();
  const isValid = stored.sessionId === sessionId && (now - stored.createdAt) < NONCE_VALIDITY_MS;
  
  nonceStore.delete(nonce); // Single use
  return isValid;
}

function storeNonce(nonce: string, sessionId: string) {
  nonceStore.set(nonce, { sessionId, createdAt: Date.now() });
  
  // Cleanup old nonces
  const now = Date.now();
  for (const [key, data] of nonceStore.entries()) {
    if (now - data.createdAt > NONCE_VALIDITY_MS * 2) {
      nonceStore.delete(key);
    }
  }
}

// Session tracking for fraud detection
const sessionTracker = new Map<string, { attempts: number; lastAttempt: number }>();
const trackingIdTracker = new Map<string, { sessions: Set<string>; firstSeen: number }>();

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

// Anti-proxy detection: check response timing patterns
function analyzeAntiProxyResponses(responses: Array<{ endpoint: string; duration: number; status: string }>): {
  proxyDetected: boolean;
  anomalyRate: number;
  reasons: string[];
} {
  if (!responses || responses.length === 0) {
    return { proxyDetected: false, anomalyRate: 0, reasons: [] };
  }
  
  const reasons: string[] = [];
  let anomalies = 0;
  
  for (const resp of responses) {
    if (resp.status === 'cached_or_blocked') {
      anomalies++;
      reasons.push(`${resp.endpoint}: cached/blocked (${resp.duration}ms)`);
    } else if (resp.status === 'slow_or_manual') {
      anomalies++;
      reasons.push(`${resp.endpoint}: slow/manual (${resp.duration}ms)`);
    }
  }
  
  const anomalyRate = anomalies / responses.length;
  const proxyDetected = anomalyRate > 0.4; // >40% anomalous = proxy likely
  
  return { proxyDetected, anomalyRate, reasons };
}

// Compute risk score from fingerprint data
function computeRiskScore(payload: any): { score: number; factors: string[] } {
  let score = 0;
  const factors: string[] = [];
  
  // Check for missing fingerprint data
  if (!payload.fingerprint?.navigator) {
    score += 20;
    factors.push('Missing navigator fingerprint');
  }
  if (!payload.fingerprint?.canvas) {
    score += 15;
    factors.push('Missing canvas fingerprint');
  }
  if (!payload.fingerprint?.sensors) {
    score += 10;
    factors.push('Missing sensor fingerprint');
  }
  
  // Check integrity hashes
  if (!payload.integrityHashes || Object.keys(payload.integrityHashes).length < 3) {
    score += 25;
    factors.push('Missing or incomplete integrity hashes');
  }
  
  // Check for suspicious navigator data
  const nav = payload.fingerprint?.navigator;
  if (nav) {
    if (!nav.userAgent || nav.userAgent === 'unknown') {
      score += 15;
      factors.push('Missing user agent');
    }
    if (nav.hardwareConcurrency === 0 || nav.hardwareConcurrency > 128) {
      score += 10;
      factors.push('Suspicious hardware concurrency');
    }
    if (nav.plugins?.length === 0 && !nav.userAgent?.includes('Mobile')) {
      score += 5;
      factors.push('No plugins detected on desktop');
    }
  }
  
  // Check WebGL data
  const webgl = payload.fingerprint?.canvas?.webgl;
  if (!webgl?.vendor || !webgl?.renderer) {
    score += 10;
    factors.push('Missing WebGL vendor/renderer');
  }
  
  return { score, factors };
}

// Hash IP for storage (privacy)
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`ip-hash-salt:${ip}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
}

interface AuthAttemptPayload {
  email: string;
  attemptType: 'login' | 'signup' | 'monitoring';
  sessionId: string;
  trackingId: string;
  nonce: string | null;
  fingerprint?: {
    navigator?: any;
    canvas?: any;
    sensors?: any;
    storage?: any;
    timing?: any;
  };
  integrityHashes?: Record<string, string>;
  antiProxyResponses?: Array<{ endpoint: string; duration: number; status: string }>;
  continuousMonitoring?: boolean;
  navigatorData?: any;
  reason?: string; // Legacy support
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Reject requests from disallowed origins
  if (!isAllowedOrigin(origin)) {
    console.warn(`[track-auth-attempt] Rejected origin: ${origin}`);
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Get IP for rate limiting and logging
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const ipAddress = forwardedFor?.split(',')[0] || realIp || 'unknown';

  if (isRateLimited(ipAddress)) {
    console.warn(`[track-auth-attempt] Rate limited: ${ipAddress}`);
    return new Response(
      JSON.stringify({ error: 'Too many requests' }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': '60' } }
    );
  }

  if (Math.random() < 0.1) cleanupRateLimitStore();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const payload: AuthAttemptPayload = await req.json();
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const ipHash = await hashIP(ipAddress);

    // Validate required fields
    if (!payload.email) {
      return new Response(
        JSON.stringify({ error: 'Missing email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Legacy support: if reason is provided, use old flow
    if (payload.reason) {
      await supabase.from('failed_auth_attempts').insert({
        email: payload.email.toLowerCase().trim(),
        reason: payload.reason.substring(0, 500),
        ip_address: ipAddress,
        user_agent: userAgent,
        navigator_data: payload.navigatorData || null,
      });
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // New comprehensive fraud detection flow
    const sessionId = payload.sessionId || crypto.randomUUID();
    const trackingId = payload.trackingId || 'unknown';
    const attemptType = payload.attemptType || 'login';

    // Validate nonce if provided
    const nonceValid = validateNonce(payload.nonce, sessionId);
    
    // Track session attempts
    const sessionData = sessionTracker.get(sessionId) || { attempts: 0, lastAttempt: 0 };
    sessionData.attempts++;
    sessionData.lastAttempt = Date.now();
    sessionTracker.set(sessionId, sessionData);

    // Track by tracking ID (cookie-based)
    let trackingData = trackingIdTracker.get(trackingId);
    if (!trackingData) {
      trackingData = { sessions: new Set(), firstSeen: Date.now() };
      trackingIdTracker.set(trackingId, trackingData);
    }
    trackingData.sessions.add(sessionId);

    // Analyze anti-proxy responses
    const proxyAnalysis = analyzeAntiProxyResponses(payload.antiProxyResponses || []);

    // Compute behavioral risk score
    const riskAnalysis = computeRiskScore(payload);

    // Determine if we should log this attempt
    const shouldLog = 
      sessionData.attempts >= 2 || // Multiple attempts from same session
      (trackingData.sessions.size > 1 && Date.now() - trackingData.firstSeen < 45000) || // Multiple sessions quickly
      proxyAnalysis.proxyDetected ||
      !nonceValid ||
      riskAnalysis.score >= 50 ||
      payload.continuousMonitoring;

    if (shouldLog) {
      // Build comprehensive user_info object
      const userInfo = {
        fingerprint: payload.fingerprint || {},
        integrityHashes: payload.integrityHashes || {},
        antiProxyAnalysis: proxyAnalysis,
        riskAnalysis,
        nonceValid,
        sessionAttempts: sessionData.attempts,
        trackingSessions: trackingData.sessions.size,
        navigatorData: payload.navigatorData,
        ipHash,
        userAgent,
        continuousMonitoring: payload.continuousMonitoring,
      };

      // Insert into auth_attempts table (triggers audit log automatically)
      const { error: insertError } = await supabase.from('auth_attempts').insert({
        email: payload.email.toLowerCase().trim(),
        attempt_type: attemptType,
        success: false,
        session_id: sessionId,
        user_info: userInfo,
      });

      if (insertError) {
        console.error('[track-auth-attempt] Insert error:', insertError);
      }

      // Also insert into legacy table for backwards compatibility
      await supabase.from('failed_auth_attempts').insert({
        email: payload.email.toLowerCase().trim(),
        reason: `${attemptType}: risk=${riskAnalysis.score}, proxy=${proxyAnalysis.proxyDetected}`,
        ip_address: ipAddress,
        user_agent: userAgent,
        navigator_data: { ...payload.navigatorData, sessionId, trackingId },
      });
    }

    // Store timing data for calibration (anonymous)
    if (payload.antiProxyResponses?.length) {
      const connection = payload.fingerprint?.navigator?.connection;
      for (const resp of payload.antiProxyResponses.slice(0, 5)) {
        await supabase.from('response_timing_data').insert({
          response_duration_ms: Math.round(resp.duration),
          request_type: 'anti_proxy',
          endpoint_category: 'auth',
          http_status: resp.status === 'normal' ? 200 : 0,
          connection_type: connection?.type,
          effective_type: connection?.effectiveType,
          downlink_estimate: connection?.downlink,
          rtt_estimate: connection?.rtt,
          is_anomalous: resp.status !== 'normal',
          anomaly_reason: resp.status !== 'normal' ? resp.status : null,
        });
      }
    }

    // Generate next nonce
    const nextNonce = generateNonce();
    storeNonce(nextNonce, sessionId);

    // Determine if continuous monitoring should continue
    const continueTelemetry = 
      proxyAnalysis.proxyDetected || 
      riskAnalysis.score >= 50 || 
      sessionData.attempts >= 3;

    return new Response(
      JSON.stringify({
        success: true,
        verified: !proxyAnalysis.proxyDetected && nonceValid && riskAnalysis.score < 50,
        nextNonce,
        continueTelemetry,
        challengeEndpoints: proxyAnalysis.proxyDetected ? payload.antiProxyResponses?.slice(0, 5) : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[track-auth-attempt] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
