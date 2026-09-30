(() => {
  const HEADER_LOGO = "IMG-20260915-WA0041.jpg";
  const ICON = "icon.svg";

  const link = (rel, href, attrs = {}) => {
    let element = document.head.querySelector(`link[data-studtask="${rel}"]`);
    if (!element) {
      element = document.createElement("link");
      element.rel = rel;
      element.dataset.studtask = rel;
      document.head.appendChild(element);
    }
    element.href = href;
    Object.entries(attrs).forEach(([key, value]) => element.setAttribute(key, value));
  };

  link("icon", ICON, { type: "image/svg+xml" });
  link("apple-touch-icon", ICON, { sizes: "180x180" });
  link("manifest", "manifest.json");

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
  }

  const add = () => {
    if (document.querySelector(".studtask-header-brand")) return;
    const old = document.querySelector(".brand,.logo");
    const target = old || document.querySelector("header .top-row,header .head,header .wrap .head") || document.querySelector("header");
    if (!target) return;
    const anchor = old || document.createElement("a");
    anchor.classList.add("studtask-header-brand");
    anchor.href = "index.html";
    anchor.setAttribute("aria-label", "StudTask home");
    anchor.innerHTML = '<img src="' + HEADER_LOGO + '" alt="StudTask — Connect. Get things done. Earn.">';
    if (!old) target.prepend(anchor);
    const style = document.createElement("style");
    style.textContent = `
      .studtask-header-brand{display:flex!important;align-items:center!important;justify-content:flex-start!important;position:relative!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;transform:none!important;width:150px!important;height:59px!important;flex:0 0 150px!important;align-self:center!important;text-decoration:none!important;line-height:0!important;overflow:hidden!important;margin:0!important;padding:0!important}
      .studtask-header-brand img{display:block!important;width:150px!important;height:59px!important;object-fit:contain!important;object-position:left center!important}
      .studtask-header-brand:active{transform:scale(.98)!important}header .studtask-header-brand{margin:0!important}
      @media (min-width:600px){.studtask-header-brand{width:180px!important;height:70px!important;flex-basis:180px!important}.studtask-header-brand img{width:180px!important;height:70px!important}}
    `;
    if (location.pathname.endsWith("/alerts.html") || location.pathname.endsWith("/alerts")) {
      style.textContent += `
        .app > header{background:#eef1f4!important;color:#111827!important}.app > header h1{color:#111827!important}.app > header .count{background:#fff!important;color:#374151!important;border:1px solid #dfe3e8!important}.app > header .live{background:#fff!important;color:#4b5563!important;border-color:#dfe3e8!important}
      `;
    }
    document.head.appendChild(style);
  };

  const addSignupTerms = () => {
    if (!location.pathname.endsWith("/signup.html") && !location.pathname.endsWith("/signup")) return;
    const form = document.getElementById("signupForm");
    const submitButton = document.getElementById("signupButton");
    if (!form || !submitButton || document.getElementById("termsAgreement")) return;
    const wrapper = document.createElement("div");
    wrapper.id = "termsAgreement";
    wrapper.style.cssText = "margin:14px 0 4px;font-size:12px;color:#666;line-height:1.5";
    wrapper.innerHTML = `<label style="display:flex;align-items:flex-start;gap:9px;cursor:pointer;font-weight:400;margin:0"><input id="termsCheckbox" type="checkbox" style="width:17px;height:17px;min-width:17px;margin:1px 0 0;accent-color:#16834b"><span>I agree to the <a href="terms.html" target="_blank" rel="noopener" style="color:#16834b;font-weight:700">Terms and Conditions</a>.</span></label><div id="termsError" style="display:none;color:#c62828;font-size:11px;margin-top:6px">You must agree to the Terms and Conditions before creating an account.</div>`;
    submitButton.parentNode.insertBefore(wrapper, submitButton);
    form.addEventListener("submit", event => {
      const checkbox = document.getElementById("termsCheckbox"), error = document.getElementById("termsError");
      if (!checkbox?.checked) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (error) error.style.display = "block";
        checkbox?.focus();
      } else if (error) error.style.display = "none";
    }, true);
  };

  const openVerify = () => {
    if (!location.pathname.endsWith("/profile.html") && !location.pathname.endsWith("/profile")) return;
    if (new URLSearchParams(location.search).get("verify") !== "1") return;
    let attempts = 0;
    const timer = setInterval(() => {
      if (typeof window.showVerification === "function") {
        clearInterval(timer); window.showVerification();
      } else if (++attempts >= 100) clearInterval(timer);
    }, 100);
  };

  const loadNotifications = () => {
    const path = location.pathname.toLowerCase();
    if (path.endsWith("/admin.html") || path.endsWith("/admin")) return;
    if (document.querySelector('script[data-studtask-notifications="true"]')) return;
    const script = document.createElement("script");
    script.src = "notifications.js";
    script.dataset.studtaskNotifications = "true";
    script.defer = true;
    document.head.appendChild(script);
  };

  const addAdminWaitlist = () => {
    const path = location.pathname.toLowerCase();
    if (!path.endsWith("/admin.html") && !path.endsWith("/admin")) return;
    if (document.getElementById("studtaskWaitlistButton")) return;
    if (!window.supabase?.createClient) return;

    const url = "https://dthvdxgxesomltlruogp.supabase.co";
    const key = "sb_publishable_rpHsazbgtLck-E8784JHYA_q5WMGinr";
    const client = window.supabase.createClient(url, key);
    const button = document.createElement("button");
    button.id = "studtaskWaitlistButton";
    button.type = "button";
    button.textContent = "👥 WAITLIST";
    button.style.cssText = "position:fixed;right:14px;bottom:14px;z-index:9998;border:0;border-radius:14px;padding:13px 15px;background:linear-gradient(135deg,#16834b,#20a65f);color:#fff;font:800 12px Arial,sans-serif;box-shadow:0 10px 25px #16834b44;cursor:pointer";
    document.body.appendChild(button);

    const modal = document.createElement("div");
    modal.id = "studtaskWaitlistModal";
    modal.style.cssText = "display:none;position:fixed;inset:0;z-index:9999;background:#0b1220cc;padding:14px;overflow:auto;font-family:Arial,sans-serif";
    modal.innerHTML = `
      <div style="max-width:900px;margin:20px auto;background:#f7faf8;border-radius:20px;overflow:hidden;box-shadow:0 25px 70px #0008">
        <div style="padding:18px;background:#0b1220;color:#fff;display:flex;justify-content:space-between;align-items:center;gap:12px">
          <div><div style="font-size:20px;font-weight:900">Waitlist</div><div style="font-size:11px;color:#aeb8c9;margin-top:3px">Early-access signups</div></div>
          <button id="studtaskWaitlistClose" type="button" style="border:1px solid #ffffff33;background:#ffffff10;color:#fff;border-radius:10px;padding:9px 12px;font-weight:800">CLOSE</button>
        </div>
        <div style="padding:16px">
          <div id="studtaskWaitlistStatus" style="padding:12px;color:#667085;font-size:13px">Loading waitlist...</div>
          <div id="studtaskWaitlistContent"></div>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const status = modal.querySelector("#studtaskWaitlistStatus"), content = modal.querySelector("#studtaskWaitlistContent");
    const esc = value => String(value ?? "").replace(/[&<>"']/g, c => c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "\"" ? "&quot;" : "&#39;");
    let waitlistRows = [];

    const render = () => {
      const q = (modal.querySelector("#studtaskWaitlistSearch")?.value || "").trim().toLowerCase();
      const filtered = waitlistRows.filter(x => [x.full_name,x.email,x.phone,x.campus].some(v => String(v || "").toLowerCase().includes(q)));
      const latest = waitlistRows[0]?.created_at ? new Date(waitlistRows[0].created_at).toLocaleString() : "—";
      content.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div style="background:#fff;border:1px solid #e2e8e5;border-radius:14px;padding:14px"><div style="font-size:10px;color:#667085;font-weight:800">TOTAL SIGNUPS</div><div style="font-size:28px;font-weight:900;margin-top:5px;color:#16834b">${waitlistRows.length}</div></div>
          <div style="background:#fff;border:1px solid #e2e8e5;border-radius:14px;padding:14px"><div style="font-size:10px;color:#667085;font-weight:800">LATEST SIGNUP</div><div style="font-size:14px;font-weight:900;margin-top:8px">${esc(latest)}</div></div>
        </div>
        <input id="studtaskWaitlistSearch" placeholder="Search name, email, phone or campus" style="width:100%;padding:12px;border:1px solid #d8e0db;border-radius:10px;font-size:14px;margin-bottom:12px">
        <div style="background:#fff;border:1px solid #e2e8e5;border-radius:14px;overflow:auto">
          <table style="width:100%;border-collapse:collapse;font-size:11px;min-width:650px"><thead><tr><th style="text-align:left;padding:11px 9px;border-bottom:1px solid #edf0ee">Name</th><th style="text-align:left;padding:11px 9px;border-bottom:1px solid #edf0ee">Email</th><th style="text-align:left;padding:11px 9px;border-bottom:1px solid #edf0ee">Phone</th><th style="text-align:left;padding:11px 9px;border-bottom:1px solid #edf0ee">Campus</th><th style="text-align:left;padding:11px 9px;border-bottom:1px solid #edf0ee">Joined</th></tr></thead><tbody>${filtered.map(x=>`<tr><td style="padding:10px 9px;border-bottom:1px solid #f0f2f1">${esc(x.full_name)}</td><td style="padding:10px 9px;border-bottom:1px solid #f0f2f1">${esc(x.email)}</td><td style="padding:10px 9px;border-bottom:1px solid #f0f2f1">${esc(x.phone)}</td><td style="padding:10px 9px;border-bottom:1px solid #f0f2f1">${esc(x.campus || "—")}</td><td style="padding:10px 9px;border-bottom:1px solid #f0f2f1">${esc(new Date(x.created_at).toLocaleString())}</td></tr>`).join("") || '<tr><td colspan="5" style="padding:25px;text-align:center;color:#667085">No matching signups.</td></tr>'}</tbody></table>
        </div>`;
      modal.querySelector("#studtaskWaitlistSearch").addEventListener("input", render);
    };

    const load = async () => {
      status.textContent = "Checking administrator access...";
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError || !sessionData?.session) {
        status.textContent = "Administrator session required.";
        return;
      }
      const { data: admin, error: adminError } = await client.from("admin_users").select("user_id").eq("user_id", sessionData.session.user.id).maybeSingle();
      if (adminError || !admin) {
        status.textContent = "Administrator access required.";
        return;
      }
      const { data, error } = await client.from("waitlist_signups").select("full_name,email,phone,campus,created_at").order("created_at", { ascending:false });
      if (error) {
        status.textContent = "Could not load waitlist: " + error.message;
        return;
      }
      waitlistRows = data || [];
      status.style.display = "none";
      render();
    };

    button.addEventListener("click", () => {
      modal.style.display = "block";
      load();
    });
    modal.querySelector("#studtaskWaitlistClose").addEventListener("click", () => modal.style.display = "none");
    modal.addEventListener("click", e => { if (e.target === modal) modal.style.display = "none"; });
  };

  const init = () => {
    add();
    addSignupTerms();
    openVerify();
    loadNotifications();
    addAdminWaitlist();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();