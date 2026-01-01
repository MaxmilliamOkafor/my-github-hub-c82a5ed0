import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationResult {
  url: string;
  jobId: string;
  isValid: boolean;
  statusCode?: number;
  error?: string;
  redirectUrl?: string;
}

// Known ATS URL patterns and their expected status pages
const ATS_PATTERNS = {
  workday: {
    pattern: /myworkdayjobs\.com/,
    errorIndicators: ['position has been filled', 'job is no longer available', 'requisition is closed', 'no longer accepting applications'],
  },
  greenhouse: {
    pattern: /greenhouse\.io/,
    errorIndicators: ['job not found', 'position has been filled', 'no longer accepting', 'job is closed'],
  },
  workable: {
    pattern: /workable\.com/,
    errorIndicators: ['position is closed', 'job not found', 'no longer accepting'],
  },
  smartrecruiters: {
    pattern: /smartrecruiters\.com/,
    errorIndicators: ['job not found', 'position closed', 'no longer available'],
  },
  linkedin: {
    pattern: /linkedin\.com\/jobs/,
    errorIndicators: ['no longer accepting', 'job not found'],
  },
  indeed: {
    pattern: /indeed\.com/,
    errorIndicators: ['job has expired', 'no longer available'],
  },
  icims: {
    pattern: /icims\.com/,
    errorIndicators: ['position filled', 'no longer available'],
  },
  teamtailor: {
    pattern: /teamtailor\.com/,
    errorIndicators: ['position closed', 'no longer accepting'],
  },
  bullhorn: {
    pattern: /bullhorn/i,
    errorIndicators: ['job closed', 'no longer available'],
  },
  oraclecloud: {
    pattern: /oraclecloud\.com/,
    errorIndicators: ['requisition closed', 'no longer accepting'],
  },
};

async function validateSingleUrl(url: string, jobId: string): Promise<ValidationResult> {
  try {
    // First, try a HEAD request (faster)
    const headResponse = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    // Check for obvious errors
    if (headResponse.status === 404 || headResponse.status === 410 || headResponse.status === 403) {
      return {
        url,
        jobId,
        isValid: false,
        statusCode: headResponse.status,
        error: `Job page returned ${headResponse.status} status`,
      };
    }

    // For 200-range responses, we need to check the content for "job closed" messages
    if (headResponse.ok) {
      // Do a GET request to check content for job closed indicators
      const getResponse = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });

      if (!getResponse.ok) {
        return {
          url,
          jobId,
          isValid: false,
          statusCode: getResponse.status,
          error: `Job page not accessible (${getResponse.status})`,
        };
      }

      const content = await getResponse.text();
      const contentLower = content.toLowerCase();

      // Check for ATS-specific error indicators
      for (const [atsName, ats] of Object.entries(ATS_PATTERNS)) {
        if (ats.pattern.test(url)) {
          for (const indicator of ats.errorIndicators) {
            if (contentLower.includes(indicator.toLowerCase())) {
              return {
                url,
                jobId,
                isValid: false,
                statusCode: 200,
                error: `Job appears to be closed or no longer accepting applications`,
              };
            }
          }
          break;
        }
      }

      // Check final URL for redirect to careers home (often indicates job closed)
      const finalUrl = getResponse.url;
      if (finalUrl !== url) {
        // Check if redirected to a generic careers page
        const genericPatterns = [
          /\/careers\/?$/,
          /\/jobs\/?$/,
          /\/search\/?$/,
          /\/home\/?$/,
          // Workable company page without job ID (e.g., apply.workable.com/company-name/)
          /apply\.workable\.com\/[a-zA-Z0-9-]+\/?$/,
          // Greenhouse company board without job ID
          /boards\.greenhouse\.io\/[a-zA-Z0-9-]+\/?$/,
        ];
        
        for (const pattern of genericPatterns) {
          if (pattern.test(finalUrl)) {
            return {
              url,
              jobId,
              isValid: false,
              redirectUrl: finalUrl,
              error: 'Job page redirects to careers home - position may be closed',
            };
          }
        }
      }
      
      // Additional check: ensure the URL itself is a direct job link, not a careers page
      const isDirectJobUrl = 
        (url.includes('greenhouse.io') && /\/jobs\/\d+/.test(url)) ||
        (url.includes('workable.com') && /\/j\/[a-zA-Z0-9]+/.test(url)) ||
        (url.includes('myworkdayjobs.com') && /\/job\//.test(url)) ||
        (url.includes('linkedin.com') && /\/jobs\/view\/\d+/.test(url)) ||
        (url.includes('indeed.com') && /\/(viewjob|job)\//.test(url)) ||
        (!url.includes('greenhouse.io') && !url.includes('workable.com') && 
         !url.includes('myworkdayjobs.com') && !url.includes('linkedin.com') && 
         !url.includes('indeed.com'));
      
      if (!isDirectJobUrl) {
        return {
          url,
          jobId,
          isValid: false,
          error: 'URL points to a company careers page, not a specific job listing',
        };
      }

      return {
        url,
        jobId,
        isValid: true,
        statusCode: 200,
        redirectUrl: getResponse.url !== url ? getResponse.url : undefined,
      };
    }

    // Handle redirects and other status codes
    return {
      url,
      jobId,
      isValid: headResponse.status >= 200 && headResponse.status < 400,
      statusCode: headResponse.status,
    };

  } catch (error) {
    console.error(`Error validating URL ${url}:`, error);
    return {
      url,
      jobId,
      isValid: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { jobIds, validateAll, batchSize = 10 } = await req.json();

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

    let jobsToValidate: { id: string; url: string }[] = [];

    if (validateAll) {
      // Get jobs that haven't been checked recently (or never checked)
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('id, url')
        .eq('user_id', user.id)
        .or('url_last_checked.is.null,url_last_checked.lt.' + new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .not('url', 'is', null)
        .limit(batchSize);

      if (error) throw error;
      jobsToValidate = (jobs || []).filter(j => j.url);
    } else if (jobIds && jobIds.length > 0) {
      // Validate specific jobs
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('id, url')
        .eq('user_id', user.id)
        .in('id', jobIds)
        .not('url', 'is', null);

      if (error) throw error;
      jobsToValidate = (jobs || []).filter(j => j.url);
    }

    if (jobsToValidate.length === 0) {
      return new Response(
        JSON.stringify({ success: true, validated: 0, results: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Validating ${jobsToValidate.length} job URLs for user ${user.id}`);

    // Validate URLs in parallel batches of 5
    const results: ValidationResult[] = [];
    const parallelBatchSize = 5;
    
    for (let i = 0; i < jobsToValidate.length; i += parallelBatchSize) {
      const batch = jobsToValidate.slice(i, i + parallelBatchSize);
      const batchResults = await Promise.all(
        batch.map(job => validateSingleUrl(job.url!, job.id))
      );
      results.push(...batchResults);
    }

    // Update job statuses in database
    const now = new Date().toISOString();
    for (const result of results) {
      const urlStatus = result.isValid ? 'valid' : 'broken';
      
      await supabase
        .from('jobs')
        .update({
          url_status: urlStatus,
          url_last_checked: now,
        })
        .eq('id', result.jobId)
        .eq('user_id', user.id);
    }

    const validCount = results.filter(r => r.isValid).length;
    const brokenCount = results.filter(r => !r.isValid).length;

    console.log(`Validation complete: ${validCount} valid, ${brokenCount} broken`);

    return new Response(
      JSON.stringify({
        success: true,
        validated: results.length,
        validCount,
        brokenCount,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Validation error:', error);
    const status = error instanceof Error && error.message.includes('Unauthorized') ? 401 : 500;
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
