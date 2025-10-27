// utils/userIntent.js
import stringSimilarity from "string-similarity";

/**
 * Deteksi apakah user menunjukkan persetujuan / setuju / keinginan (iya, mau, boleh, ok, dll)
 * @param {string} userText - teks dari user
 * @returns {boolean} true jika user menyetujui / ingin
 */
export function userAgrees(userText) {
  if (!userText) return false;

  const text = userText.toLowerCase().trim();

  // Cek dengan regex untuk kata dan typo umum
  const positiveRegex = /(ya+|y\b|ok(e+y*)?|mau+|boleh+|yaboleh+|iy+a*|yok+|sip+|gas+|lanjut+)/i;
  if (positiveRegex.test(text)) return true;

  // Fallback: fuzzy matching (untuk typo berat)
  const positiveWords = [
    "ya", "y", "ok", "oke", "okay", "yaboleh",
    "boleh", "mau", "iya", "yok", "sip", "gas", "lanjut", "setuju", "iyaa", "yess", "yesss", "yap",
    "buat", "lanjutkan", "teruskan", "okeey", "buatkan"
  ];

  const { bestMatch } = stringSimilarity.findBestMatch(text, positiveWords);
  return bestMatch.rating > 0.6;
}

/**
 * Deteksi apakah user menolak / tidak setuju (tidak, ga, engga, nanti, skip, dll)
 * @param {string} userText - teks dari user
 * @returns {boolean} true jika user menolak
 */
export function userRejects(userText) {
  if (!userText) return false;

  const text = userText.toLowerCase().trim();
  const negativeRegex = /(tidak+|ngga+|gak+|ga+|no+|ntar+|nanti+|skip+|jangan+|jgn+|ntar+)/i;
  if (negativeRegex.test(text)) return true;

  const negativeWords = ["tidak", "ga", "ngga", "gak", "no", "nanti", "skip", "jangan", "jgn", "ntar"];
  const { bestMatch } = stringSimilarity.findBestMatch(text, negativeWords);
  return bestMatch.rating > 0.6;
}
