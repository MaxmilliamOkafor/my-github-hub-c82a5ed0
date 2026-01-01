import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation limits
const MAX_EMAIL_LENGTH = 254;
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 100000; // 100KB
const MAX_NAME_LENGTH = 100;

// Allowed HTML tags for email body (safe for email rendering)
const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'table', 'tr', 'td', 'th', 'thead', 'tbody'];
const ALLOWED_ATTRS = ['href', 'style', 'class'];

// Simple HTML sanitizer to prevent XSS
function sanitizeHtml(html: string): string {
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove onclick, onerror, and other event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: and data: URLs
  sanitized = sanitized.replace(/javascript\s*:/gi, '');
  sanitized = sanitized.replace(/data\s*:/gi, '');
  
  // Remove iframe, object, embed tags
  sanitized = sanitized.replace(/<(iframe|object|embed|form|input|button)[^>]*>.*?<\/\1>/gi, '');
  sanitized = sanitized.replace(/<(iframe|object|embed|form|input|button)[^>]*\/?>/gi, '');
  
  // Remove style tags with malicious content
  sanitized = sanitized.replace(/<style[^>]*>.*?<\/style>/gi, '');
  
  return sanitized;
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= MAX_EMAIL_LENGTH;
}

// Validate string input
function validateString(value: any, maxLength: number, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength} characters`);
  }
  return trimmed;
}

interface SendEmailRequest {
  type: "application" | "referral" | "follow_up" | "test";
  applicationId?: string;
  recipient: string;
  subject: string;
  body: string;
  fromName?: string;
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

// Validate the request payload
function validateRequest(data: any): SendEmailRequest {
  // Validate type
  const validTypes = ['application', 'referral', 'follow_up', 'test'];
  if (!validTypes.includes(data.type)) {
    throw new Error('Invalid email type');
  }
  
  // Validate recipient email
  const recipient = validateString(data.recipient, MAX_EMAIL_LENGTH, 'recipient');
  if (!isValidEmail(recipient)) {
    throw new Error('Invalid recipient email address');
  }
  
  // Validate subject
  const subject = validateString(data.subject, MAX_SUBJECT_LENGTH, 'subject');
  if (!subject) {
    throw new Error('Subject is required');
  }
  
  // Validate and sanitize body
  let body = validateString(data.body, MAX_BODY_LENGTH, 'body');
  if (!body) {
    throw new Error('Body is required');
  }
  body = sanitizeHtml(body);
  
  // Validate optional fields
  const fromName = data.fromName ? validateString(data.fromName, MAX_NAME_LENGTH, 'fromName') : undefined;
  const applicationId = data.applicationId ? validateString(data.applicationId, 100, 'applicationId') : undefined;
  
  return {
    type: data.type,
    applicationId,
    recipient,
    subject,
    body,
    fromName,
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify JWT and get authenticated user ID
    const userId = await verifyAndGetUserId(req, supabase);

    // Parse and validate request
    const rawData = await req.json();
    const { type, applicationId, recipient, subject, body, fromName } = validateRequest(rawData);

    // Normalize email to lowercase to avoid case-sensitivity issues
    const normalizedRecipient = recipient.toLowerCase();

    console.log(`Sending ${type} email to ${normalizedRecipient} for user ${userId}`);

    // Get user profile for sender name
    let senderName = fromName || "Job Application";
    if (!fromName) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", userId)
        .single();

      if (profile?.first_name) {
        senderName = `${profile.first_name} ${profile.last_name || ""}`.trim();
      }
    }

    // Send email via Resend API
    // Note: In production, you'll need to verify your domain at resend.com/domains
    // For testing, you can only send to your own verified email
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <onboarding@resend.dev>`, // Use your verified domain in production
        to: [normalizedRecipient],
        subject: subject,
        html: body,
      }),
    });

    const emailResponse = await resendResponse.json();
    console.log("Email sent successfully:", emailResponse);

    if (!resendResponse.ok) {
      throw new Error(emailResponse.message || "Failed to send email");
    }

    // Record the sent email in database
    if (type !== "test") {
      const { error: dbError } = await supabase.from("sent_emails").insert({
        user_id: userId,
        application_id: applicationId || null,
        email_type: type === "application" ? "application" : type === "referral" ? "referral" : "follow_up",
        recipient: normalizedRecipient,
        subject,
        body,
        delivered: true,
        sent_at: new Date().toISOString(),
      });

      if (dbError) {
        console.error("Error recording sent email:", dbError);
      }

      // Update application status if applicable
      if (applicationId) {
        await supabase
          .from("applications")
          .update({ email_sent: true, email_sent_at: new Date().toISOString() })
          .eq("id", applicationId);
      }
    }

    return new Response(
      JSON.stringify({ success: true, messageId: emailResponse.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-email-resend:", error);
    const status = error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500;
    return new Response(
      JSON.stringify({ error: error.message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
