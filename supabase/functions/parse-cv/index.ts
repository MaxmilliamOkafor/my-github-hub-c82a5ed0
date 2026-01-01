import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { cvFilePath } = await req.json();

    if (!cvFilePath) {
      throw new Error('CV file path is required');
    }

    // Download the CV file from storage
    const { data: fileData, error: downloadError } = await supabaseClient.storage
      .from('cvs')
      .download(cvFilePath);

    if (downloadError || !fileData) {
      throw new Error('Failed to download CV file: ' + downloadError?.message);
    }

    // Convert file to base64 for processing
    const arrayBuffer = await fileData.arrayBuffer();
    const base64Content = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    // Determine file type
    const fileExtension = cvFilePath.split('.').pop()?.toLowerCase() || 'pdf';
    const mimeType = fileExtension === 'pdf' ? 'application/pdf' : 
                     fileExtension === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                     'application/msword';

    // Get user's OpenAI API key
    const { data: profileData } = await supabaseClient
      .from('profiles')
      .select('openai_api_key')
      .eq('user_id', user.id)
      .single();

    const openaiApiKey = profileData?.openai_api_key || Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured. Please add your API key in the profile settings.');
    }

    // Use OpenAI to extract structured data from CV text
    // First, we need to extract text from the file
    // For PDFs/DOCx, we'll use a text extraction approach
    
    let textContent = '';
    
    // Try to extract text content
    try {
      // For text-based extraction, we'll send to OpenAI with the document
      const extractionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an expert CV/Resume parser. Extract structured information from the provided CV content and return it as a JSON object. 

Extract the following fields (use null if not found):
- first_name: string
- last_name: string  
- email: string
- phone: string
- city: string
- country: string
- linkedin: string (full URL)
- github: string (full URL)
- portfolio: string (full URL)
- total_experience: string (e.g., "5+ years")
- highest_education: string (e.g., "Master's in Computer Science")
- current_salary: string (if mentioned)
- expected_salary: string (if mentioned)
- skills: array of objects with {name: string, years: number, category: "technical" | "soft"}
- certifications: array of strings
- work_experience: array of objects with {company: string, title: string, startDate: string, endDate: string, description: string}
- education: array of objects with {institution: string, degree: string, field: string, startDate: string, endDate: string}
- languages: array of objects with {language: string, proficiency: "native" | "fluent" | "conversational" | "basic"}
- cover_letter: string (a brief professional summary if available)

Return ONLY valid JSON, no markdown or explanation.`
            },
            {
              role: 'user',
              content: `Parse this CV document (base64 encoded ${mimeType}). Extract all the information you can find:\n\n${base64Content.substring(0, 50000)}`
            }
          ],
          temperature: 0.3,
          max_tokens: 4000,
        }),
      });

      if (!extractionResponse.ok) {
        const errorText = await extractionResponse.text();
        console.error('OpenAI extraction error:', errorText);
        throw new Error('Failed to parse CV with AI');
      }

      const extractionData = await extractionResponse.json();
      const extractedText = extractionData.choices?.[0]?.message?.content || '';
      
      // Parse the JSON response
      let parsedData;
      try {
        // Clean up the response - remove markdown code blocks if present
        let cleanedText = extractedText.trim();
        if (cleanedText.startsWith('```json')) {
          cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (cleanedText.startsWith('```')) {
          cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }
        parsedData = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('JSON parse error:', parseError, 'Raw text:', extractedText);
        throw new Error('Failed to parse extracted CV data');
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: parsedData,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (extractError) {
      console.error('CV extraction error:', extractError);
      throw new Error('Failed to extract CV content: ' + (extractError as Error).message);
    }

  } catch (error) {
    console.error('Parse CV error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
