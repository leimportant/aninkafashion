const FAQ_KEYWORDS = [
    "cara",
    "bagaimana",
    "apakah",
    "dimana",
    "belanja",
    "pembayaran",
    "retur",
    "tukar",
    "ukuran",
    "size",
    "material",
    "warna",
    "color",
    "bahan"
  ];
  
  export function detectFaqQuery(text) {
    if (!text) return false;
    const normalized = String(text).toLowerCase();
    return FAQ_KEYWORDS.some(k => normalized.includes(k));
  }
  
  export async function fetchFaqResults({ baseUrl, query, headers }) {
    if (!baseUrl) return [];
    const url = `${baseUrl.replace(/\/$/, '')}/api/faqs/answer?q=${encodeURIComponent(query || '')}`;
  
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return [];
  
      const data = await res.json();
  
      // Handle berbagai format
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.results)) return data.results;
      if (Array.isArray(data?.data)) return data.data;
      if (typeof data?.answer === 'string') return [data.answer];
  
      return [];
    } catch (err) {
      console.error('fetchFaqResults error', err);
      return [];
    }
  }
  