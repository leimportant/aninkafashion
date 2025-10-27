const PRODUCT_KEYWORDS = [
  'gamis', "daster", "daster kulit", 'dress', 'abaya', 'hijab', 'kerudung', 'setelan', 'atasan', 'bawahan',
  'kemeja', 'blouse', 'rok', 'jilbab', 'pashmina', 'outer', 'chibi', 'cardigan', 'twill', 'cp twill', 'one set', 'manohara', 'monica',
  'celana', 'jumpsuit', 'overall', 'tunik', 'tunic', 'pakaian', 'baju', 'fashion', 'pakaian muslim', 'pakaian wanita', 'pakaian pria', 'pakaian anak',
  'navy', 'maroon', 'mustard', 'hijau', 'hitam', 'putih', 'biru', 'pink', 'merah', 'kuning', 'coklat', 'cream', 'abu abu', 'grey',
  'dust', 'olive', 'orange', 'peach', 'purple', 'ungu', 'salem', 'soft', 'pastel',
  'polos', 'jumbo', 'std', 'standar', 'standard', 'besar', 'big',  'big size', 'xl', 'xxl', 'xxxl', 'l', 'm', 's', 'fit to xl', 'fit to l', 'fit to m', 'fit to s',
  'motif', 'polos', 'polkadot', 'floral', 'bunga', 'striped', 'garis garis', 'plaid', 'kotak kotak',
  'lengan panjang', 'lengan pendek', 'tanpa lengan', 'saku', 'kerah', 'resleting', 'kancing',
  'muslimah', 'muslim', 'casual', 'formal', 'pesta', 'lebaran', 'hari raya', 'idul fitri', 'idul adha',
  'anak anak', 'remaja', 'dewasa', 'pria', 'wanita', 'cewek', 'cowok',
  'termurah', 'terbaru', 'terlaris', 'diskon', 'sale', 'promo', 'harga', 'beli', 'beli sekarang', 'beli di sini',
  'toko', 'etalase', 'catalog', 'katalog', 'produk', 'barang', 'item', 'koleksi', 'collection',
  'aninka', 'aninkafashion', 'aninka fashion', 'aninka store', 'aninka official', 'aninka official store', 'aninka fashion store'
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


