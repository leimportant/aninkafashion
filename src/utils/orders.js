/**
 * ✅ utils/orders.js
 * Modul deteksi & fetch data order/tracking untuk chatbot
 */

function stripHtml(html) {
  if (!html) return '';
  // Replace <br> tags with newlines, then remove all other HTML tags
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '');
}

//
// 🔍 Deteksi Query Order
//
export function detectOrderQuery(text = "") {
  if (!text) return false;
  const normalized = text.toLowerCase();
  const orderKeywords = [
    "order",
    "pesanan",
    "tracking",
    "lacak",
    "status",
    "resi",
    "no resi",
    "kirim",
    "terima",
    "diterima",
    "proses",
    "dalam proses",
    "selesai",
    "belum bayar",
    "bayar",
    "pembayaran",
    "paid",
    "dibayar",
    "sudah bayar",
    "order id",
    "order number",
    "nomor pesanan",
    "invoice",
    "faktur",
  ];
  return orderKeywords.some((k) => normalized.includes(k));
}

//
// 🔢 Ekstrak Nomor Order dari Kalimat
//
export function extractOrderNumber(text = "") {
  if (!text) return null;
  const patterns = [
    /order\s*(?:id|number|no)?\s*[#:]?\s*([A-Z0-9]{6,12})/i,
    /(?:order|pesanan)\s*[#:]?\s*([A-Z0-9]{6,12})/i,
    /([A-Z]{2,4}\d{6,10})/i,
    /(\d{6,12})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

//
// 📆 Deteksi Query Periode Order
//
export function detectOrderPeriodQuery(text = "") {
  if (!text) return false;
  const lower = text.toLowerCase();

  const patterns = [
    /minggu(?:\s+(ini|kemarin|lalu))?/,
    /bulan(?:\s+(ini|lalu|kemarin))?/,
    /tahun(?:\s+(ini|lalu))?/,
    /\border\s+(minggu|bulan|tahun)/,
    /\bpesanan\s+(minggu|bulan|tahun)/,
    /\border\s+saya\b/,
    /\bpesanan\s+saya\b/,
  ];

  return patterns.some((p) => p.test(lower));
}

//
// 📆 Ekstrak Periode dari Teks User
//
export function extractOrderPeriod(text = "") {
  if (!text) return { key: "all", label: "semua waktu" };

  const lower = text.toLowerCase().trim();

  // Pola umum: "2 bulan lalu", "3 minggu yang lalu", "1 tahun yg lalu"
  const matchRelative = lower.match(/(\d+)\s*(minggu|bulan|tahun)(\s+(yang\s+)?lalu)?/);
  if (matchRelative) {
    const value = parseInt(matchRelative[1], 10);
    const unit = matchRelative[2];
    if (unit.includes("minggu")) return { key: `weeks_ago:${value}`, label: `${value} minggu lalu` };
    if (unit.includes("bulan")) return { key: `months_ago:${value}`, label: `${value} bulan lalu` };
    if (unit.includes("tahun")) return { key: `years_ago:${value}`, label: `${value} tahun lalu` };
  }

  // Periode standar
  if (/minggu(\s+ini|\s+sekarang)?/.test(lower))
    return { key: "this_week", label: "minggu ini" };
  if (/minggu(\s+lalu|\s+kemarin)?/.test(lower))
    return { key: "last_week", label: "minggu lalu" };

  if (/bulan(\s+ini|\s+sekarang)?/.test(lower))
    return { key: "this_month", label: "bulan ini" };
  if (/bulan(\s+lalu|\s+kemarin)?/.test(lower))
    return { key: "last_month", label: "bulan lalu" };

  if (/tahun(\s+ini|\s+sekarang)?/.test(lower))
    return { key: "this_year", label: "tahun ini" };
  if (/tahun(\s+lalu|\s+kemarin)?/.test(lower))
    return { key: "last_year", label: "tahun lalu" };

  // fallback umum
  if (/\border\s+saya\b|\bpesanan\s+saya\b/.test(lower))
    return { key: "this_month", label: "bulan ini" };

  return { key: "all", label: "semua waktu" };
}



//
// 🔎 Fetch Status Order Berdasarkan Nomor
//
export async function fetchOrderStatus({ baseUrl, orderNumber, headers }) {
  if (!orderNumber || !baseUrl) return null;

  const possiblePeriodQueries = [
    "minggu", "bulan", "tahun",
    "minggu ini", "minggu lalu", "minggu kemarin",
    "bulan ini", "bulan lalu", "bulan kemarin",
    "tahun ini", "tahun lalu",
    "this_week", "last_week",
    "this_month", "last_month",
    "this_year", "last_year",
    "all"
  ];

  const query = String(orderNumber).toLowerCase().trim();

  if (possiblePeriodQueries.includes(query)) {
    console.log(`fetchOrderStatus redirected to fetchTrackingInfo for query: ${orderNumber}`);
    // Standardize the query before sending (e.g., "minggu ini" -> "this_week")
    const period = extractOrderPeriod(orderNumber);
    return fetchTrackingInfo({ baseUrl, query: period.key, headers });
  }

  const url = `${baseUrl.replace(/\/$/, "")}/api/orders/status?q=${encodeURIComponent(
    orderNumber
  )}`;
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.log(`Order status fetch failed: ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error("fetchOrderStatus error:", error);
    return null;
  }
}

//
// 🔎 Fetch Summary Order Berdasarkan User + Periode
//
export async function fetchOrderSummaryByPeriod({ baseUrl, userId, period, headers }) {
  if (!baseUrl || !userId || !period) return null;

  const url = `${baseUrl.replace(/\/$/, "")}/api/orders/summary?user_id=${userId}&period=${period}`;
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.log(`Order summary fetch failed: ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error("fetchOrderSummaryByPeriod error:", error);
    return null;
  }
}

//
// 🧾 Format Data Order
//
export function formatOrderStatus(orderData) {
  if (!orderData) return null;

  const status = String(orderData.status || orderData.order_status || "unknown");
  const orderNumber = orderData.order_number || orderData.order_id || orderData.id;
  const items = orderData.items || orderData.order_items || [];
  const total = orderData.total || orderData.total_amount || 0;
  const shipping = orderData.shipping_info || orderData.shipping || {};

  let statusText = "";
  switch (status.toLowerCase()) {
    case "1":
    case "2":
    case "menunggu":
    case "menunggu_pembayaran":
      statusText = "Menunggu pembayaran";
      break;
    case "3":
    case "menunggu_konfirmasi":
      statusText = "Menunggu konfirmasi";
      break;
    case "4":
    case "processing":
    case "diproses":
    case "on_progress":
      statusText = "Sedang diproses";
      break;
    case "5":
    case "packed":
      statusText = "Sudah dikemas";
      break;
    case "6":
    case "delivered":
    case "diterima":
    case "done":
      statusText = "Pesanan selesai";
      break;
    case "7":
    case "cancelled":
    case "dibatalkan":
    case "cancel":
      statusText = "Pesanan dibatalkan";
      break;
    case "8":
    case "confirm_cancel":
      statusText = "Konfirmasi pembatalan";
      break;
    case "9":
    case "shipped":
    case "dikirim":
      statusText = "Pesanan dikirim";
      break;
    case "10":
    case "approved":
      statusText = "Pesanan disetujui";
      break;
    case "11":
    case "rejected":
      statusText = "Pesanan ditolak";
      break;
    case "paid":
    case "dibayar":
      statusText = "Pembayaran diterima";
      break;
    default:
      statusText = `Status: ${status}`;
  }

  const cleanStatus = stripHtml(statusText);
  const itemList = items
    .map((item) => `${stripHtml(item.product_name || item.name)} (${item.quantity || 1} pcs)`)
    .join(", ");

  const trackingInfo = shipping.tracking_number
    ? `\nResi: ${shipping.tracking_number}`
    : "";

  return {
    orderNumber,
    status: cleanStatus,
    items: itemList,
    total: `Rp${total.toLocaleString()}`,
    tracking: trackingInfo,
    fullText: `Order #${orderNumber}\n${cleanStatus}\nItems: ${itemList}\nTotal: Rp${total.toLocaleString()}${trackingInfo}`,
  };
}

// Helper function to get a formatted status label from a raw status string
export function getFormattedStatusLabel(rawStatus) {
  console.warn("getFormattedStatusLabel: rawStatus received:", rawStatus);
  let statusText = "";
  switch (rawStatus.toLowerCase()) {
    case "1":
    case "2":
    case "menunggu":
    case "menunggu_pembayaran":
      statusText = "Menunggu pembayaran";
      break;
    case "3":
    case "menunggu_konfirmasi":
      statusText = "Menunggu konfirmasi";
      break;
    case "4":
    case "processing":
    case "diproses":
    case "on_progress":
      statusText = "Sedang diproses";
      break;
    case "5":
    case "packed":
      statusText = "Sudah dikemas";
      break;
    case "6":
    case "delivered":
    case "diterima":
    case "done":
      statusText = "Pesanan selesai";
      break;
    case "7":
    case "cancelled":
    case "dibatalkan":
    case "cancel":
      statusText = "Pesanan dibatalkan";
      break;
    case "8":
    case "confirm_cancel":
      statusText = "Konfirmasi pembatalan";
      break;
    case "9":
    case "shipped":
    case "dikirim":
      statusText = "Pesanan dikirim";
      break;
    case "10":
    case "approved":
      statusText = "Pesanan disetujui";
      break;
    case "11":
    case "rejected":
      statusText = "Pesanan ditolak";
      break;
    case "paid":
    case "dibayar":
      statusText = "Pembayaran diterima";
      break;
    default:
      console.warn("getFormattedStatusLabel: Unrecognized rawStatus, using default:", rawStatus);
      statusText = `Status: ${rawStatus}`;
  }
  return stripHtml(statusText);
}

//
// 🚚 Deteksi Query Tracking atau Summary
//
export function detectTrackingQuery(text = "") {
  const normalized = text.toLowerCase();
  const summaryOrderKeywords = [
    "bulan ini",
    "bulan lalu",
    "minggu ini",
    "hari ini",
    "summary",
    "ringkasan",
    "semua",
    "all",
  ];
  return summaryOrderKeywords.some((k) => normalized.includes(k));
}

//
// 🔢 Ekstrak Nomor Resi
//
export function extractTrackingNumber(text = "") {
  if (!text) return null;
  const patterns = [
    /resi\s*[#:]?\s*([A-Z0-9]{10,20})/i,
    /tracking\s*[#:]?\s*([A-Z0-9]{10,20})/i,
    /awb\s*[#:]?\s*([A-Z0-9]{10,20})/i,
    /([A-Z]{2,4}\d{8,12})/i,
    /(\d{10,20})/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

//
// 📦 Fetch Tracking Info / Summary Orders
//
export async function fetchTrackingInfo({ baseUrl, query, headers }) {
  if (!baseUrl) return null;

  const url = `${baseUrl.replace(/\/$/, "")}/api/orders/summary?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.log(`Tracking/summary fetch failed: ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (error) {
    console.error("fetchTrackingInfo error:", error);
    return null;
  }
}

//
// 🧾 Format Tracking / Summary Orders
//
export function formatTrackingInfo(trackingData, periodLabel = null) {
  if (!trackingData) return null;

  const data = trackingData.response || trackingData;

  // Jika data summary
  if (data.data || data.summary || data.orders) {
    const summary = data.summary || {};
    const orders = data.data || data.orders || [];
    const chartData = {}; // Always start with an empty chartData object

    // Generate by_status data if orders are available
    const statusMap = {};
    for (const order of orders) {
      const status = String(order.status || order.order_status || "unknown").toLowerCase();
      const total = order.total || order.total_amount || 0;
      const statusLabel = getFormattedStatusLabel(status); // Use new helper function
      
      if (!statusMap[statusLabel]) {
        statusMap[statusLabel] = { count: 0, total: 0, label: statusLabel };
      }
      statusMap[statusLabel].count++;
      statusMap[statusLabel].total += Number(total);
    }
    if (Object.keys(statusMap).length > 0) {
      chartData.by_status = Object.values(statusMap);
    }

    // Generate by_day data if available (and add labels for consistency)
    const byDayMap = {};
    // Assume data.chartData.by_day might exist from API, or we construct it
    const rawByDay = data.chartData?.by_day || []; 
    if (rawByDay.length > 0) {
      for (const dayData of rawByDay) {
        const dateLabel = dayData.date; // Use existing date as label
        if (!byDayMap[dateLabel]) {
          byDayMap[dateLabel] = { date: dateLabel, count: 0, total: 0 };
        }
        byDayMap[dateLabel].count += dayData.count || 0;
        byDayMap[dateLabel].total += dayData.total || 0;
      }
    } else {
      // Fallback: construct by_day from orders if no direct by_day data from API
      for (const order of orders) {
        const orderDate = new Date(order.created_at || order.date || Date.now()).toISOString().split('T')[0];
        const total = order.total || order.total_amount || 0;
        if (!byDayMap[orderDate]) {
          byDayMap[orderDate] = { date: orderDate, count: 0, total: 0 };
        }
        byDayMap[orderDate].count++;
        byDayMap[orderDate].total += Number(total);
      }
    }

    if (Object.keys(byDayMap).length > 0) {
      chartData.by_day = Object.values(byDayMap).sort((a, b) => a.date.localeCompare(b.date));
    }

    let summaryText = "📊 Ringkasan Pesanan:\n";
    if (data.count) {
      summaryText += `Total Pesanan: ${data.count}\n`;
    } else if (summary.total_orders) {
      summaryText += `Total Pesanan: ${summary.total_orders}\n`;
    }
    
    if (summary.total_amount)
      summaryText += `Total Nilai: Rp${summary.total_amount.toLocaleString()}\n`;
    if (summary.pending_orders)
      summaryText += `Menunggu: ${summary.pending_orders}\n`;
    if (summary.completed_orders)
      summaryText += `Selesai: ${summary.completed_orders}\n`;

    let plabel = periodLabel || data.filter || null;
    if (orders.length > 0) {
      
      summaryText += `\n🧾 Pesanan Terbaru${data.filter ? ` untuk periode ${plabel}` : ''}:\n`;
      orders.slice(0, 5).forEach((order, idx) => {
        if (order.fullText) {
            const cleanText = stripHtml(order.fullText);
            summaryText += `${idx + 1}. ${cleanText.replace(/\n/g, '\n   ')}\n`;
        } else {
            const status = stripHtml(order.status || "unknown");
            const amount = order.total || order.total_amount || 0;
            summaryText += `${idx + 1}. Order #${order.order_number || order.id} - Rp${Number(amount).toLocaleString()} (${status})\n`;
        }
      });
    } else if (data.filter) {
        summaryText += `\nTidak ada pesanan untuk periode "${plabel}".\n`;
    }

    let followupQuestion = null;
    if (chartData && (chartData.by_day || chartData.by_status)) {
      
        const periodFilter = data.filter ? ` untuk periode ${plabel}` : '';
        followupQuestion = `Apakah Anda mau saya buatkan dashboard grafik ? ${periodFilter}`;
    }

    return {
      trackingNumber: "Summary",
      status: "Ringkasan",
      courier: "N/A",
      history: "",
      fullText: summaryText,
      chartData: chartData,
      followupQuestion: followupQuestion
    };
  }

  // Jika data tracking biasa
  const trackingNumber =
    trackingData.tracking_number || trackingData.awb || trackingData.resi || "-";
  const status = trackingData.status || trackingData.current_status || "unknown";
  const courier = trackingData.courier || trackingData.shipping_courier || "-";
  const history = trackingData.history || trackingData.tracking_history || [];

  let statusText = "";
  switch (status.toLowerCase()) {
    case "pending":
      statusText = "Menunggu pickup";
      break;
    case "picked_up":
      statusText = "Sudah diambil kurir";
      break;
    case "in_transit":
      statusText = "Dalam perjalanan";
      break;
    case "out_for_delivery":
      statusText = "Sedang diantar";
      break;
    case "delivered":
      statusText = "Terkirim";
      break;
    case "failed":
      statusText = "Gagal terkirim";
      break;
    default:
      statusText = `Status: ${status}`;
  }

  const historyText =
    history.length > 0
      ? `\nRiwayat:\n${history
          .slice(-3)
          .map((h) => `• ${h.timestamp || h.date || "-"}: ${h.description || h.status}`)
          .join("\n")}`
      : "";

  return {
    trackingNumber,
    status: statusText,
    courier,
    history: historyText,
    fullText: `Resi: ${trackingNumber}\nKurir: ${courier}\nStatus: ${statusText}${historyText}`,
  };
}

export function renderAsciiChart(chartData) {
  if (!chartData) return '';

  const by_day = chartData.by_day ? Object.values(chartData.by_day)[0] : [];
  let chartText = '📈 Grafik Pesanan?\n\n';

  if (by_day && Array.isArray(by_day) && by_day.length > 0) {
    chartText += 'Pesanan per Hari:\n';
    const maxCount = Math.max(...by_day.map(d => d.count));
    const scale = 10 / (maxCount > 0 ? maxCount : 10);

    by_day.forEach(day => {
      const bar = '█'.repeat(Math.max(1, Math.round(day.count * scale)));
      const total = `Rp${Number(day.total || 0).toLocaleString()}`;
      chartText += `${day.date}: [${bar}] (${day.count} pesanan, ${total})\n`;
    });
  } else {
    chartText += 'Tidak ada data harian untuk ditampilkan.\n';
  }

  return chartText;
}
