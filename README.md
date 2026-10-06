# Shosta Lab Website

A responsive single-page Shosta Lab site with a Google/Android-tabs-inspired 3-second `P animation`, animated repelling dot field, project detail views, PalmLink release list, social/contact/FAQ sections, and Cloudflare Worker + D1 authentication.

## Stack

- Static HTML/CSS/JS in `public/`
- Cloudflare Workers Static Assets for hosting
- Cloudflare Worker API in `src/index.js`
- Cloudflare D1 for users and sessions
- Web Crypto PBKDF2 password hashing
- HttpOnly Secure SameSite cookies for sessions
- No frontend framework and no runtime dependencies

Cloudflare's current Workers documentation recommends Workers Static Assets for full-stack sites and supports an Assets binding alongside Worker code. D1 can be bound to a Worker and managed with versioned SQL migrations. See the official docs linked below.

## First-time Cloudflare setup

1. Create a Worker project from this folder.
2. Create a D1 database named `shosta_lab`.
3. Copy the generated D1 database ID into `wrangler.toml` in place of `REPLACE_WITH_YOUR_D1_DATABASE_ID`.
4. Apply the migration:

```bash
npx wrangler d1 migrations apply shosta_lab --remote
```

5. Deploy:

```bash
npx wrangler deploy
```

6. Attach your custom domain in Cloudflare and keep DNS/HTTPS under the same Cloudflare zone.

## PalmLink APK releases

Edit `public/site-config.js` and add entries to `projects.palmlinkReleases`. Example:

```js
{
  version: "0.4.1",
  name: "PalmLink 0.4.1",
  size: "12.8 MB",
  notes: "Visual feedback + gallery auto-save.",
  url: "/downloads/PalmLink-0.4.1.apk"
}
```

Put the matching APK inside `public/downloads/` before deployment. Do not invent a download URL: the initial config deliberately shows a non-downloadable `0.4.0` entry because no actual APK file was provided to this build.

## Auth behavior

Signup uses a required username, optional email, and password. Login accepts either username or email. Passwords are never stored in plaintext. The Worker derives a PBKDF2-SHA-256 password hash and stores the hash/salt in D1; session tokens are random and only their SHA-256 hash is stored in D1.

For a larger public service, add abuse/rate limiting, account recovery, email verification, and privacy/terms pages before broad public launch.

## SEO/AEO/GEO foundation

Included:

- Unique title and description by view
- Open Graph + Twitter metadata
- `Organization`, `WebSite`, `WebApplication` and `SoftwareApplication` JSON-LD
- Semantic headings and direct answer-style site copy
- Robots and sitemap files
- Favicon and manifest
- Canonical URL management
- Mobile-first responsive layout
- Fast, dependency-light front end

The generated sitemap intentionally contains only `/` until a final production domain and crawlable route strategy are confirmed.

## Testing

Run:

```bash
npm run check
```

This performs a JavaScript syntax check of the Worker. Full production auth and browser animation testing still requires deployment or a local Cloudflare Worker/D1 environment.

## Source-derived project facts

Brand//Grade content in the UI follows the currently published page at `https://smallstudio-cloud.github.io/`, including its five scoring dimensions and its informational-score disclaimer. PalmLink wording is based on the supplied project context and assets.
