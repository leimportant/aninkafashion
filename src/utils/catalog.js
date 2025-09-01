const PRODUCT_KEYWORDS = [
  'gamis', "daster", "daster kulit", 'dress', 'abaya', 'hijab', 'kerudung', 'setelan', 'atasan', 'bawahan',
  'kemeja', 'blouse', 'rok', 'jilbab', 'pashmina', 'outer', 'cardigan'
];

export function detectProductQuery(text) {
  if (!text) return false;
  const normalized = String(text).toLowerCase();
  return PRODUCT_KEYWORDS.some(k => normalized.includes(k));
}

export async function fetchCatalogResults({ baseUrl, query, headers }) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/products-catalog?q=${encodeURIComponent(query)}`;

  console.log('fetchCatalogResults', url, headers);
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10_000) });
  console.log('fetchCatalogResults', res);
  if (!res.ok) return [];
  const data = await res.json();

  console.log('fetchCatalogResults', data);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}


