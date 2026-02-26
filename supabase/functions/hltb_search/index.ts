// Supabase Edge Function: hltb_search
// Deploy with: supabase functions deploy hltb_search --no-verify-jwt

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HLTBSearchRequest {
  name: string;
}

interface HLTBResponse {
  main?: number;      // Main story hours
  extra?: number;     // Main + extras hours
  completionist?: number; // 100% completion hours
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name } = await req.json() as HLTBSearchRequest;

    if (!name || typeof name !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid game name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[HLTB] Searching for: ${name}`);

    // HowLongToBeat.com unofficial API endpoint
    const hltbUrl = 'https://howlongtobeat.com/api/search';
    
    const searchPayload = {
      searchType: "games",
      searchTerms: name.split(' '),
      searchPage: 1,
      size: 5,
      searchOptions: {
        games: {
          userId: 0,
          platform: "",
          sortCategory: "popular",
          rangeCategory: "main",
          rangeTime: {
            min: null,
            max: null
          },
          gameplay: {
            perspective: "",
            flow: "",
            genre: ""
          },
          rangeYear: {
            min: "",
            max: ""
          },
          modifier: ""
        },
        users: {
          sortCategory: "postcount"
        },
        filter: "",
        sort: 0,
        randomizer: 0
      }
    };

    const hltbRes = await fetch(hltbUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://howlongtobeat.com/',
      },
      body: JSON.stringify(searchPayload),
    });

    if (!hltbRes.ok) {
      console.error(`[HLTB] Search failed with status ${hltbRes.status}`);
      return new Response(JSON.stringify({ main: 0, extra: 0, completionist: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await hltbRes.json();
    
    // Extract the first result
    const results = data?.data || [];
    if (results.length === 0) {
      console.warn(`[HLTB] No results found for: ${name}`);
      return new Response(JSON.stringify({ main: 0, extra: 0, completionist: 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firstResult = results[0];
    
    console.log(`[HLTB] Raw result for "${name}":`, firstResult);
    
    // HLTB returns times already in hours (not seconds!)
    const response: HLTBResponse = {
      main: firstResult.comp_main || 0,
      extra: firstResult.comp_plus || 0,
      completionist: firstResult.comp_100 || 0,
    };

    console.log(`[HLTB] Found data for "${firstResult.game_name}":`, response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[HLTB] Error:', error);
    // Return zeros instead of error to prevent app crashes
    return new Response(JSON.stringify({ main: 0, extra: 0, completionist: 0 }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
