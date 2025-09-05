import { loadLlamaProvider } from '../vendors/llamaProvider.js';
import { loadGroqProvider } from '../vendors/groqProvider.js';
import { detectProductQuery, fetchCatalogResults } from '../utils/catalog.js';
import { getAuthHeaders, getAuthHeadersFromCookieMap } from '../utils/auth.js';
import { detectFaqQuery, fetchFaqResults  } from '../utils/faq.js';
import { isVideo } from '../utils/media.js';
import { detectOrderQuery, extractOrderNumber, fetchOrderStatus, formatOrderStatus, detectTrackingQuery, extractTrackingNumber, fetchTrackingInfo, formatTrackingInfo } from '../utils/orders.js';

const SYSTEM_PROMPT = `You are an AI assistant for Aninka Fashion (aninkafashion.com).
You help customers with:
- Finding clothing and accessories
- Answering questions about sizes and materials
- Providing fashion advice
- Handling order inquiries
- Processing returns and exchanges
- Order Status
- Tracking Orders
- Payment Methods
- Shipping Information
Please be polite and professional. Use Bahasa Indonesia as primary language.
If you don't know the answer, just say "Ups, saya tidak memiliki informasi tersebut saat ini."`;

export async function createChatService(options = {}) {
  const { llamaModelPath, groqApiKey, groqModel, publicApiBaseUrl } = options;

  const providers = [];
  if (llamaModelPath) {
    const llama = await loadLlamaProvider({ modelPath: llamaModelPath });
    if (llama) providers.push(llama);
  }
  const groq = await loadGroqProvider({ apiKey: groqApiKey, model: groqModel });
  if (groq) providers.push(groq);

  if (providers.length === 0) {
    throw new Error('No chat providers available. Configure LLAMA_MODEL_PATH or GROQ_API_KEY.');
  }

  async function generateReply(messages, reqHeaders, authCookieValue, reqCookies) {
    // Inject system prompt at the start
    const fullMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];

    // Product intent detection and enrichment
    const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
    let catalogContext = '';
    let structuredProducts = [];
    let orderInfo = null;
    let trackingInfo = null;
    let faqInfo = null;

    if (lastUserMessage) {
      const userText = lastUserMessage.content;

      // Prepare auth headers once
      const authHeadersFromHeader = getAuthHeaders(reqHeaders, authCookieValue);
      const authHeadersFromBody = getAuthHeadersFromCookieMap(reqHeaders, authCookieValue);
      const authHeadersFromCookies = getAuthHeadersFromCookieMap(reqHeaders, authCookieValue);
      const authHeaders = { ...authHeadersFromHeader, ...authHeadersFromBody, ...authHeadersFromCookies };

      // Check for FAQ intent first
      if (detectFaqQuery(userText)) {
        try {
          const answers = await fetchFaqResults({ baseUrl: publicApiBaseUrl, query: userText, headers: authHeaders });
          if (answers && answers.length) {
            const content = Array.isArray(answers) ? String(answers[0]) : String(answers);
            faqInfo = { title: 'FAQ', content };
            fullMessages.push({ role: 'system', content: `Informasi FAQ: ${content}` });
          }
        } catch {}
      }

      // Check for order tracking
      if (detectTrackingQuery(userText)) {
        const trackingNumber = extractTrackingNumber(userText);
        if (trackingNumber) {
          const trackingData = await fetchTrackingInfo({ 
            baseUrl: publicApiBaseUrl, 
            trackingNumber, 
            headers: authHeaders 
          });
          if (trackingData) {
            trackingInfo = formatTrackingInfo(trackingData);
            fullMessages.push({ role: 'system', content: `Informasi tracking: ${trackingInfo.fullText}` });
          }
        }
      }

      // Check for order status
      if (detectOrderQuery(userText)) {
        const orderNumber = extractOrderNumber(userText);
        if (orderNumber) {
          const orderData = await fetchOrderStatus({ baseUrl: publicApiBaseUrl, orderNumber, headers: authHeaders });
          if (orderData) {
            orderInfo = formatOrderStatus(orderData);
            fullMessages.push({ role: 'system', content: `Informasi order: ${orderInfo.fullText}` });
          }
        }
      }

      // Check for product queries
      if (detectProductQuery(userText)) {
        try {
          const results = await fetchCatalogResults({ baseUrl: publicApiBaseUrl, query: lastUserMessage.content, headers: authHeaders });
          if (results && results.length > 0) {
            structuredProducts = results.slice(0, 6).map(r => {
              const price = r.price_sell ?? r.price ?? r.harga ?? r.prices?.sale;
              const name = r.product_name ?? r.name ?? r.title;
              const category = r.category_name ?? r.category ?? '';
              const description = r.product_description ?? r.description ?? '';
              const color = description || '';
              const sizes = Array.isArray(r.sizes) ? r.sizes.map(s => ({
                label: s.size_id || s.variant || '',
                qty_available: s.qty_available ?? s.qty_stock ?? 0,
                price: s.price_sell ?? s.price ?? null
              })) : [];
              let imagePath = r.image_url || r.image || r.image_path || '';
              let imageUrl = imagePath;
              if (imagePath && !/^https?:\/\//i.test(imagePath)) {
                imageUrl = `${publicApiBaseUrl.replace(/\/$/, '')}/storage/${imagePath}`;
              }

              if (isVideo(imageUrl)) {
                // Fallback: ambil gambar pertama dari gallery_images
                if (Array.isArray(r.gallery_images) && r.gallery_images.length > 0) {
                  let galleryPath = r.gallery_images[0]; // bisa loop kalau mau pilih tertentu
                  if (galleryPath && !/^https?:\/\//i.test(galleryPath)) {
                    imageUrl = `${publicApiBaseUrl.replace(/\/$/, '')}/storage/${galleryPath}`;
                  } else {
                    imageUrl = galleryPath;
                  }
                }
              }

              return { name, price, category, imageUrl, color, sizes };
            });
            catalogContext = `Katalog terkait:\n${structuredProducts.map(p => {
              const price = p.price;
              let text = `- ${p.name}`;
              if (price != null) text += ` (Harga: Rp${price})`;
              if (p.color) text += ` | Warna: ${p.color}`;
              if (Array.isArray(p.sizes) && p.sizes.length) {
                const sizeList = p.sizes.map(s => `${s.label}${s.qty_available ? `(${s.qty_available})` : ''}`).join(', ');
                text += ` | Ukuran: ${sizeList}`;
              }
              return text;
            }).join('\n')}`;
            
            fullMessages.push({ role: 'system', content: `Gunakan konteks katalog berikut saat menjawab: ${catalogContext}` });
          }
        } catch (e) {
          // Swallow catalog errors; proceed without enrichment
        }
      }
    }

    // Sanitize messages for provider API (only role/content)
    const sanitizedMessages = fullMessages.map(m => ({ role: m.role, content: String(m.content ?? '') }));

    for (const provider of providers) {
      try {
        const reply = await provider.complete(sanitizedMessages);
        return { 
          provider: provider.name, 
          message: reply, 
          products: structuredProducts,
          orderInfo,
          trackingInfo,
          faqInfo
        };
      } catch (e) {
        console.error(`[chat] provider failed: ${provider.name}`, e);
        continue;
      }
    }
    // Graceful fallback per instruction
    const fallback = 'Ups, saya tidak memiliki informasi tersebut saat ini.';
    return { 
      provider: 'none', 
      message: fallback, 
      products: structuredProducts,
      orderInfo,
      trackingInfo,
      faqInfo
    };
  }

  return { generateReply };
}


