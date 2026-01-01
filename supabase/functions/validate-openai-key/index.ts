import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { apiKey } = await req.json();

    if (!apiKey || typeof apiKey !== 'string') {
      return new Response(JSON.stringify({ 
        valid: false, 
        error: "API key is required" 
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Test the API key by making a minimal request to OpenAI
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const modelCount = data.data?.length || 0;
      
      // Check if gpt-4o-mini is available
      const hasGpt4oMini = data.data?.some((model: any) => model.id === 'gpt-4o-mini');
      
      return new Response(JSON.stringify({ 
        valid: true, 
        message: `API key is valid! Access to ${modelCount} models.`,
        hasGpt4oMini,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const errorData = await response.text();
      console.error("OpenAI API validation failed:", response.status, errorData);
      
      let errorMessage = "Invalid API key";
      if (response.status === 401) {
        errorMessage = "Invalid API key. Please check and try again.";
      } else if (response.status === 429) {
        errorMessage = "Rate limit exceeded. The key is valid but hitting limits.";
      } else if (response.status === 403) {
        errorMessage = "Access denied. Check your OpenAI account permissions.";
      }
      
      return new Response(JSON.stringify({ 
        valid: false, 
        error: errorMessage 
      }), {
        status: 200, // Return 200 so frontend can handle the error gracefully
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Validation error:", error);
    return new Response(JSON.stringify({ 
      valid: false, 
      error: error instanceof Error ? error.message : "Validation failed" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
