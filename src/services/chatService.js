import { loadLlamaProvider } from "../vendors/llamaProvider.js";
import { loadGroqProvider } from "../vendors/groqProvider.js";
import { detectProductQuery, fetchCatalogResults } from "../utils/catalog.js";
import { getAuthHeaders, getAuthHeadersFromCookieMap } from "../utils/auth.js";
import { detectFaqQuery, fetchFaqResults } from "../utils/faq.js";
import { isVideo } from "../utils/media.js";
import { userAgrees, userRejects } from "../utils/userIntent.js";
import { detectOutfitQuery, extractOutfitKeyword } from "../utils/outfit.js";

import {
  detectOrderQuery,
  detectTrackingQuery,
  extractOrderNumber,
  extractOrderPeriod,
  detectOrderPeriodQuery,
  extractTrackingNumber,
  fetchOrderStatus,
  fetchTrackingInfo,
  formatOrderStatus,
  formatTrackingInfo,
} from "../utils/orders.js";

import { getRecommendedSizeFromText } from "../utils/size.js";

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
  let lastChartData = null; // Simpan data chart sementara
  let lastSizeRecommendation = null;
  let lastOutfitQuery = null;
  const providers = [];
  if (llamaModelPath) {
    const llama = await loadLlamaProvider({ modelPath: llamaModelPath });
    if (llama) providers.push(llama);
  }
  const groq = await loadGroqProvider({ apiKey: groqApiKey, model: groqModel });
  if (groq) providers.push(groq);

  if (providers.length === 0) {
    throw new Error(
      "No chat providers available. Configure LLAMA_MODEL_PATH or GROQ_API_KEY."
    );
  }

  async function generateReply(
    messages,
    reqHeaders,
    authCookieValue,
    reqCookies
  ) {
    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...messages,
    ];

    const lastUserMessage = [...messages]
      .reverse()
      .find((m) => m.role === "user");
    let catalogContext = "";
    let structuredProducts = [];
    let orderInfo = null;
    let trackingInfo = null;
    let faqInfo = null;
    let followupQuestion = null;
    let delay = 0;

    console.warn("Incoming messages array in generateReply:", messages);

    if (lastUserMessage) {
      const userText = lastUserMessage.content;
      const authHeadersFromHeader = getAuthHeaders(reqHeaders, authCookieValue);
      const authHeadersFromBody = getAuthHeadersFromCookieMap(
        reqHeaders,
        authCookieValue
      );
      const authHeadersFromCookies = getAuthHeadersFromCookieMap(
        reqHeaders,
        authCookieValue
      );
      const authHeaders = {
        ...authHeadersFromHeader,
        ...authHeadersFromBody,
        ...authHeadersFromCookies,
      };

      // === Handle chart confirmation ===
      const lastBotMessage = [...messages]
        .reverse()
        .find((m) => m.role === "assistant");
      if (lastBotMessage) {
        const botText = lastBotMessage.content;
        const userTextLower = userText.toLowerCase();

        // === User menjawab "ya/mau/boleh" setelah bot tanya grafik ===
        if (botText.toLowerCase().includes("grafik")) {
          console.warn("Mendeteksi jawaban grafik dari user:", userTextLower);
          if (userAgrees(userTextLower)) {
            console.warn("User setuju untuk menampilkan grafik.");
            if (lastChartData) {
              console.warn(
                "Menggunakan chartData dari cache server:",
                lastChartData
              );

              const chartMessages = [];

              console.warn("lastChartData:", lastChartData);
              console.warn("lastChartData.by_status:", lastChartData.by_status);
              console.warn("lastChartData.by_day:", lastChartData.by_day);

              // Add by_status chart message
              if (
                lastChartData.by_status &&
                lastChartData.by_status.length > 0
              ) {
                chartMessages.push({
                  provider: "system",
                  message: "Berikut adalah grafik pesanan berdasarkan status:",
                  chartData: { by_status: lastChartData.by_status }, // Pastikan by_status disertakan dengan lengkap
                  preferred: "by_status",
                  delay: 500,
                });
              }

              // Add by_day chart message
              if (lastChartData.by_day && lastChartData.by_day.length > 0) {
                chartMessages.push({
                  provider: "system",
                  message: "Berikut adalah grafik pesanan berdasarkan hari:",
                  chartData: { by_day: lastChartData.by_day }, // Pastikan by_day disertakan dengan lengkap
                  preferred: "by_day",
                  delay: 0, // Optional delay for the second chart
                });
              }

              if (chartMessages.length > 0) {
                lastChartData = null; // Clear cache after use
                return chartMessages;
              } else {
                console.error(
                  "Cache chartData tidak ditemukan atau tidak lengkap. Tidak dapat menampilkan grafik."
                );
                return {
                  provider: "system",
                  message:
                    "Maaf, terjadi kesalahan dan saya tidak bisa menampilkan grafik saat ini. Data grafik tidak tersedia atau tidak lengkap.",
                  products: [],
                  orderInfo: null,
                  trackingInfo: null,
                  faqInfo: null,
                };
              }
            } else {
              console.error(
                "Cache chartData tidak ditemukan. Tidak dapat menampilkan grafik."
              );
              return {
                provider: "system",
                message:
                  "Maaf, terjadi kesalahan dan saya tidak bisa menampilkan grafik saat ini. Silakan coba lagi.",
                products: [],
                orderInfo: null,
                trackingInfo: null,
                faqInfo: null,
              };
            }
          }
          // === User menolak grafik ===
          else if (
            botText.toLowerCase().includes("grafik") &&
            userRejects(userTextLower)
          ) {
            // User menolak, lanjut tanpa grafik
            // Tidak perlu tindakan khusus, lanjut ke proses berikutnya
            return {
              provider: "system",
              message:
                "Baik, saya tidak akan menampilkan grafiknya. Apakah ada yang bisa saya bantu lagi?",
              products: [],
              orderInfo: null,
              trackingInfo: null,
              faqInfo: null,
            };
          }
        }
      }

      // === Handle FAQ ===
      if (detectFaqQuery(userText)) {
        try {
          const answers = await fetchFaqResults({
            baseUrl: publicApiBaseUrl,
            query: userText,
            headers: authHeaders,
          });
          if (answers && answers.length) {
            const content = Array.isArray(answers)
              ? String(answers[0])
              : String(answers);
            faqInfo = { title: "FAQ", content };
            fullMessages.push({
              role: "system",
              content: `Informasi FAQ: ${content}`,
            });
          }
        } catch {}
      }

      // === Deteksi ukuran (BB & tinggi badan) ===
      const sizeInfo = getRecommendedSizeFromText(userText);
      if (sizeInfo) {
        lastSizeRecommendation = sizeInfo.sizeLabel;
        return [
          {
            provider: "system",
            message: sizeInfo.message,
            preferred: { size: sizeInfo.recommendedSize },
            sizeInfo,
            products: [],
            orderInfo: null,
            trackingInfo: null,
            faqInfo: null,
            chartData: null,
          },
          {
            provider: "system",
            message: "Mau saya carikan katalog terbaru di aninka fashion?",
            products: [],
            orderInfo: null,
            trackingInfo: null,
            faqInfo: null,
            chartData: null,
            delay: 5000,
          },
        ];
      }

      // === Deteksi outfitకే ===
      const outfitKeyword = extractOutfitKeyword(userText);
      if (outfitKeyword) {
        lastOutfitQuery = outfitKeyword;
        return [
          {
            provider: "system",
            message: `Tentu, saya bisa bantu carikan ide outfit untuk ${outfitKeyword}.`,
            products: [],
            orderInfo: null,
            trackingInfo: null,
            faqInfo: null,
            chartData: null,
          },
          {
            provider: "system",
            message: `Mau saya tampilkan katalog outfit ${outfitKeyword} terbaru dari Aninka Fashion? 💃`,
            products: [],
            orderInfo: null,
            trackingInfo: null,
            faqInfo: null,
            chartData: null,
            delay: 3000,
          },
        ];
      }

      if (lastBotMessage && (lastBotMessage.content.includes("katalog terbaru") || lastBotMessage.content.includes("katalog outfit"))) {
        if (userAgrees(userText)) {
          let query = "katalog produk koleksi terbaru";
          if (lastSizeRecommendation) {
            query = lastSizeRecommendation;
            lastSizeRecommendation = null; // Clear it after use
          } else if (lastOutfitQuery) {
            query = lastOutfitQuery;
            lastOutfitQuery = null; // Clear it after use
          }
          // User wants to see the catalog
          const results = await fetchCatalogResults({
            baseUrl: publicApiBaseUrl,
            query: query,
            headers: authHeaders,
          });

          if (results && results.length > 0) {
            structuredProducts = results.slice(0, 6).map((r) => {
              const price =
                r.price_sell ?? r.price ?? r.harga ?? r.prices?.sale;
              const name = r.product_name ?? r.name ?? r.title;
              const category = r.category_name ?? r.category ?? "";
              const description = r.product_description ?? r.description ?? "";
              const color = description || "";
              const sizes = Array.isArray(r.sizes)
                ? r.sizes.map((s) => ({
                    label: s.size_id || s.variant || "",
                    qty_available: s.qty_available ?? s.qty_stock ?? 0,
                    price: s.price_sell ?? s.price ?? null,
                  }))
                : [];
              let imagePath = r.image_url || r.image || r.image_path || "";
              let imageUrl = imagePath;
              if (imagePath && !/^https?:\/\//i.test(imagePath)) {
                imageUrl = `${publicApiBaseUrl.replace(
                  /\$\/$/, ""
                )}/storage/${imagePath}`;
              }
              if (
                isVideo(imageUrl) &&
                Array.isArray(r.gallery_images) &&
                r.gallery_images.length > 0
              ) {
                let galleryPath = r.gallery_images[0];
                if (galleryPath && !/^https?:\/\//i.test(galleryPath)) {
                  imageUrl = `${publicApiBaseUrl.replace(
                    /\$\/$/, ""
                  )}/storage/${galleryPath}`;
                } else {
                  imageUrl = galleryPath;
                }
              }
              return { name, price, category, imageUrl, color, sizes };
            });
            catalogContext = `Berikut adalah beberapa produk dengan ukuran yang Anda cari:\n${structuredProducts
              .map((p) => {
                const price = p.price;
                let text = `- ${p.name}`;
                if (price != null) text += ` (Harga: Rp${price})`;
                return text;
              })
              .join("\n")}`;

            return {
              provider: "system",
              message: catalogContext,
              products: structuredProducts,
              orderInfo: null,
              trackingInfo: null,
              faqInfo: null,
            };
          }
        } else if (userRejects(userText)) {
          return {
            provider: "system",
            message: "Terima kasih, masih ada yang dapat saya bantu?",
            products: [],
            orderInfo: null,
            trackingInfo: null,
            faqInfo: null,
          };
        }
      }

      // === Handle tracking ===
      if (detectTrackingQuery(userText)) {
        const trackingNumber = extractTrackingNumber(userText);
        if (trackingNumber) {
          const trackingData = await fetchTrackingInfo({
            baseUrl: publicApiBaseUrl,
            query: trackingNumber,
            headers: authHeaders,
          });
          if (trackingData) {
            trackingInfo = formatTrackingInfo(trackingData);
            if (trackingInfo) {
              let systemContent = `Ringkasan order: ${trackingInfo.fullText}`;
              if (trackingInfo.followupQuestion) {
                systemContent += `\n\nAfter presenting the summary, you MUST ask the user the following question verbatim: "${trackingInfo.followupQuestion}"`;
              }
              fullMessages.push({ role: "system", content: systemContent });
            }
          }
        }
      }

      // === Handle order status / summary ===
      if (detectOrderQuery(userText)) {
        if (detectOrderPeriodQuery(userText)) {
          const period = extractOrderPeriod(userText);
          const summaryData = await fetchTrackingInfo({
            baseUrl: publicApiBaseUrl,
            query: period.key,
            headers: authHeaders,
          });
          if (summaryData) {
            trackingInfo = formatTrackingInfo(summaryData, period.label);
            if (trackingInfo) {
              const summaryMessage = trackingInfo.fullText;
              const followupMessage =
                trackingInfo.followupQuestion ||
                "Apakah mau saya buatkan grafiknya?";

              if (trackingInfo.chartData) {
                lastChartData = trackingInfo.chartData;
              }

              const noOrder =
                summaryMessage.includes("Tidak ada pesanan") ||
                summaryMessage.includes("Belum ada pesanan") ||
                summaryMessage.toLowerCase().includes("tidak ditemukan");

              if (noOrder) {
                // hanya kirim ringkasan saja
                return [
                  {
                    provider: "system",
                    message: summaryMessage,
                    products: [],
                    orderInfo: null,
                    trackingInfo: {
                      ...trackingInfo,
                      chartData: trackingInfo.chartData || null,
                    },
                    faqInfo: null,
                    delay: 0,
                  },
                ];
              }

              // Return array: satu untuk ringkasan, satu untuk follow-up
              return [
                {
                  provider: "system",
                  message: summaryMessage,
                  products: [],
                  orderInfo: null,
                  trackingInfo: {
                    ...trackingInfo,
                    chartData: trackingInfo.chartData || null,
                  }, // Tambahkan chartData di sini juga
                  faqInfo: null,
                  delay: 0,
                },
                {
                  provider: "system",
                  message: followupMessage,
                  products: [],
                  orderInfo: null,
                  trackingInfo: null,
                  faqInfo: null,
                  chartData: null, // Set to null to prevent duplicate rendering
                  delay: 3000, // tampil setelah 3 detik
                },
              ];
            }
          }
        } else {
          const orderNumber = extractOrderNumber(userText);
          if (orderNumber) {
            const orderData = await fetchOrderStatus({
              baseUrl: publicApiBaseUrl,
              orderNumber,
              headers: authHeaders,
            });
            if (orderData) {
              orderInfo = formatOrderStatus(orderData);
              fullMessages.push({
                role: "system",
                content: `Informasi order: ${orderInfo.fullText}`,
              });
            }
          }
        }
      }

      // === Handle product query ===
      if (detectProductQuery(userText)) {
        try {
          const results = await fetchCatalogResults({
            baseUrl: publicApiBaseUrl,
            query: lastUserMessage.content,
            headers: authHeaders,
          });
          if (results && results.length > 0) {
            structuredProducts = results.slice(0, 6).map((r) => {
              const price =
                r.price_sell ?? r.price ?? r.harga ?? r.prices?.sale;
              const name = r.product_name ?? r.name ?? r.title;
              const category = r.category_name ?? r.category ?? "";
              const description = r.product_description ?? r.description ?? "";
              const color = description || "";
              const sizes = Array.isArray(r.sizes)
                ? r.sizes.map((s) => ({
                    label: s.size_id || s.variant || "",
                    qty_available: s.qty_available ?? s.qty_stock ?? 0,
                    price: s.price_sell ?? s.price ?? null,
                  }))
                : [];
              let imagePath = r.image_url || r.image || r.image_path || "";
              let imageUrl = imagePath;
              if (imagePath && !/^https?:\/\//i.test(imagePath)) {
                imageUrl = `${publicApiBaseUrl.replace(
                  /\$\/$/, ""
                )}/storage/${imagePath}`;
              }
              if (
                isVideo(imageUrl) &&
                Array.isArray(r.gallery_images) &&
                r.gallery_images.length > 0
              ) {
                let galleryPath = r.gallery_images[0];
                if (galleryPath && !/^https?:\/\//i.test(galleryPath)) {
                  imageUrl = `${publicApiBaseUrl.replace(
                    /\$\/$/, ""
                  )}/storage/${galleryPath}`;
                } else {
                  imageUrl = galleryPath;
                }
              }
              return { name, price, category, imageUrl, color, sizes };
            });
            catalogContext = `Katalog terkait:\n${structuredProducts
              .map((p) => {
                const price = p.price;
                let text = `- ${p.name}`;
                if (price != null) text += ` (Harga: Rp${price})`;
                if (p.color) text += ` | Warna: ${p.color}`;
                if (Array.isArray(p.sizes) && p.sizes.length) {
                  const sizeList = p.sizes
                    .map(
                      (s) =>
                        `${s.label}${s.qty_available ? `(${s.qty_available})` : ""}`
                    )
                    .join(", ");
                  text += ` | Ukuran: ${sizeList}`;
                }
                return text;
              })
              .join("\n")}`;
            fullMessages.push({
              role: "system",
              content: `Gunakan konteks katalog berikut saat menjawab: ${catalogContext}`,
            });
          }
        } catch (e) {
          console.error("Catalog fetch error", e);
        }
      }
    }

    // === Generate reply from provider ===
    const sanitizedMessages = fullMessages.map((m) => ({
      role: m.role,
      content: String(m.content ?? ""),
    }));
    for (const provider of providers) {
      try {
        const reply = await provider.complete(sanitizedMessages);
        return {
          provider: provider.name,
          message: reply,
          products: structuredProducts,
          orderInfo,
          trackingInfo,
          faqInfo,
          followupQuestion,
          delay,
        };
      } catch (e) {
        console.error(`[chat] provider failed: ${provider.name}`, e);
        continue;
      }
    }

    // === Fallback ===
    const fallback = "Ups, saya tidak memiliki informasi tersebut saat ini.";
    return {
      provider: "none",
      message: fallback,
      products: structuredProducts,
      orderInfo,
      trackingInfo,
      faqInfo,
      followupQuestion,
      delay,
    };
  }

  return { generateReply };
}
