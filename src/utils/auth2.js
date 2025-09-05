import crypto from 'crypto';

export function getCookieValue(cookieHeader, name) {
  if (!cookieHeader || !name) return null;
  const parts = cookieHeader.split(/;\s*/);
  for (const part of parts) {
    const [k, ...rest] = part.split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

export function decryptLaravelCookie(cookie) {
  if (!cookie) return null;
  try {
    const payload = JSON.parse(Buffer.from(cookie, 'base64').toString());
    const iv = Buffer.from(payload.iv, 'base64');
    const value = Buffer.from(payload.value, 'base64');
    const mac = payload.mac;

    let appKey = process.env.ANINKA_APP_KEY;
    if (!appKey) throw new Error('APP_KEY not found in environment variables.');

    const decodedAppKey = Buffer.from(appKey.replace('base64:', ''), 'base64');
    const encryptionKey = decodedAppKey;

    const expectedMac = crypto
      .createHmac('sha256', encryptionKey)
      .update(payload.iv + payload.value)
      .digest('hex');
    if (expectedMac !== mac) throw new Error('Invalid MAC — possible tampering or wrong APP_KEY.');

    const decipher = crypto.createDecipheriv('aes-256-cbc', encryptionKey, iv);
    decipher.setAutoPadding(true);
    let decrypted = decipher.update(value, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Laravel cookie decryption error:', error);
    return null;
  }
}

export function extractAuthToken(cookie) {
  const decrypted = decryptLaravelCookie(cookie);
  if (!decrypted) return null;
  try {
    const parts = decrypted.split('|');
    let bearerToken;
    if (parts.length === 3) {
      bearerToken = `${parts[1]}|${parts[2]}`;
    } else if (parts.length === 2) {
      bearerToken = `${parts[0]}|${parts[1]}`;
    } else {
      bearerToken = decrypted;
    }
    if (bearerToken) return bearerToken;
    return null;
  } catch (error) {
    console.error('Error extracting auth token:', error);
    return null;
  }
}

export function getAuthHeadersFromCookieHeader(cookieHeader) {
  const cookieName = process.env.ANINKA_COOKIE_NAME || 'aninka_session';
  const enc = getCookieValue(cookieHeader || '', cookieName);
  if (!enc) return {};
  const token = extractAuthToken(enc);
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function getAuthHeadersFromCookieValue(cookieValue) {
  if (!cookieValue) return {};
  const token = extractAuthToken(cookieValue);
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function getAuthHeadersFromCookieMap(cookies = {}) {
 
  const cookieToken = cookies['aninkafashion-token'] || cookies['aninkafashion_token'] || cookies['TOKEN'];
  if (!cookieToken) {
    cookieToken = localStorage.getItem('aninkafashion-token');
  }

  if (cookieToken) {
  
    let bearerToken;
    if (cookieToken.includes('|')) {
      bearerToken = cookieToken;
    } else {
      const decrypted = decryptLaravelCookie(cookieToken);
      if (!decrypted) {
        return {};
      }
      const parts = decrypted.split('|');
      if (parts.length === 3) bearerToken = `${parts[1]}|${parts[2]}`;
      else if (parts.length === 2) bearerToken = `${parts[0]}|${parts[1]}`;
      else bearerToken = decrypted;
    }

    console.log('bearerToken', bearerToken);
    if (bearerToken) {
      return {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      };
    }
  }

  // If no token is found in cookies, check localStorage

  // Fallback to Laravel encrypted session cookie
  const cookieName = process.env.ANINKA_COOKIE_NAME || 'aninka_session';
  const enc = cookies[cookieName];
  if (!enc) return {};
  const token = extractAuthToken(enc);
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}


