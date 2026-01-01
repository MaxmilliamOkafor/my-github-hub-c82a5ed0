import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, if-none-match, if-modified-since',
  'Access-Control-Expose-Headers': 'ETag, Last-Modified, X-Total-Count',
};

interface JobFeedResponse {
  jobs: any[];
  total: number;
  hasMore: boolean;
  lastUpdated: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Get authorization header for user context
    const authHeader = req.headers.get('authorization');
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader || '' } }
    });

    // Get user from token
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse query params
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const since = url.searchParams.get('since'); // ISO timestamp for polling
    const search = url.searchParams.get('search') || '';
    const location = url.searchParams.get('location') || '';
    const jobType = url.searchParams.get('type') || '';
    const company = url.searchParams.get('company') || '';
    const status = url.searchParams.get('status') || '';

    // Check ETag / If-Modified-Since for caching
    const ifNoneMatch = req.headers.get('if-none-match');
    const ifModifiedSince = req.headers.get('if-modified-since');

    // Build base query
    let query = supabase
      .from('jobs')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // If polling for new jobs since a timestamp
    if (since) {
      query = query.gt('created_at', since);
    }

    // Apply filters
    if (search) {
      query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%,description.ilike.%${search}%`);
    }
    if (location) {
      query = query.ilike('location', `%${location}%`);
    }
    if (company) {
      query = query.ilike('company', `%${company}%`);
    }
    if (status) {
      query = query.eq('status', status);
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: jobs, error, count } = await query;

    if (error) {
      console.error('Database error:', error);
      return new Response(
        JSON.stringify({ error: 'Database error', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate ETag based on latest job timestamp and count
    const latestJob = jobs?.[0];
    const lastModified = latestJob?.created_at || new Date().toISOString();
    const etagContent = btoa(lastModified + '-' + (count || 0));
    const etag = `"${etagContent}"`;
    // Check if client already has latest data
    if (ifNoneMatch === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          ...corsHeaders,
          'ETag': etag,
          'Last-Modified': lastModified,
        }
      });
    }

    // Check If-Modified-Since
    if (ifModifiedSince && !since) {
      const modifiedSinceDate = new Date(ifModifiedSince);
      const lastModifiedDate = new Date(lastModified);
      if (lastModifiedDate <= modifiedSinceDate) {
        return new Response(null, {
          status: 304,
          headers: {
            ...corsHeaders,
            'ETag': etag,
            'Last-Modified': lastModified,
          }
        });
      }
    }

    // Format jobs with relative timestamps
    const formattedJobs = (jobs || []).map(job => ({
      ...job,
      requirements: job.requirements || [],
      match_score: job.match_score || 0,
      status: job.status || 'pending',
      // Add computed fields
      isNew: job.created_at && (Date.now() - new Date(job.created_at).getTime()) < 5 * 60 * 1000, // < 5 min
    }));

    const response: JobFeedResponse = {
      jobs: formattedJobs,
      total: count || 0,
      hasMore: (offset + limit) < (count || 0),
      lastUpdated: lastModified,
    };

    return new Response(
      JSON.stringify(response),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'ETag': etag,
          'Last-Modified': lastModified,
          'X-Total-Count': String(count || 0),
          'Cache-Control': 'private, max-age=5',
        }
      }
    );

  } catch (error: unknown) {
    console.error('Error in live-jobs-feed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
