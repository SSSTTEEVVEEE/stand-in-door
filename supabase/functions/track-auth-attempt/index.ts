import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

// Pattern to match galtsclaim.org and any subdomain (HTTPS only)
const ALLOWED_ORIGIN_PATTERN = /^https:\/\/([a-zA-Z0-9-]+\.)*galtsclaim\.org$/;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return ALLOWED_ORIGIN_PATTERN.test(origin);
}

function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin! : '';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

interface AuthAttemptPayload {
  email: string;
  reason: string;
  navigatorData?: {
    userAgent?: string;
    language?: string;
    platform?: string;
    cookieEnabled?: boolean;
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Reject requests from disallowed origins
  if (!isAllowedOrigin(origin)) {
    console.warn(`[track-auth-attempt] Rejected request from origin: ${origin}`);
    return new Response(
      JSON.stringify({ error: 'Origin not allowed' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for database access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const payload: AuthAttemptPayload = await req.json();
    
    // Validate required fields
    if (!payload.email || !payload.reason) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email and reason' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get real IP address from request headers
    const forwardedFor = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ipAddress = forwardedFor?.split(',')[0] || realIp || 'unknown';

    // Get user agent from request headers (not client-supplied)
    const userAgent = req.headers.get('user-agent') || 'unknown';

    // Insert fraud tracking data using service role (bypasses RLS)
    const { error } = await supabase.from('failed_auth_attempts').insert({
      email: payload.email.toLowerCase().trim(),
      reason: payload.reason.substring(0, 500), // Limit reason length
      ip_address: ipAddress,
      user_agent: userAgent,
      navigator_data: payload.navigatorData || null,
    });

    if (error) {
      console.error('[track-auth-attempt] Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to track attempt' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
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
