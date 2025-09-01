import { loadLlamaProvider } from '../vendors/llamaProvider.js';
import { loadGroqProvider } from '../vendors/groqProvider.js';
import { detectProductQuery, fetchCatalogResults } from '../utils/catalog.js';
import { getAuthHeadersFromCookieHeader, getAuthHeadersFromCookieValue, getAuthHeadersFromCookieMap } from '../utils/auth.js';
import { detectFaqQuery, fetchFaqResults  } from '../utils/faq.js';
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
      const authHeadersFromHeader = getAuthHeadersFromCookieHeader(reqHeaders?.cookie || reqHeaders?.Cookie || '');
      const authHeadersFromBody = getAuthHeadersFromCookieValue(authCookieValue);
      const authHeadersFromCookies = getAuthHeadersFromCookieMap(reqCookies || {});
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
              let imagePath = r.image_url || r.image || r.image_path || '';
              let imageUrl = imagePath;
              if (imagePath && !/^https?:\/\//i.test(imagePath)) {
                imageUrl = `${publicApiBaseUrl.replace(/\/$/, '')}/storage/${imagePath}`;
              }
              return { name, price, category, imageUrl };
            });
            catalogContext = `Katalog terkait:\n${structuredProducts.map(r => {
              const price = r.price ?? r.harga ?? r.prices?.sale;
              const discount = Number(r.discount ?? r.diskon ?? r.prices?.discount ?? 0);
              const price_grosir = Number(r.price_grosir ?? r.prices?.grosir ?? 0);
              const discount_grosir = Number(r.discount_grosir ?? r.prices?.discount_grosir ?? 0);
              const label = r.name;

              let text = `- ${label}`;
              if (price != null) text += ` (Harga: Rp${price})`;
              if (discount > 0) text += ` (Diskon ${discount}%)`;
              if (price_grosir > 0) text += ` (Harga grosir: Rp${price_grosir} /min pembelian >1)`;
              if (discount_grosir > 0) text += ` (Diskon grosir ${discount_grosir}%)`;

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


