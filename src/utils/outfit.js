const OUTFIT_KEYWORDS = {
  kondangan: ["kondangan", "nikahan", "pernikahan", "wedding"],
  pesta: ["pesta", "party"],
  lebaran: ["lebaran", "idul fitri", "idul adha", "hari raya"],
  casual: ["casual", "santai", "sehari-hari", "main"],
  formal: ["formal", "kerja", "kantor"],
};

export function detectOutfitQuery(text) {
  if (!text) return false;
  const normalized = String(text).toLowerCase();
  return Object.values(OUTFIT_KEYWORDS).flat().some(k => normalized.includes(k));
}

export function extractOutfitKeyword(text) {
  if (!text) return null;
  const normalized = String(text).toLowerCase();
  for (const [key, keywords] of Object.entries(OUTFIT_KEYWORDS)) {
    if (keywords.some(k => normalized.includes(k))) {
      return key;
    }
  }
  return null;
}
