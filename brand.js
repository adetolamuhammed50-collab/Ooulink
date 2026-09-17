(() => {
  const HEADER_LOGO = "IMG-20260915-WA0041.jpg";
  const ICON = "icon.svg";
  const SUPABASE_URL = "https://dthvdxgxesomltlruogp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_rpHsazbgtLck-E8784JHYA_q5WMGinr";

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
      .studtask-header-brand:active{transform:scale(.98)!important}
      header .studtask-header-brand{margin:0!important}
      @media (min-width:600px){.studtask-header-brand{width:180px!important;height:70px!important;flex-basis:180px!important}.studtask-header-brand img{width:180px!important;height:70px!important}}
    `;

    if (location.pathname.endsWith("/alerts.html") || location.pathname.endsWith("/alerts")) {
      style.textContent += `
        .app>header{background:#eef1f4!important;color:#111827!important}
        .app>header h1{color:#111827!important}
        .app>header .count{background:#fff!important;color:#374151!important;border:1px solid #dfe3e8!important}
        .app>header .live{background:#fff!important;color:#4b5563!important;border-color:#dfe3e8!important}
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
        if (error) error.style.display = "block";
        checkbox?.focus();
      } else if (error) {
        error.style.display = "none";
      }
    }, true);
  };

  const openVerify = () => {
    if (!location.pathname.endsWith("/profile.html") && !location.pathname.endsWith("/profile")) return;
    if (new URLSearchParams(location.search).get("verify") !== "1") return;

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

  const speedUpProfile = () => {
    if (!location.pathname.endsWith("/profile.html") && !location.pathname.endsWith("/profile")) return;
    if (typeof window.loadProfile !== "function") return;

    const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
    if (!client) return;

    window.loadProfile = async id => {
      const [{ data: sessionData }, profileResult] = await Promise.all([
        client.auth.getSession(),
        client.from("profiles").select("*").eq("id", id).maybeSingle()
      ]);

      if (profileResult.error) throw profileResult.error;
      const p = profileResult.data;
      if (!p) throw new Error("Profile could not be found.");

      const own = sessionData?.session?.user?.id === id;
      const localStats = {
        posted: 0,
        completed: 0,
        reviews: 0,
        reputation: 0,
        xp: Math.max(0, Number(p.xp) || 0)
      };
      const el = id => document.getElementById(id);

      el("profileName").textContent = p.full_name || "StudTask User";
      el("profileUsername").textContent = p.username ? "@" + p.username : "Username not set";
      el("profileLocation").textContent = p.location || "Location not set";
      window.showAvatar(p.avatar_url);
      el("fullName").value = p.full_name || "";
      window.updateLevel(localStats.xp);
      window.updateCompletion(p);

      const universityPromise = own
        ? client.from("universities").select("id,name,short_name").eq("is_active", true).order("name")
        : Promise.resolve({ data: [], error: null });
      const campusPromise = p.campus_id
        ? client.from("campuses").select("id,name").eq("id", p.campus_id).maybeSingle()
        : Promise.resolve({ data: null, error: null });
      const postedPromise = client.from("tasks").select("id", { count: "exact", head: true }).eq("user_id", id);
      const completedPromise = client.from("tasks").select("id", { count: "exact", head: true }).eq("runner_id", id).eq("status", "completed");
      const reviewsPromise = client.from("reviews").select("id,task_id,reviewer_id,rating,note,created_at").eq("reviewee_id", id).order("created_at", { ascending: false }).limit(10);
      const reviewCountPromise = client.from("reviews").select("id", { count: "exact", head: true }).eq("reviewee_id", id);
      const verificationPromise = own
        ? client.from("profile_verifications").select("id,status,submitted_at,reviewed_at,reviewer_note,matric_number,course").eq("user_id", id).maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [universityResult, campusResult, postedResult, completedResult, reviewsResult, reviewCountResult, verificationResult] = await Promise.all([
        universityPromise,
        campusPromise,
        postedPromise,
        completedPromise,
        reviewsPromise,
        reviewCountPromise,
        verificationPromise
      ]);

      const universities = universityResult.error ? [] : universityResult.data || [];

      if (own) {
        const top = ["OOU", "OAU", "FUNAAB", "TASUED", "UNILAG", "UI"]
          .map(shortName => universities.find(u => u.short_name === shortName))
          .filter(Boolean);
        el("university").innerHTML = '<option value="">Choose your university</option>' +
          top.map(u => `<option value="${u.id}">${u.name}${u.short_name ? ` (${u.short_name})` : ""}</option>`).join("") +
          '<option value="other">Other University</option>';
        if (p.university_other) el("university").value = "other";
        else if (p.university_id) el("university").value = p.university_id;
        el("universityOther").value = p.university_other || "";
        el("universityOther").classList.toggle("hidden", el("university").value !== "other");

        const campusList = p.university_id
          ? await client.from("campuses").select("id,name").eq("university_id", p.university_id).eq("is_active", true).order("name")
          : { data: [], error: null };
        const campuses = campusList.error ? [] : campusList.data || [];
        el("campus").innerHTML = '<option value="">Choose your campus</option>' +
          campuses.map(c => `<option value="${c.id}">${window.esc(c.name)}</option>`).join("") +
          '<option value="other">Other Campus</option>';
        el("campus").disabled = false;
        if (p.campus_other) el("campus").value = "other";
        else if (p.campus_id) el("campus").value = p.campus_id;
        el("campusOther").value = p.campus_other || "";
        el("campusOther").classList.toggle("hidden", el("campus").value !== "other");
        if (p.username) el("usernameBox").classList.add("hidden");
      }

      let universityName = p.university_other || "";
      if (!universityName && p.university_id) universityName = universities.find(u => u.id === p.university_id)?.name || "University not set";
      el("profileUniversity").textContent = universityName ? "🎓 " + universityName : "University not set";

      let campusName = p.campus_other || "";
      if (!campusName && campusResult.data?.name) campusName = campusResult.data.name;
      el("profileCampus").textContent = campusName ? "🏫 " + campusName : "Campus not set";

      localStats.posted = postedResult.error ? 0 : postedResult.count || 0;
      localStats.completed = completedResult.error ? 0 : completedResult.count || 0;
      el("postedCount").textContent = localStats.posted;
      el("completedCount").textContent = localStats.completed;
      el("xpCount").textContent = localStats.xp;

      const reviews = reviewsResult.error ? [] : reviewsResult.data || [];
      localStats.reviews = reviewCountResult.error ? reviews.length : reviewCountResult.count || 0;
      el("reviewCount").textContent = localStats.reviews;

      if (reviewsResult.error) {
        el("reviewsList").innerHTML = '<div class="empty">Reviews could not be loaded.</div>';
      } else if (reviews.length) {
        localStats.reputation = reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / reviews.length;
        el("repScore").textContent = localStats.reputation.toFixed(1) + "/5";
        el("repStars").textContent = window.stars(localStats.reputation);
        el("repText").textContent = `Based on ${localStats.reviews} review${localStats.reviews === 1 ? "" : "s"}.`;
        el("reviewTrustIcon").textContent = "✓";
        el("reviewTrustText").textContent = `${localStats.reviews} review${localStats.reviews === 1 ? "" : "s"} received.`;
        el("reviewsList").innerHTML = reviews.map(review => `<div class="review"><div class="rtop"><span class="rating">${window.stars(review.rating)}</span><span class="date">${window.esc(window.date(review.created_at))}</span></div>${review.note ? `<div class="note">${window.esc(review.note)}</div>` : ""}</div>`).join("");
      } else {
        el("repScore").textContent = "New";
        el("repStars").textContent = "☆☆☆☆☆";
        el("repText").textContent = "Complete tasks and receive reviews to build your reputation.";
        el("reviewsList").innerHTML = '<div class="empty">No reviews yet.</div>';
      }

      const verification = own && !verificationResult.error ? verificationResult.data || null : null;
      window.updateVerification(verification);

      const complete = el("completionPercent").textContent === "100%";
      const achievements = [
        ["🌱", "Getting Started", "Create your StudTask profile", true],
        ["👤", "Complete Profile", "Fill all profile details", complete],
        ["⚡", "XP Builder", "Reach 100 XP", localStats.xp >= 100],
        ["🎯", "Task Poster", "Post your first task", localStats.posted > 0],
        ["🏃", "Task Finisher", "Complete your first task", localStats.completed > 0],
        ["⭐", "Trusted Member", "Receive your first review", localStats.reviews > 0]
      ];
      el("achievementGrid").innerHTML = achievements.map(item => `<div class="achievement ${item[3] ? "" : "locked"}"><div class="ai">${item[0]}</div><div class="an">${item[1]}</div><div class="at">${item[3] ? "Unlocked" : "Locked"} · ${item[2]}</div></div>`).join("");
    };
  };

  const init = () => {
    add();
    addSignupTerms();
    speedUpProfile();
    openVerify();
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
