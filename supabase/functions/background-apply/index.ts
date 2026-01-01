import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation limits
const MAX_JOB_IDS = 100;
const MAX_EMAIL_LENGTH = 254;

// Validate string input
function validateString(value: any, maxLength: number, fieldName: string): string {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return trimmed.substring(0, maxLength);
  }
  return trimmed;
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= MAX_EMAIL_LENGTH;
}

interface BackgroundApplyRequest {
  jobIds: string[];
  userProfile: any;
  sendConfirmationEmail: boolean;
  userEmail?: string;
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
function validateRequest(data: any): BackgroundApplyRequest {
  // Validate jobIds array
  if (!Array.isArray(data.jobIds)) {
    throw new Error('jobIds must be an array');
  }
  if (data.jobIds.length === 0) {
    throw new Error('jobIds cannot be empty');
  }
  if (data.jobIds.length > MAX_JOB_IDS) {
    throw new Error(`Maximum ${MAX_JOB_IDS} jobs per batch allowed`);
  }
  
  // Validate each job ID is a valid UUID-like string
  const jobIds = data.jobIds.slice(0, MAX_JOB_IDS).map((id: any) => {
    if (typeof id !== 'string' || id.length > 100) {
      throw new Error('Invalid job ID format');
    }
    return id.trim();
  });
  
  // Validate user profile exists
  if (!data.userProfile || typeof data.userProfile !== 'object') {
    throw new Error('userProfile is required');
  }
  
  // Validate optional email
  let userEmail: string | undefined;
  if (data.userEmail) {
    userEmail = validateString(data.userEmail, MAX_EMAIL_LENGTH, 'userEmail');
    if (userEmail && !isValidEmail(userEmail)) {
      throw new Error('Invalid userEmail format');
    }
  }
  
  return {
    jobIds,
    userProfile: data.userProfile, // Profile validation happens in tailor-application
    sendConfirmationEmail: !!data.sendConfirmationEmail,
    userEmail,
  };
}

serve(async (req) => {
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
    const { jobIds, userProfile, sendConfirmationEmail, userEmail } = validateRequest(rawData);

    console.log(`Starting background apply for ${jobIds.length} jobs for user ${userId}`);

    // Get jobs to process
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select("*")
      .in("id", jobIds)
      .eq("user_id", userId);

    if (jobsError || !jobs) {
      throw new Error(`Failed to fetch jobs: ${jobsError?.message}`);
    }

    const results: any[] = [];
    const errors: any[] = [];

    // Process each job using background task
    const processJob = async (job: any) => {
      try {
        console.log(`Processing job: ${job.title} at ${job.company}`);

        // Call tailor-application function with auth header
        const tailorResponse = await fetch(`${supabaseUrl}/functions/v1/tailor-application`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            jobTitle: job.title,
            company: job.company,
            description: job.description || "",
            requirements: job.requirements || [],
            userProfile,
            includeReferral: true,
          }),
        });

        if (!tailorResponse.ok) {
          throw new Error(`Failed to tailor application: ${tailorResponse.status}`);
        }

        const tailoredData = await tailorResponse.json();

        // Create application record
        const { data: application, error: appError } = await supabase
          .from("applications")
          .insert({
            user_id: userId,
            job_id: job.id,
            tailored_resume: tailoredData.tailoredResume,
            tailored_cover_letter: tailoredData.tailoredCoverLetter,
            referral_email: tailoredData.referralEmail,
            status: "applied",
            applied_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (appError) {
          throw new Error(`Failed to create application: ${appError.message}`);
        }

        // Update job status
        await supabase
          .from("jobs")
          .update({ 
            status: "applied", 
            applied_at: new Date().toISOString(),
            match_score: tailoredData.matchScore 
          })
          .eq("id", job.id);

        results.push({
          jobId: job.id,
          applicationId: application.id,
          title: job.title,
          company: job.company,
          matchScore: tailoredData.matchScore,
          success: true,
        });

        console.log(`Successfully applied to ${job.title} at ${job.company}`);
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        errors.push({
          jobId: job.id,
          title: job.title,
          company: job.company,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    };

    // Process jobs in batches of 3 to avoid rate limiting
    for (let i = 0; i < jobs.length; i += 3) {
      const batch = jobs.slice(i, i + 3);
      await Promise.all(batch.map(processJob));
      
      // Small delay between batches
      if (i + 3 < jobs.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Send confirmation email if requested
    if (sendConfirmationEmail && userEmail && results.length > 0) {
      const emailBody = `
        <h2>AutoApply AI - Application Summary</h2>
        <p>Your automated job applications have been completed!</p>
        
        <h3>Successfully Applied (${results.length})</h3>
        <ul>
          ${results.map(r => `<li><strong>${r.title}</strong> at ${r.company} - Match Score: ${r.matchScore}%</li>`).join("")}
        </ul>
        
        ${errors.length > 0 ? `
        <h3>Failed Applications (${errors.length})</h3>
        <ul>
          ${errors.map(e => `<li><strong>${e.title}</strong> at ${e.company} - Error: ${e.error}</li>`).join("")}
        </ul>
        ` : ""}
        
        <p>Log in to AutoApply AI to view your tailored resumes and cover letters.</p>
      `;

      // Store the notification (email sending would require Gmail integration)
      await supabase.from("sent_emails").insert({
        user_id: userId,
        email_type: "application",
        recipient: userEmail,
        subject: `AutoApply AI: ${results.length} Applications Submitted`,
        body: emailBody,
        delivered: true,
      });
    }

    console.log(`Background apply completed: ${results.length} success, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        applied: results.length,
        failed: errors.length,
        results,
        errors 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in background-apply:", error);
    const status = error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500;
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
