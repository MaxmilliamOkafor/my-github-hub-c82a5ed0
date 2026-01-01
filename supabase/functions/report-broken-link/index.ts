import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { jobId, url, reason } = await req.json();

    if (!jobId || !url) {
      throw new Error('Job ID and URL are required');
    }

    console.log(`User ${user.id} reporting broken link for job ${jobId}`);

    // Check if this job exists and belongs to the user
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, url, report_count')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (jobError) throw jobError;
    if (!job) {
      throw new Error('Job not found or access denied');
    }

    // Check if user already reported this link
    const { data: existingReport } = await supabase
      .from('broken_link_reports')
      .select('id')
      .eq('job_id', jobId)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingReport) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'You have already reported this link',
          alreadyReported: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create the report
    const { error: insertError } = await supabase
      .from('broken_link_reports')
      .insert({
        job_id: jobId,
        user_id: user.id,
        url: url,
        report_reason: reason || 'Link not working',
        status: 'pending',
      });

    if (insertError) throw insertError;

    // Increment report count on the job
    const newReportCount = (job.report_count || 0) + 1;
    
    // If 3+ reports, mark as broken
    const shouldMarkBroken = newReportCount >= 3;
    
    await supabase
      .from('jobs')
      .update({
        report_count: newReportCount,
        url_status: shouldMarkBroken ? 'broken' : undefined,
      })
      .eq('id', jobId);

    console.log(`Report created. Total reports for job: ${newReportCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Thank you for reporting this issue. We will investigate.',
        reportCount: newReportCount,
        markedAsBroken: shouldMarkBroken,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Report error:', error);
    const status = error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500;
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
