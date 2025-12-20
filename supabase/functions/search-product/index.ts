import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { barcode } = await req.json();

    if (!barcode) {
      return new Response(JSON.stringify({ error: "Barcode is required" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const searchUrl = `https://pt.product-search.net/search?q=${barcode}`;
    const response = await fetch(searchUrl);
    const html = await response.text();

    let productName = null;
    // Tentativa de extrair o nome do produto de tags h2 ou h3
    // Esta é uma abordagem de web scraping básica e pode ser frágil se a estrutura do site mudar.
    const h2Match = html.match(/<h2[^>]*>(.*?)<\/h2>/i);
    if (h2Match && h2Match[1]) {
      productName = h2Match[1].replace(/<[^>]*>/g, '').trim();
      if (productName.toLowerCase().includes("resultados da pesquisa") || productName.toLowerCase().includes("search results")) {
        productName = null; // Ignorar títulos genéricos de resultados de busca
      }
    }
    
    if (!productName) {
      const h3Match = html.match(/<h3[^>]*>(.*?)<\/h3>/i);
      if (h3Match && h3Match[1]) {
        productName = h3Match[1].replace(/<[^>]*>/g, '').trim();
        if (productName.toLowerCase().includes("resultados da pesquisa") || productName.toLowerCase().includes("search results")) {
          productName = null;
        }
      }
    }

    return new Response(JSON.stringify({ productName }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error("Error in Edge Function:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});