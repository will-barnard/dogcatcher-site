// Tiny fetch wrapper. Cookies carry the session; we also stash the token
// in memory as a Bearer fallback for environments that drop the cookie.
let memToken = null;

export function setToken(t) {
  memToken = t || null;
}

async function req(method, url, body, isForm = false) {
  const headers = {};
  if (memToken) headers['Authorization'] = 'Bearer ' + memToken;
  let payload;
  if (isForm) {
    payload = body; // FormData
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch('/api' + url, {
    method,
    headers,
    credentials: 'include',
    body: payload,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = (data && data.error) || res.statusText || 'Request failed';
    throw new Error(msg);
  }
  return data;
}

export const api = {
  get: (u) => req('GET', u),
  post: (u, b) => req('POST', u, b),
  put: (u, b) => req('PUT', u, b),
  del: (u) => req('DELETE', u),
  upload: (u, formData) => req('POST', u, formData, true),
};
