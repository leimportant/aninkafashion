import crypto from 'crypto';

// These functions are helpers and do not need to be exported
function getCookieValue(cookieHeader, name) {
  if (!cookieHeader || !name) return null;
  const parts = cookieHeader.split(/;\s*/);
  for (const part of parts) {
    const [k, ...rest] = part.split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}

function decryptLaravelCookie(cookie) {
  if (!cookie) return null;
  try {
    const payload = JSON.parse(Buffer.from(cookie, 'base64').toString());
    const iv = Buffer.from(payload.iv, 'base64');
    const value = Buffer.from(payload.value, 'base64');
    const mac = payload.mac;

    let appKey = process.env.ANINKA_APP_KEY;
    if (!appKey) {
      throw new Error('APP_KEY not found in environment variables.');
    }

    const decodedAppKey = Buffer.from(appKey.replace('base64:', ''), 'base64');
    const encryptionKey = decodedAppKey;

    const expectedMac = crypto
      .createHmac('sha256', encryptionKey)
      .update(payload.iv + payload.value)
      .digest('hex');
    if (expectedMac !== mac) {
      throw new Error('Invalid MAC — possible tampering or wrong APP_KEY.');
    }

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

function extractAuthToken(cookie) {
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


// This is the new, single, and correct function for server-side use.
export function getAuthHeaders(reqHeaders, reqCookies) {
  // 1. Check for a bearer token in the Authorization header
  const authHeader = reqHeaders?.Authorization || reqHeaders?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    
    const bearerToken = authHeader.split(' ').pop();
    console.log('bearerToken from Authorization header', bearerToken);
    return {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    };
  }

  // 2. Fallback: Check for the token in the cookies
  const cookieToken = reqCookies?.['aninkafashion-token'] || reqCookies?.['aninkafashion_token'] || reqCookies?.['TOKEN'];
  if (cookieToken) {
    let bearerToken;
    if (cookieToken.includes('|')) {
      bearerToken = cookieToken;
    } else {
      const decrypted = decryptLaravelCookie(cookieToken);
      if (!decrypted) return {};
      const parts = decrypted.split('|');
      if (parts.length === 3) bearerToken = `${parts[1]}|${parts[2]}`;
      else if (parts.length === 2) bearerToken = `${parts[0]}|${parts[1]}`;
      else bearerToken = decrypted;
    }
    console.log('bearerToken from cookie', bearerToken);
    if (bearerToken) {
      return {
        Authorization: `Bearer ${bearerToken}`,
        'Content-Type': 'application/json',
      };
    }
  }

  // 3. Final Fallback: Check the Laravel encrypted session cookie
  const cookieName = process.env.ANINKA_COOKIE_NAME || 'aninka_session';
  const enc = reqCookies?.[cookieName];
  if (enc) {
    const token = extractAuthToken(enc);
    if (token) {
      console.log('token from session', token);
      return {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };
    }
  }

  // If no valid token is found anywhere, return empty headers
  return {};
}

// These functions are no longer needed, as their logic is now in getAuthHeaders
// You can remove them to clean up your code.
export function getAuthHeadersFromCookieHeader() {
  console.warn("getAuthHeadersFromCookieHeader is deprecated. Use getAuthHeaders instead.");
  return {};
}

export function getAuthHeadersFromCookieValue() {
  console.warn("getAuthHeadersFromCookieValue is deprecated. Use getAuthHeaders instead.");
  return {};
}
export function getAuthHeadersFromCookieMap() {
  console.warn("getAuthHeadersFromCookieMap is deprecated. Use getAuthHeaders instead.");
  return {};
}
