import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  console.log("========== Nova Requisição Recebida ==========");
  console.log("Método:", req.method);
  
  if (req.method === 'OPTIONS') {
    console.log("Respondendo à requisição OPTIONS (preflight).");
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    console.log("Tentando ler o corpo (body) da requisição...");
    const { query } = await req.json();
    console.log("Corpo da requisição lido com sucesso. Query:", query);
    
    console.log("Tentando obter as credenciais (secrets)...");
    const clientId = Deno.env.get("IGDB_CLIENT_ID");
    const accessToken = Deno.env.get("IGDB_ACCESS_TOKEN");
    
    if (!clientId || !accessToken) {
      console.error("ERRO: Credenciais da IGDB não encontradas nos secrets!");
      throw new Error("Credenciais da IGDB não encontradas nos secrets.");
    }

    console.log("Credenciais obtidas com sucesso.");
    
    // DEBUG: Verificar formato das credenciais
    console.log(`Client ID length: ${clientId.length}`);
    console.log(`Access Token length: ${accessToken.length}`);
    console.log(`Client ID starts with: '${clientId.substring(0, 6)}'`);
    console.log(`Access Token starts with: '${accessToken.substring(0, 6)}'`);
    
    // Verificar se o token não tem espaços ou caracteres estranhos
    const cleanAccessToken = accessToken.trim();
    const cleanClientId = clientId.trim();
    
    console.log(">>> ENVIANDO REQUISIÇÃO PARA A API DA IGDB...");
    
    const requestHeaders = {
      'Accept': 'application/json',
      'Client-ID': cleanClientId,
      'Authorization': `Bearer ${cleanAccessToken}`,
      'Content-Type': 'text/plain',
    };
    
    // DEBUG: Log dos headers (sem mostrar o token completo por segurança)
    console.log("Headers sendo enviados:");
    console.log("- Accept:", requestHeaders['Accept']);
    console.log("- Client-ID:", requestHeaders['Client-ID']);
    console.log("- Authorization:", `Bearer ${cleanAccessToken.substring(0, 10)}...`);
    console.log("- Content-Type:", requestHeaders['Content-Type']);
    
    const response = await fetch("https://api.igdb.com/v4/games", {
      method: 'POST',
      headers: requestHeaders,
      body: query
    });
    
    console.log("<<< RESPOSTA DA API DA IGDB RECEBIDA! Status:", response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("ERRO da API IGDB:", errorText);
      
      // Se for erro 401, vamos tentar validar o token
      if (response.status === 401) {
        console.log("ERRO 401 detectado. Verificando se o token está válido...");
        
        // Teste simples com a API de validação do Twitch
        try {
          const validateResponse = await fetch("https://id.twitch.tv/oauth2/validate", {
            headers: {
              "Authorization": `OAuth ${cleanAccessToken}`
            }
          });
          
          if (validateResponse.ok) {
            const validateData = await validateResponse.json();
            console.log("Token validation response:", validateData);
          } else {
            console.log("Token validation failed:", validateResponse.status);
          }
        } catch (validateError) {
          console.log("Error validating token:", validateError);
        }
      }
      
      throw new Error(`Erro na API IGDB: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    console.log("Dados da IGDB processados. Retornando para o cliente.");
    
    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error("!!!!!!!!!! ERRO INESPERADO NA FUNÇÃO !!!!!!!!!!");
    console.error(error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})