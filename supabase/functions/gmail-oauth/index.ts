import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation limits
const MAX_CODE_LENGTH = 500;
const MAX_URI_LENGTH = 500;

// Validate string input
function validateString(value: any, maxLength: number, fieldName: string): string {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length`);
  }
  return trimmed;
}

// Validate OAuth authorization code format
function isValidAuthCode(code: string): boolean {
  // OAuth codes are typically alphanumeric with some special chars
  return /^[a-zA-Z0-9_\-\/]+$/.test(code) && code.length >= 10 && code.length <= MAX_CODE_LENGTH;
}

// Validate redirect URI
function isValidRedirectUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

interface OAuthRequest {
  type: "get_auth_url" | "exchange_code" | "refresh_token";
  code?: string;
  redirectUri?: string;
}

// Helper function to verify JWT and extract user ID
async function verifyAndGetUserId(req: Request, supabase: any): Promise<string> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    throw new Error('Missing authorization header');
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Unauthorized: Invalid or expired token');
  }
  
  return user.id;
}

// Validate request payload
function validateRequest(data: any): OAuthRequest {
  const validTypes = ['get_auth_url', 'exchange_code', 'refresh_token'];
  if (!validTypes.includes(data.type)) {
    throw new Error('Invalid request type');
  }
  
  const result: OAuthRequest = { type: data.type };
  
  if (data.code) {
    const code = validateString(data.code, MAX_CODE_LENGTH, 'code');
    if (code && !isValidAuthCode(code)) {
      throw new Error('Invalid authorization code format');
    }
    result.code = code;
  }
  
  if (data.redirectUri) {
    const redirectUri = validateString(data.redirectUri, MAX_URI_LENGTH, 'redirectUri');
    if (redirectUri && !isValidRedirectUri(redirectUri)) {
      throw new Error('Invalid redirect URI format');
    }
    result.redirectUri = redirectUri;
  }
  
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
    const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!clientId || !clientSecret) {
      console.error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
      throw new Error("Google OAuth is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Verify JWT and get authenticated user ID
    const userId = await verifyAndGetUserId(req, supabase);
    
    // Parse and validate request
    const rawData = await req.json();
    const { type, code, redirectUri } = validateRequest(rawData);

    console.log(`Gmail OAuth request: ${type} for user ${userId}`);

    const SCOPES = [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ];

    if (type === "get_auth_url") {
      if (!redirectUri) {
        throw new Error("redirectUri is required");
      }

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId);
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", SCOPES.join(" "));
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", userId);

      console.log("Generated auth URL for user:", userId);

      return new Response(
        JSON.stringify({ authUrl: authUrl.toString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "exchange_code") {
      if (!code || !redirectUri) {
        throw new Error("code and redirectUri are required");
      }

      console.log("Exchanging code for tokens...");

      // Exchange authorization code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error("Token exchange error:", errorData);
        throw new Error(`Failed to exchange code: ${tokenResponse.status}`);
      }

      const tokens = await tokenResponse.json();
      console.log("Tokens received successfully");

      // Get user email from Google
      const userInfoResponse = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        { headers: { Authorization: `Bearer ${tokens.access_token}` } }
      );

      let email = "unknown@gmail.com";
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        email = userInfo.email;
        console.log("User email retrieved:", email);
      }

      // Calculate token expiry
      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Store tokens in database
      const { error: upsertError } = await supabase
        .from("email_integrations")
        .upsert({
          user_id: userId,
          email,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokenExpiry,
          is_connected: true,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

      if (upsertError) {
        console.error("Database upsert error:", upsertError);
        throw new Error("Failed to save OAuth tokens");
      }

      console.log("Gmail OAuth completed successfully for:", email);

      return new Response(
        JSON.stringify({ success: true, email }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === "refresh_token") {
      // Get current tokens from database
      const { data: integration, error: fetchError } = await supabase
        .from("email_integrations")
        .select("refresh_token")
        .eq("user_id", userId)
        .single();

      if (fetchError || !integration?.refresh_token) {
        throw new Error("No refresh token found. Please reconnect Gmail.");
      }

      console.log("Refreshing access token...");

      // Refresh the access token
      const refreshResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: integration.refresh_token,
          grant_type: "refresh_token",
        }),
      });

      if (!refreshResponse.ok) {
        const errorData = await refreshResponse.text();
        console.error("Token refresh error:", errorData);
        throw new Error("Failed to refresh token. Please reconnect Gmail.");
      }

      const tokens = await refreshResponse.json();
      const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

      // Update tokens in database
      const { error: updateError } = await supabase
        .from("email_integrations")
        .update({
          access_token: tokens.access_token,
          token_expiry: tokenExpiry,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) {
        console.error("Token update error:", updateError);
        throw new Error("Failed to update tokens");
      }

      console.log("Access token refreshed successfully");

      return new Response(
        JSON.stringify({ success: true, access_token: tokens.access_token }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error(`Unknown request type: ${type}`);

  } catch (error) {
    console.error("Error in gmail-oauth:", error);
    const status = error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
