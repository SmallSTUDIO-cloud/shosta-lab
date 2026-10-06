const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 310000;
const SESSION_COOKIE = "shosta_session";
const enc = new TextEncoder();
const dec = new TextDecoder();

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=UTF-8",
      ...securityHeaders(),
      ...extraHeaders,
    },
  });
}

function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join("; "),
  };
}

function parseCookies(request) {
  const raw = request.headers.get("Cookie") || "";
  return Object.fromEntries(raw.split(";").filter(Boolean).map(part => {
    const idx = part.indexOf("=");
    return idx === -1 ? [part.trim(), ""] : [part.slice(0, idx).trim(), part.slice(idx + 1).trim()];
  }));
}

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(normalized);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return base64url(new Uint8Array(digest));
}

async function hashPassword(password, saltBytes = crypto.getRandomValues(new Uint8Array(16)), iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" }, key, 256);
  return {
    hash: base64url(new Uint8Array(bits)),
    salt: base64url(saltBytes),
    iterations,
  };
}

function timingSafeEqual(a, b) {
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < aa.length; i++) diff |= aa[i] ^ bb[i];
  return diff === 0;
}

function validEmail(email) {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validUsername(username) {
  return /^[A-Za-z0-9_.-]{3,30}$/.test(username);
}

function originAllowed(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function cookie(name, value, maxAge) {
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

async function createSession(db, userId) {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const token = base64url(raw);
  const tokenHash = await sha256(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000).toISOString();
  const id = crypto.randomUUID();
  await db.prepare(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(id, userId, tokenHash, expires, now.toISOString()).run();
  return { token, expires };
}

async function currentUser(request, db) {
  if (!db) return null;
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const tokenHash = await sha256(token);
  const row = await db.prepare(`
    SELECT u.id, u.username, u.email, u.created_at, s.expires_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
    LIMIT 1
  `).bind(tokenHash, new Date().toISOString()).first();
  return row || null;
}

function isApi(pathname) {
  return pathname.startsWith("/api/");
}

async function handleApi(request, env) {
  const { pathname } = new URL(request.url);
  if (!originAllowed(request)) return json({ error: "Origin rejected." }, 403);
  if (!env.DB) return json({ error: "Auth database is not configured. Bind a D1 database as DB." }, 503);

  if (request.method === "GET" && pathname === "/api/auth/me") {
    const user = await currentUser(request, env.DB);
    return json({ authenticated: Boolean(user), user: user ? {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.created_at,
    } : null });
  }

  if (request.method === "POST" && pathname === "/api/auth/signup") {
    const body = await request.json().catch(() => null);
    const username = String(body?.username || "").trim();
    const email = String(body?.email || "").trim() || null;
    const password = String(body?.password || "");

    if (!validUsername(username)) return json({ error: "Username must be 3–30 characters using letters, numbers, ., _, or -." }, 400);
    if (!validEmail(email)) return json({ error: "Enter a valid email address or leave email blank." }, 400);
    if (password.length < 10 || password.length > 128) return json({ error: "Password must be 10–128 characters." }, 400);

    const existingUsername = await env.DB.prepare("SELECT id FROM users WHERE username = ? LIMIT 1").bind(username).first();
    if (existingUsername) return json({ error: "That username is already taken." }, 409);
    if (email) {
      const existingEmail = await env.DB.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(email).first();
      if (existingEmail) return json({ error: "That email is already registered." }, 409);
    }

    const passwordData = await hashPassword(password);
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    try {
      await env.DB.prepare(`
        INSERT INTO users (id, username, email, password_hash, password_salt, password_iterations, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(id, username, email, passwordData.hash, passwordData.salt, passwordData.iterations, createdAt).run();
    } catch (error) {
      return json({ error: "Could not create the account. The username or email may already be in use." }, 409);
    }

    const session = await createSession(env.DB, id);
    return json({ ok: true, user: { id, username, email }, }, 201, {
      "Set-Cookie": cookie(SESSION_COOKIE, session.token, SESSION_DAYS * 86400),
    });
  }

  if (request.method === "POST" && pathname === "/api/auth/login") {
    const body = await request.json().catch(() => null);
    const identifier = String(body?.identifier || "").trim();
    const password = String(body?.password || "");
    if (!identifier || !password) return json({ error: "Enter your username or email and password." }, 400);

    const row = identifier.includes("@")
      ? await env.DB.prepare("SELECT * FROM users WHERE email = ? LIMIT 1").bind(identifier).first()
      : await env.DB.prepare("SELECT * FROM users WHERE username = ? LIMIT 1").bind(identifier).first();

    if (!row) return json({ error: "Invalid username/email or password." }, 401);

    const passwordData = await hashPassword(password, fromBase64url(row.password_salt), row.password_iterations);
    if (!timingSafeEqual(passwordData.hash, row.password_hash)) return json({ error: "Invalid username/email or password." }, 401);

    const session = await createSession(env.DB, row.id);
    return json({ ok: true, user: { id: row.id, username: row.username, email: row.email } }, 200, {
      "Set-Cookie": cookie(SESSION_COOKIE, session.token, SESSION_DAYS * 86400),
    });
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    const token = parseCookies(request)[SESSION_COOKIE];
    if (token) {
      const tokenHash = await sha256(token);
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
    }
    return json({ ok: true }, 200, {
      "Set-Cookie": cookie(SESSION_COOKIE, "", 0),
    });
  }

  return json({ error: "Not found." }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (isApi(url.pathname)) {
      return handleApi(request, env);
    }

    const assetResponse = await env.ASSETS.fetch(request);
    const headers = new Headers(assetResponse.headers);
    for (const [key, value] of Object.entries(securityHeaders())) headers.set(key, value);
    return new Response(assetResponse.body, { status: assetResponse.status, headers });
  }
};
