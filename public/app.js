(() => {
  const config = window.SH0STA_CONFIG;
  const app = document.getElementById("app");
  const transition = document.getElementById("p-transition");
  const targetLabel = document.getElementById("p-target-label");
  const toastRegion = document.getElementById("toast-region");
  const accountBtn = document.getElementById("account-btn");
  const authGreeting = document.getElementById("auth-greeting");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  let currentView = "home";
  let user = null;
  let authMode = "signup";
  let transitionBusy = false;

  const icon = {
    instagram: `<svg class="social-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor"/></svg>`,
    facebook: `<svg class="social-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.2 21v-8h2.7l.4-3h-3.1V8.1c0-.9.3-1.5 1.6-1.5h1.8V4a23 23 0 0 0-2.7-.2c-2.7 0-4.5 1.6-4.5 4.5V10H8v3h2.4v8h3.8Z" fill="currentColor"/></svg>`,
    mail: `<svg class="social-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="m5 7 7 5 7-5" stroke="currentColor" stroke-width="1.7"/></svg>`,
    arrow: `→`,
    back: `←`
  };

  const views = {
    home: homeView,
    brandgrade: brandGradeView,
    palmlink: palmLinkView,
    auth: authView,
  };

  function navTargetLabel(view) {
    return ({home:"Shosta Lab", brandgrade:"Brand//Grade", palmlink:"PalmLink", auth:"Access"}[view] || "Project");
  }

  function showToast(message, detail = "") {
    const el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = `<strong>${escapeHTML(message)}</strong>${detail ? `<small>${escapeHTML(detail)}</small>` : ""}`;
    toastRegion.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>'"]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[char]));
  }

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  async function loadSession() {
    try {
      const data = await api("/api/auth/me", { method: "GET", headers: {} });
      user = data.user || null;
    } catch {
      user = null;
    }
    updateAccountUI();
  }

  function updateAccountUI() {
    if (user) {
      authGreeting.hidden = false;
      authGreeting.textContent = `@${user.username}`;
      accountBtn.textContent = "Account / log out";
    } else {
      authGreeting.hidden = true;
      accountBtn.textContent = "Sign up / Log in";
    }
  }

  function setViewMeta(view) {
    const titles = {
      home: "Shosta Lab — We build weird useful things.",
      brandgrade: "Brand//Grade — Business Name Intelligence | Shosta Lab",
      palmlink: "PalmLink — Gesture-driven screenshot transfer | Shosta Lab",
      auth: "Shosta Lab Access — Sign up or log in"
    };
    const descriptions = {
      home: "Shosta Lab builds useful experiments, apps and technology projects. Explore PalmLink, Brand//Grade and future releases.",
      brandgrade: "Explore Brand//Grade, a business-name analyzer, generator and comparison tool built as a Shosta Lab project.",
      palmlink: "Explore PalmLink, the Android gesture-driven screenshot transfer app from Shosta Lab, with release information and download slots.",
      auth: "Create a Shosta Lab account or log in with your username or email."
    };
    document.title = titles[view];
    document.querySelector('meta[name="description"]')?.setAttribute("content", descriptions[view]);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = window.location.origin + (view === "home" ? "/" : `/projects/${view}/`);
    const ld = document.getElementById("structured-data");
    if (ld) {
      const base = window.location.origin;
      const graph = JSON.parse(ld.textContent);
      graph["@graph"][0].url = base + "/";
      graph["@graph"][0].logo = base + "/assets/shosta-mark.png";
      graph["@graph"][1].url = base + "/";
      graph["@graph"][2].url = config.projects.brandGradeUrl;
      graph["@graph"][3].url = base + "/projects/palmlink/";
      ld.textContent = JSON.stringify(graph);
    }
  }

  async function navigate(view, options = {}) {
    if (!views[view]) view = "home";
    if (currentView === view && !options.force) {
      if (view === "home" && options.scroll) scrollToSection(options.scroll);
      return;
    }
    if (transitionBusy) return;
    const animate = options.animate !== false && !reducedMotion;
    const label = navTargetLabel(view);
    if (!animate) {
      renderView(view);
      history.pushState({view}, "", options.url || routeFor(view));
      return;
    }

    transitionBusy = true;
    targetLabel.textContent = label;
    transition.classList.add("is-active");
    await sleep(3000);
    renderView(view);
    history.pushState({view}, "", options.url || routeFor(view));
    transition.classList.remove("is-active");
    transitionBusy = false;
    window.scrollTo({ top:0, behavior:"instant" });
  }

  function routeFor(view) {
    return view === "home" ? "/" : (view === "brandgrade" ? "/projects/brand-grade/" : view === "palmlink" ? "/projects/palmlink/" : "/access/");
  }

  function viewFromPath() {
    const p = location.pathname;
    if (p.includes("brand-grade")) return "brandgrade";
    if (p.includes("palmlink")) return "palmlink";
    if (p.includes("access")) return "auth";
    return "home";
  }

  function renderView(view) {
    currentView = view;
    app.innerHTML = views[view]();
    setViewMeta(view);
    wireCurrentView();
    requestAnimationFrame(() => app.focus({preventScroll:true}));
  }

  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (!target) return;
    const top = target.getBoundingClientRect().top + window.scrollY - 84;
    window.scrollTo({top, behavior: reducedMotion ? "auto" : "smooth"});
  }

  function wireCurrentView() {
    app.querySelectorAll("[data-nav]").forEach(btn => {
      btn.addEventListener("click", () => navigate(btn.dataset.nav));
    });
    app.querySelectorAll("[data-scroll]").forEach(btn => {
      btn.addEventListener("click", () => scrollToSection(btn.dataset.scroll));
    });
  }

  function homeView() {
    return `
      <div class="view">
        <section class="hero" id="home" aria-labelledby="hero-title">
          <div class="hero-grid">
            <div>
              <div class="eyebrow"><span class="live-dot"></span> independent digital lab · 2026</div>
              <h1 id="hero-title">We build <span>weird useful things.</span></h1>
              <p class="hero-copy">Shosta Lab is a small experimental studio for apps, AI, interfaces and ideas that are too useful to stay as ideas.</p>
              <div class="hero-actions">
                <button class="primary-btn" data-scroll="projects">Explore projects ${icon.arrow}</button>
                <button class="secondary-btn" data-nav="palmlink">See PalmLink</button>
              </div>
              <div class="hero-meta">
                <div class="hero-stat"><strong>02</strong><span>public projects</span></div>
                <div class="hero-stat"><strong>01</strong><span>Android app</span></div>
                <div class="hero-stat"><strong>∞</strong><span>ideas left</span></div>
              </div>
            </div>
            <div class="hero-stage" aria-hidden="true">
              <div class="orbit"></div>
              <div class="identity-card">
                <div class="identity-grid"></div>
                <div class="identity-main">
                  <div class="identity-top">
                    <div class="identity-mini">
                      <img src="/assets/shosta-mark.png" alt="">
                      <div><strong>SHOSTA LAB</strong><span>studio / experiments</span></div>
                    </div>
                    <div class="identity-chip">Build 001</div>
                  </div>
                  <div class="identity-title">IDEAS<br><span>IN MOTION.</span></div>
                  <div class="identity-bottom"><span>Apps · AI · Tech · Experiments</span><span class="identity-signal"><span class="signal-bars"><i></i><i></i><i></i><i></i></span>online</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="section" id="projects" aria-labelledby="projects-title">
          <div class="section-head">
            <div><div class="kicker">Selected work</div><h2 class="section-title" id="projects-title">My Projects</h2></div>
            <p class="section-copy">Two real projects are public now. The next card is deliberately waiting for something worth shipping.</p>
          </div>
          <div class="project-grid">
            <button class="project-card featured" data-nav="palmlink" aria-label="Open PalmLink project">
              <div class="card-bg card-grid"></div><div class="card-bg card-glow"></div>
              <div class="project-body">
                <div>
                  <div class="project-top">
                    <div class="project-brand"><img class="project-logo palmlink" src="/assets/palmlink-logo.png" alt="PalmLink logo"><div><div style="font-weight:850">PalmLink</div><div style="color:#70809a;font-size:10px;margin-top:3px">Android app · 0.4.x</div></div></div>
                    <span class="project-tag">Featured</span>
                  </div>
                  <div class="project-name">Screenshots.<br><span style="color:#4aa1ff">Without touch.</span></div>
                  <p class="project-description">Gesture-driven screenshot capture and two-phone transfer, built around open-palm and fist interactions.</p>
                  <div class="palmlink-visual">
                    <div class="phone phone-a"><div class="phone-screen"></div></div>
                    <div class="phone phone-b"><div class="phone-screen"></div></div>
                    <div class="transfer-arc"></div><div class="transfer-dot"></div>
                    <img class="phone-icon" src="/assets/palmlink-logo.png" alt="">
                  </div>
                </div>
                <div class="project-footer"><span class="project-micro">gesture · capture · transfer</span><span class="arrow-button">Open project ${icon.arrow}</span></div>
              </div>
            </button>

            <button class="project-card secondary" data-nav="brandgrade" aria-label="Open Brand Grade project">
              <div class="card-bg card-grid"></div><div class="card-bg card-glow"></div>
              <div class="project-body">
                <div>
                  <div class="project-top"><div><div class="bg-logo">BRAND//GRADE<span>Business Name Intelligence</span></div></div><span class="project-tag">Web app</span></div>
                  <p class="project-description" style="margin-top:28px">Analyze, compare and generate business names with a compact five-dimension scoring system.</p>
                  <div class="brandgrade-visual">
                    <div><div style="color:#7e8ca1;font-size:9px;text-transform:uppercase;letter-spacing:.18em">Example score</div><div style="font-size:17px;margin-top:8px">MEMORY · CLARITY · UNIQUE</div></div>
                    <div class="score-orb"><div><strong>86</strong><span>overall</span></div></div>
                  </div>
                </div>
                <div class="project-footer"><span class="project-micro">analyze · generate · compare</span><span class="arrow-button">Open project ${icon.arrow}</span></div>
              </div>
            </button>

            <button class="project-card more" data-nav="home" aria-label="More projects coming soon">
              <div class="card-bg card-grid"></div>
              <div class="project-body more-card">
                <div>
                  <div class="kicker">Next</div><div class="project-name" style="font-size:42px">More projects<br><span style="color:#618ffc">coming soon.</span></div>
                  <p class="project-description">New experiments stay unpublished until they earn their place here. A surprisingly useful filter against shipping nonsense.</p>
                </div>
                <div class="more-visual" aria-hidden="true"></div>
              </div>
            </button>
          </div>
        </section>

        <section class="section" id="about" aria-labelledby="about-title">
          <div class="section-head"><div><div class="kicker">Why the lab exists</div><h2 class="section-title" id="about-title">Small team.<br>Big curiosity.</h2></div><p class="section-copy">Shosta Lab focuses on practical software, experiments and polished interfaces. The goal is not to look busy. The goal is to make things that deserve attention.</p></div>
          <div class="about-grid">
            <article class="panel"><h3>What is Shosta Lab?</h3><p>Shosta Lab is an independent digital studio building and testing useful software concepts across apps, AI, interfaces and emerging technology.</p><div class="feature-list"><div class="feature-item"><strong>Build</strong><span>Turn concepts into usable products.</span></div><div class="feature-item"><strong>Experiment</strong><span>Prototype without pretending every idea is final.</span></div><div class="feature-item"><strong>Polish</strong><span>Make the useful thing feel good to use.</span></div><div class="feature-item"><strong>Share</strong><span>Publish projects, releases and lessons.</span></div></div></article>
            <article class="panel"><h3>What we care about</h3><p>Clear UX, responsible engineering, responsive design, fast feedback loops and technology that solves a real problem before it earns another layer of decoration.</p><div class="feature-list"><div class="feature-item"><strong>Human first</strong><span>Interactions should explain themselves.</span></div><div class="feature-item"><strong>Mobile ready</strong><span>Small screens are not an afterthought.</span></div><div class="feature-item"><strong>Secure by default</strong><span>Credentials belong on the server.</span></div><div class="feature-item"><strong>Built to grow</strong><span>Simple architecture first, complexity only when earned.</span></div></div></article>
          </div>
        </section>

        <section class="section" id="contact" aria-labelledby="contact-title">
          <div class="section-head"><div><div class="kicker">Talk to the lab</div><h2 class="section-title" id="contact-title">Contact + FAQ</h2></div><p class="section-copy">Ideas, bugs, feedback or collaboration notes all go to the same inbox. Humans remain stubbornly useful for this part.</p></div>
          <div class="contact-grid">
            <article class="panel contact-card"><div><h3>Contact Shosta Lab</h3><p>Use whichever channel is easiest.</p></div><div class="contact-links"><a class="social-link" href="mailto:${config.social.email}">${icon.mail} ${config.social.email}</a><a class="social-link" href="${config.social.instagram}" target="_blank" rel="noopener noreferrer">${icon.instagram} @shosta_lab</a><a class="social-link" href="${config.social.facebook}" target="_blank" rel="noopener noreferrer">${icon.facebook} Facebook</a></div></article>
            <article class="panel"><h3>Frequently asked</h3><div class="faq-list"><details><summary>What does Shosta Lab build?</summary><p>Apps, web tools, AI experiments, interfaces and other digital products that are useful enough to ship.</p></details><details><summary>What is PalmLink?</summary><p>PalmLink is an Android app project for gesture-driven screenshot capture and transfer between phones.</p></details><details><summary>Where can I try Brand//Grade?</summary><p>Use the project page here, then open Brand//Grade directly at ${config.projects.brandGradeUrl}.</p></details></div></article>
          </div>
        </section>
      </div>
      ${footer()}
    `;
  }

  function brandGradeView() {
    return `
      <div class="view">
        <section class="detail-hero"><button class="back-btn" data-nav="home">${icon.back} Return to homepage</button><div class="detail-grid">
          <div class="detail-copy"><div class="kicker">Shosta Lab · project 01</div><h1>Brand//<span style="color:#5e93ff">Grade.</span></h1><p>Business Name Intelligence for people who need a name that works in the real world. Brand//Grade analyzes memorability, brand strength, clarity, uniqueness and pronunciation, then helps users generate and compare alternatives.</p><div class="hero-actions"><a class="primary-btn" href="${config.projects.brandGradeUrl}" target="_blank" rel="noopener noreferrer">Try it yourself ${icon.arrow}</a><button class="secondary-btn" data-nav="home">Back to projects</button></div></div>
          <div class="detail-visual"><div class="browser-mock"><div class="browser-head"><i></i><i></i><i></i><div class="browser-url">smallstudio-cloud.github.io</div></div><div class="browser-content"><div class="bg-browser-logo">BRAND//GRADE</div><div class="bg-browser-sub">Business Name Intelligence</div><div class="mock-input"><span>Enter your business name…</span><b class="mock-button">ANALYZE NAME →</b></div><div class="mock-score"><div class="score-main"><strong>86</strong><span>overall</span></div><div class="score-tile"><span>Memory</span><strong>91</strong></div><div class="score-tile"><span>Brand</span><strong>84</strong></div><div class="score-tile"><span>Clarity</span><strong>88</strong></div></div></div></div></div>
        </div></section>
        <section class="section"><div class="section-head"><div><div class="kicker">Capabilities</div><h2 class="section-title">Name it.<br>Test it.</h2></div><p class="section-copy">The live project currently exposes analyzer, generator, comparison, preview and saved-name flows in the browser.</p></div><div class="about-grid"><article class="panel"><h3>What it does</h3><p>Brand//Grade is a free browser-based business name analyzer, generator and checker for startups, products, shops, apps, agencies and creators.</p><div class="feature-list"><div class="feature-item"><strong>Analyze</strong><span>Five practical naming dimensions.</span></div><div class="feature-item"><strong>Generate</strong><span>Create multiple directions from a business concept.</span></div><div class="feature-item"><strong>Compare</strong><span>See two names side by side.</span></div><div class="feature-item"><strong>Preview</strong><span>See a simple visual identity direction.</span></div></div></article><article class="panel"><h3>Important limitation</h3><p>A score is an informational naming assessment. It does not prove trademark, company registration, domain or social-handle availability. Separate legal and availability checks still matter.</p><div class="hero-actions"><a class="secondary-btn" href="${config.projects.brandGradeUrl}" target="_blank" rel="noopener noreferrer">Open Brand//Grade ${icon.arrow}</a></div></article></div></section>
      </div>
      ${footer()}
    `;
  }

  function palmLinkView() {
    const releases = config.projects.palmlinkReleases || [];
    const releaseHtml = releases.map(r => `
      <div class="release-row"><div><strong>${escapeHTML(r.name)}</strong><br><span>Version ${escapeHTML(r.version)} · ${escapeHTML(r.notes || "")}</span></div><span>${escapeHTML(r.size || "Size unknown")}</span>${r.url ? `<a href="${escapeHTML(r.url)}">Download APK</a>` : `<span class="download-disabled">APK link not configured</span>`}</div>
    `).join("");
    return `
      <div class="view">
        <section class="detail-hero"><button class="back-btn" data-nav="home">${icon.back} Return to homepage</button><div class="detail-grid">
          <div class="detail-copy"><div class="kicker">Shosta Lab · project 02</div><h1>Palm<span style="color:#3b8fff">Link.</span></h1><p>Gesture-driven screenshot transfer for Android. PalmLink is built around open-palm and closed-fist interactions, with capture, transfer and receiving flows designed to reduce touch-heavy steps.</p><div class="hero-actions"><button class="primary-btn" data-scroll="downloads">View APK releases ${icon.arrow}</button><button class="secondary-btn" data-nav="home">Back to projects</button></div><div class="hero-meta"><div class="hero-stat"><strong>Android</strong><span>platform</span></div><div class="hero-stat"><strong>0.4.x</strong><span>current line</span></div><div class="hero-stat"><strong>Gesture</strong><span>control model</span></div></div></div>
          <div class="detail-visual palmlink-detail-visual"><div class="palmlink-stage"><div class="big-phone left"><div class="screen"><img src="/assets/palmlink-logo.png" alt="PalmLink"></div></div><div class="big-phone right"><div class="screen"><img src="/assets/palmlink-logo.png" alt="PalmLink"></div></div><div class="orbit-core"></div><img class="core-logo" src="/assets/palmlink-logo.png" alt=""><div class="screenshot-fly"></div></div></div>
        </div></section>
        <section class="section" id="downloads"><div class="section-head"><div><div class="kicker">Releases</div><h2 class="section-title">PalmLink APKs</h2></div><p class="section-copy">Release metadata is driven from one small config file so you can add future versions without rewriting the page.</p></div><div class="release-grid">${releaseHtml || `<div class="panel"><h3>No releases published yet.</h3><p>Add a release in <code>public/site-config.js</code>.</p></div>`}</div></section>
        <section class="section"><div class="section-head"><div><div class="kicker">Product story</div><h2 class="section-title">Capture.<br>Orbit. Receive.</h2></div><p class="section-copy">The site visual language mirrors the app concept: a blue identity moving between two devices, with a clear status loop around the transfer.</p></div><div class="about-grid"><article class="panel"><h3>Gesture model</h3><p>On the sender, an open palm followed by a closed fist is used to trigger capture. On the receiving phone, a closed fist followed by an open palm authorizes the pending screenshot flow.</p></article><article class="panel"><h3>Visual language</h3><p>Blue glow, circular motion and device-to-device transfer metaphors keep the explanation consistent with the PalmLink identity.</p></article></div></section>
      </div>
      ${footer()}
    `;
  }

  function authView() {
    return `
      <div class="view auth-view">
        <section class="black-hole-shell" aria-labelledby="auth-title">
          <div class="black-hole" id="black-hole-exit" role="button" tabindex="0" aria-label="Click the black hole to exit to the homepage"><div class="horizon-glow"></div></div>
          <div class="auth-panel">
            <div class="auth-tabs" role="tablist" aria-label="Account mode">
              <button class="auth-tab ${authMode === "signup" ? "active" : ""}" data-auth-mode="signup" role="tab" aria-selected="${authMode === "signup"}">Sign up</button>
              <button class="auth-tab ${authMode === "login" ? "active" : ""}" data-auth-mode="login" role="tab" aria-selected="${authMode === "login"}">Log in</button>
            </div>
            <h1 class="auth-title" id="auth-title">${authMode === "signup" ? "Enter the lab." : "Welcome back."}</h1>
            <p class="auth-sub">${authMode === "signup" ? "Create an account using a username and password. Email is optional for this v1 flow." : "Use your username or email with your password."}</p>
            <form id="auth-form" novalidate>
              ${authMode === "signup" ? `<div class="form-field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" minlength="3" maxlength="30" required placeholder="yourname"></div><div class="form-field"><label for="email">Email <span style="opacity:.55">optional</span></label><input id="email" name="email" type="email" autocomplete="email" placeholder="you@example.com"></div>` : `<div class="form-field"><label for="identifier">Username or email</label><input id="identifier" name="identifier" autocomplete="username" required placeholder="yourname or you@example.com"></div>`}
              <div class="form-field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="${authMode === "signup" ? "new-password" : "current-password"}" minlength="10" maxlength="128" required placeholder="10+ characters"></div>
              <div class="form-error" id="auth-error"></div>
              <button class="primary-btn auth-submit" type="submit">${authMode === "signup" ? "Create account" : "Log in"} ${icon.arrow}</button>
            </form>
            ${user ? `<button class="secondary-btn" id="logout-btn" style="width:100%;margin-top:10px">Log out @${escapeHTML(user.username)}</button>` : ""}
          </div>
          <div class="exit-hint">Click the black hole to exit this page</div>
          <div class="auth-foot">Authentication uses a Cloudflare Worker + D1 setup in production. Passwords are hashed server-side with Web Crypto PBKDF2 and sessions use HttpOnly Secure cookies.</div>
        </section>
      </div>
    `;
  }

  function footer() {
    return `<footer><span>© 2026 Shosta Lab</span><span>Apps · AI · Experiments · Technology</span><span>Built to be useful.</span></footer>`;
  }

  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  document.addEventListener("click", (event) => {
    const navBtn = event.target.closest("[data-nav]");
    if (navBtn && !navBtn.closest("#app")) navigate(navBtn.dataset.nav);
    const scrollBtn = event.target.closest("[data-scroll]");
    if (scrollBtn && !scrollBtn.closest("#app")) {
      if (currentView !== "home") navigate("home", {animate: reducedMotion}).then(() => scrollToSection(scrollBtn.dataset.scroll));
      else scrollToSection(scrollBtn.dataset.scroll);
    }
  });

  document.querySelector('[data-nav="home"]')?.addEventListener("click", () => navigate("home"));
  accountBtn.addEventListener("click", () => navigate(user ? "auth" : "auth"));
  window.addEventListener("popstate", () => renderView(viewFromPath()));

  function wireAuth() {
    app.querySelectorAll("[data-auth-mode]").forEach(btn => btn.addEventListener("click", () => {
      authMode = btn.dataset.authMode;
      renderView("auth");
    }));
    const exit = document.getElementById("black-hole-exit");
    if (exit) {
      const leave = () => navigate("home");
      exit.addEventListener("click", leave);
      exit.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); leave(); } });
    }
    const form = document.getElementById("auth-form");
    if (form) form.addEventListener("submit", handleAuthSubmit);
    const logout = document.getElementById("logout-btn");
    if (logout) logout.addEventListener("click", async () => {
      try { await api("/api/auth/logout", {method:"POST",body:"{}"}); user = null; updateAccountUI(); showToast("Logged out", "Session closed on this device."); renderView("auth"); }
      catch (err) { showToast("Logout failed", err.message); }
    });
  }

  async function handleAuthSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const errorEl = document.getElementById("auth-error");
    errorEl.textContent = "";
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const password = String(payload.password || "");
    if (password.length < 10) { errorEl.textContent = "Use at least 10 characters for the password."; return; }
    try {
      const endpoint = authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const result = await api(endpoint, {method:"POST", body:JSON.stringify(payload)});
      user = result.user;
      updateAccountUI();
      showToast(authMode === "signup" ? "Account created" : "Logged in", `Welcome, @${user.username}.`);
      navigate("home");
    } catch (err) {
      errorEl.textContent = err.message;
    }
  }

  const oldWire = wireCurrentView;
  wireCurrentView = function() { oldWire(); if (currentView === "auth") wireAuth(); };

  // Dot background: pointer/touch repulsion, intentionally tiny and restrained for performance.
  const canvas = document.getElementById("dot-field");
  const ctx = canvas.getContext("2d", { alpha:true });
  let dots = [];
  let pointer = {x:-9999,y:-9999,active:false};
  function resizeDots() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(innerWidth * dpr); canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = innerWidth + "px"; canvas.style.height = innerHeight + "px";
    ctx.setTransform(dpr,0,0,dpr,0,0);
    const gap = innerWidth < 620 ? 36 : 44;
    dots = [];
    for (let y=18; y<innerHeight; y+=gap) for (let x=18; x<innerWidth; x+=gap) dots.push({x,y,ox:x,oy:y,vx:0,vy:0});
  }
  function dotLoop() {
    ctx.clearRect(0,0,innerWidth,innerHeight);
    for (const d of dots) {
      let dx = pointer.x - d.x, dy = pointer.y - d.y; const dist = Math.hypot(dx,dy);
      if (pointer.active && dist < 120) {
        const force = (120 - dist) / 120;
        if (dist > 0.001) { d.vx -= (dx/dist) * force * 0.55; d.vy -= (dy/dist) * force * 0.55; }
      }
      d.vx += (d.ox - d.x) * 0.045; d.vy += (d.oy - d.y) * 0.045; d.vx *= 0.82; d.vy *= 0.82; d.x += d.vx; d.y += d.vy;
      const near = pointer.active ? Math.max(0,1 - Math.min(120,Math.hypot(pointer.x-d.x,pointer.y-d.y))/120) : 0;
      const r = near ? 1.25 + near * .9 : .9;
      ctx.beginPath(); ctx.arc(d.x,d.y,r,0,Math.PI*2); ctx.fillStyle = `rgba(122,165,230,${.15 + near*.18})`; ctx.fill();
    }
    requestAnimationFrame(dotLoop);
  }
  window.addEventListener("resize", resizeDots);
  window.addEventListener("pointermove", e => { pointer={x:e.clientX,y:e.clientY,active:true}; });
  window.addEventListener("pointerleave", () => { pointer.active=false; });
  window.addEventListener("touchstart", e => { const t=e.touches[0]; if(t) pointer={x:t.clientX,y:t.clientY,active:true}; }, {passive:true});
  window.addEventListener("touchmove", e => { const t=e.touches[0]; if(t) pointer={x:t.clientX,y:t.clientY,active:true}; }, {passive:true});
  window.addEventListener("touchend", () => { pointer.active=false; });
  resizeDots();
  requestAnimationFrame(dotLoop);

  // Initial render/session.
  renderView(viewFromPath());
  loadSession();
})();
