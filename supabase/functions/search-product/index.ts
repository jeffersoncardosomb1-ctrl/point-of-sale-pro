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

    // Helper to extract text from a tag and filter generic search results
    const extractTextFromTag = (htmlContent: string, tagName: string): string[] => {
      const regex = new RegExp(`<${tagName}[^>]*>(.*?)</${tagName}>`, 'gi');
      const matches = [...htmlContent.matchAll(regex)];
      return matches
        .map(match => match[1].replace(/<[^>]*>/g, '').trim())
        .filter(text => text && 
          !text.toLowerCase().includes("resultados da pesquisa") && 
          !text.toLowerCase().includes("search results") &&
          !text.toLowerCase().includes("product search") // Added another generic term
        );
    };

    // 1. Try to extract from <title> tag first
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch && titleMatch[1]) {
      const titleText = titleMatch[1].replace(/<[^>]*>/g, '').trim();
      if (!titleText.toLowerCase().includes("resultados da pesquisa") && 
          !titleText.toLowerCase().includes("search results") &&
          !titleText.toLowerCase().includes("product search")) {
        productName = titleText;
      }
    }

    // 2. If not found or generic, try h1, h2, h3 tags (first non-generic one)
    if (!productName) {
      const h1Texts = extractTextFromTag(html, 'h1');
      if (h1Texts.length > 0) {
        productName = h1Texts[0];
      }
    }

    if (!productName) {
      const h2Texts = extractTextFromTag(html, 'h2');
      if (h2Texts.length > 0) {
        productName = h2Texts[0];
      }
    }
    
    if (!productName) {
      const h3Texts = extractTextFromTag(html, 'h3');
      if (h3Texts.length > 0) {
        productName = h3Texts[0];
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