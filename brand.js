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

    Object.entries(attrs).forEach(([key, value]) => {
      element.setAttribute(key, value);
    });
  };

  link("icon", ICON, { type: "image/svg+xml" });
  link("apple-touch-icon", ICON, { sizes: "180x180" });
  link("manifest", "manifest.json");

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).catch(() => {});
  }

  const add = () => {
    if (document.querySelector(".studtask-header-brand")) {
      return;
    }

    const old = document.querySelector(".brand,.logo");
    const target = old || document.querySelector("header .top-row,header .head,header .wrap .head") || document.querySelector("header");

    if (!target) {
      return;
    }

    const anchor = old || document.createElement("a");
    anchor.classList.add("studtask-header-brand");
    anchor.href = "index.html";
    anchor.setAttribute("aria-label", "StudTask home");
    anchor.innerHTML = '<img src="' + HEADER_LOGO + '" alt="StudTask — Connect. Get things done. Earn.">';

    if (!old) {
      target.prepend(anchor);
    }

    const style = document.createElement("style");
    style.textContent = `
      .studtask-header-brand {
        display: flex !important;
        align-items: center !important;
        justify-content: flex-start !important;
        position: relative !important;
        top: auto !important;
        right: auto !important;
        bottom: auto !important;
        left: auto !important;
        transform: none !important;
        width: 150px !important;
        height: 59px !important;
        flex: 0 0 150px !important;
        align-self: center !important;
        text-decoration: none !important;
        line-height: 0 !important;
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
      }

      .studtask-header-brand img {
        display: block !important;
        width: 150px !important;
        height: 59px !important;
        object-fit: contain !important;
        object-position: left center !important;
      }

      .studtask-header-brand:active {
        transform: scale(.98) !important;
      }

      header .studtask-header-brand {
        margin: 0 !important;
      }

      @media (min-width: 600px) {
        .studtask-header-brand {
          width: 180px !important;
          height: 70px !important;
          flex-basis: 180px !important;
        }

        .studtask-header-brand img {
          width: 180px !important;
          height: 70px !important;
        }
      }
    `;

    if (location.pathname.endsWith("/alerts.html") || location.pathname.endsWith("/alerts")) {
      style.textContent += `
        .app > header {
          background: #eef1f4 !important;
          color: #111827 !important;
        }

        .app > header h1 {
          color: #111827 !important;
        }

        .app > header .count {
          background: #fff !important;
          color: #374151 !important;
          border: 1px solid #dfe3e8 !important;
        }

        .app > header .live {
          background: #fff !important;
          color: #4b5563 !important;
          border-color: #dfe3e8 !important;
        }
      `;
    }

    document.head.appendChild(style);
  };

  const addSignupTerms = () => {
    if (!location.pathname.endsWith("/signup.html") && !location.pathname.endsWith("/signup")) {
      return;
    }

    const form = document.getElementById("signupForm");
    const submitButton = document.getElementById("signupButton");

    if (!form || !submitButton || document.getElementById("termsAgreement")) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.id = "termsAgreement";
    wrapper.style.cssText = "margin:14px 0 4px;font-size:12px;color:#666;line-height:1.5";
    wrapper.innerHTML = `
      <label style="display:flex;align-items:flex-start;gap:9px;cursor:pointer;font-weight:400;margin:0">
        <input id="termsCheckbox" type="checkbox" style="width:17px;height:17px;min-width:17px;margin:1px 0 0;accent-color:#16834b">
        <span>I agree to the <a href="terms.html" target="_blank" rel="noopener" style="color:#16834b;font-weight:700">Terms and Conditions</a>.</span>
      </label>
      <div id="termsError" style="display:none;color:#c62828;font-size:11px;margin-top:6px">You must agree to the Terms and Conditions before creating an account.</div>
    `;

    submitButton.parentNode.insertBefore(wrapper, submitButton);

    form.addEventListener("submit", event => {
      const checkbox = document.getElementById("termsCheckbox");
      const error = document.getElementById("termsError");

      if (!checkbox?.checked) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (error) {
          error.style.display = "block";
        }
        checkbox?.focus();
      } else if (error) {
        error.style.display = "none";
      }
    }, true);
  };

  const openVerify = () => {
    if (!location.pathname.endsWith("/profile.html") && !location.pathname.endsWith("/profile")) {
      return;
    }

    if (new URLSearchParams(location.search).get("verify") !== "1") {
      return;
    }

    let attempts = 0;
    const timer = setInterval(() => {
      if (typeof window.showVerification === "function") {
        clearInterval(timer);
        window.showVerification();
      } else if (++attempts >= 100) {
        clearInterval(timer);
      }
    }, 100);
  };

  const loadNotifications = () => {
    const path = location.pathname.toLowerCase();

    if (path.endsWith("/admin.html") || path.endsWith("/admin")) {
      return;
    }

    if (document.querySelector('script[data-studtask-notifications="true"]')) {
      return;
    }

    const script = document.createElement("script");
    script.src = "notifications.js";
    script.dataset.studtaskNotifications = "true";
    script.defer = true;
    document.head.appendChild(script);
  };

  const init = () => {
    add();
    addSignupTerms();
    openVerify();
    loadNotifications();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
