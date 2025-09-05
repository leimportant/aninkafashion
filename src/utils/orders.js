export function detectOrderQuery(text) {
  if (!text) return false;
  const normalized = String(text).toLowerCase();
  const orderKeywords = [
    'order', 'pesanan', 'tracking', 'lacak', 'status', 'resi', 'no resi',
    'kirim', 'terima', 'diterima', 'proses', 'dalam proses', 'selesai',
    'belum bayar', 'bayar', 'pembayaran', 'paid', 'dibayar', 'sudah bayar',
    'order id', 'order number', 'nomor pesanan', 'invoice', 'faktur'
  ];
  return orderKeywords.some(k => normalized.includes(k));
}

export function extractOrderNumber(text) {
  if (!text) return null;
  // Pattern untuk order number (biasanya kombinasi huruf dan angka)
  const patterns = [
    /order\s*(?:id|number|no)?\s*[#:]?\s*([A-Z0-9]{6,12})/i,
    /(?:order|pesanan)\s*[#:]?\s*([A-Z0-9]{6,12})/i,
    /([A-Z]{2,4}\d{6,10})/i, // Pattern umum: 2-4 huruf + 6-10 angka
    /(\d{6,12})/ // Fallback: 6-12 digit angka
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function fetchOrderStatus({ baseUrl, orderNumber, headers }) {
  if (!orderNumber || !baseUrl) return null;
  
  const url = `${baseUrl.replace(/\/$/, '')}/api/orders/status?q=${encodeURIComponent(orderNumber)}`;
  try {
    const res = await fetch(url, { 
      headers, 
      signal: AbortSignal.timeout(10_000) 
    });
    
    if (!res.ok) {
      console.log(`Order status fetch failed: ${res.status}`);
      return null;
    }
    
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('fetchOrderStatus error:', error);
    return null;
  }
}

export function formatOrderStatus(orderData) {
  if (!orderData) return null;
  
  const status = orderData.status || orderData.order_status || 'unknown';
  const orderNumber = orderData.order_number || orderData.order_id || orderData.id;
  const items = orderData.items || orderData.order_items || [];
  const total = orderData.total || orderData.total_amount || 0;
  const shipping = orderData.shipping_info || orderData.shipping || {};
  

  let statusText = '';
  // pastikan status di-convert ke string supaya bisa di-lowercase
  switch (String(status).toLowerCase()) {
    case '1':
    case '2':
    case 'menunggu':
    case 'menunggu_pembayaran':
      statusText = 'Menunggu pembayaran';
      break;
  
    case '3':
    case 'menunggu_konfirmasi':
      statusText = 'Menunggu konfirmasi';
      break;
  
    case '4':
    case 'processing':
    case 'diproses':
    case 'on_progress':
      statusText = 'Sedang diproses';
      break;
  
    case '5':
    case 'packed':
      statusText = 'Sudah dikemas';
      break;
  
    case '6':
    case 'delivered':
    case 'diterima':
    case 'done':
      statusText = 'Pesanan selesai';
      break;
  
    case '7':
    case 'cancelled':
    case 'dibatalkan':
    case 'cancel':
      statusText = 'Pesanan dibatalkan';
      break;
  
    case '8':
    case 'confirm_cancel':
      statusText = 'Konfirmasi pembatalan';
      break;
  
    case '9':
    case 'shipped':
    case 'dikirim':
      statusText = 'Pesanan dikirim';
      break;
  
    case '10':
    case 'approved':
      statusText = 'Pesanan disetujui';
      break;
  
    case '11':
    case 'rejected':
      statusText = 'Pesanan ditolak';
      break;
  
    case 'paid':
    case 'dibayar':
      statusText = 'Pembayaran diterima';
      break;
  
    default:
      statusText = `Status: ${status}`;
  }
  

  const itemList = items.map(item => 
    `${item.product_name || item.name} (${item.quantity || 1} pcs)`
  ).join(', ');
  
  const trackingInfo = shipping.tracking_number ? 
    `\nResi: ${shipping.tracking_number}` : '';
  
  return {
    orderNumber,
    status: statusText,
    items: itemList,
    total: `Rp${total.toLocaleString()}`,
    tracking: trackingInfo,
    fullText: `Order #${orderNumber}\n${statusText}\nItems: ${itemList}\nTotal: Rp${total.toLocaleString()}${trackingInfo}`
  };
}

export function detectTrackingQuery(text) {
  if (!text) return false;
  const normalized = String(text).toLowerCase();
  const summaryOrderKeywords = [
    'bulan ini', 'bulan lalu', 'minggu ini', 'hari ini', 'summary', 'ringkasan', "semua", "all"
  ];
  return summaryOrderKeywords.some(k => normalized.includes(k));
}

export function extractTrackingNumber(text) {
  if (!text) return null;
  // Pattern untuk tracking number atau query summary
  const patterns = [
    /resi\s*[#:]?\s*([A-Z0-9]{10,20})/i,
    /tracking\s*[#:]?\s*([A-Z0-9]{10,20})/i,
    /awb\s*[#:]?\s*([A-Z0-9]{10,20})/i,
    /([A-Z]{2,4}\d{8,12})/i, // Pattern umum tracking number
    /(\d{10,20})/ // Fallback: 10-20 digit angka
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function fetchTrackingInfo({ baseUrl, query, headers }) {
  if (!baseUrl) return null;
  
  // Use orders/summary endpoint for tracking/summary queries
  const url = `${baseUrl.replace(/\/$/, '')}/api/orders/summary?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { 
      headers, 
      signal: AbortSignal.timeout(10_000) 
    });
    
    if (!res.ok) {
      console.log(`Tracking/summary fetch failed: ${res.status}`);
      return null;
    }
    
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('fetchTrackingInfo error:', error);
    return null;
  }
}

export function formatTrackingInfo(trackingData) {
  if (!trackingData) return null;
  
  // Handle both tracking and summary data
  if (trackingData.summary || trackingData.orders) {
    // This is summary data
    const summary = trackingData.summary || {};
    const orders = trackingData.orders || [];
    
    let summaryText = 'Ringkasan Pesanan:\n';
    if (summary.total_orders) summaryText += `Total Pesanan: ${summary.total_orders}\n`;
    if (summary.total_amount) summaryText += `Total Nilai: Rp${summary.total_amount.toLocaleString()}\n`;
    if (summary.pending_orders) summaryText += `Menunggu: ${summary.pending_orders}\n`;
    if (summary.completed_orders) summaryText += `Selesai: ${summary.completed_orders}\n`;
    
    if (orders.length > 0) {
      summaryText += '\nPesanan Terbaru:\n';
      orders.slice(0, 5).forEach((order, idx) => {
        const status = order.status || 'unknown';
        const amount = order.total || order.total_amount || 0;
        summaryText += `${idx + 1}. Order #${order.order_number || order.id} - Rp${amount.toLocaleString()} (${status})\n`;
      });
    }
    
    return {
      trackingNumber: 'Summary',
      status: 'Ringkasan',
      courier: 'N/A',
      history: '',
      fullText: summaryText
    };
  }
  
  // Handle traditional tracking data
  const trackingNumber = trackingData.tracking_number || trackingData.awb || trackingData.resi;
  const status = trackingData.status || trackingData.current_status || 'unknown';
  const history = trackingData.history || trackingData.tracking_history || [];
  const courier = trackingData.courier || trackingData.shipping_courier || 'Unknown';
  
  let statusText = '';
  switch (status.toLowerCase()) {
    case 'pending':
      statusText = 'Menunggu pickup';
      break;
    case 'picked_up':
      statusText = 'Sudah diambil kurir';
      break;
    case 'in_transit':
      statusText = 'Dalam perjalanan';
      break;
    case 'out_for_delivery':
      statusText = 'Sedang diantar';
      break;
    case 'delivered':
      statusText = 'Terkirim';
      break;
    case 'failed':
      statusText = 'Gagal terkirim';
      break;
    default:
      statusText = `Status: ${status}`;
  }
  
  const historyText = history.length > 0 ? 
    `\nRiwayat:\n${history.slice(-3).map(h => 
      `• ${h.timestamp || h.date}: ${h.description || h.status}`
    ).join('\n')}` : '';
  
  return {
    trackingNumber,
    status: statusText,
    courier,
    history: historyText,
    fullText: `Resi: ${trackingNumber}\nKurir: ${courier}\nStatus: ${statusText}${historyText}`
  };
}
  