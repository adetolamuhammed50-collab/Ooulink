(() => {
  const SUPABASE_URL = "https://dthvdxgxesomltlruogp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_rpHsazbgtLck-E8784JHYA_q5WMGinr";
  const REFERRAL_STORAGE_KEY = "studtask_referral_code";
  const REFERRAL_PATTERN = /^STUD-[A-F0-9]{8}$/i;

  const signupClient = typeof supabaseClient !== "undefined" ? supabaseClient : null;
  const client = signupClient || window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);

  if (!client) return;

  function getReferralCode() {
    const code = localStorage.getItem(REFERRAL_STORAGE_KEY);
    return code && REFERRAL_PATTERN.test(code) ? code.toUpperCase() : null;
  }

  function rememberReferralCode() {
    const code = new URLSearchParams(window.location.search).get("ref");

    if (code && REFERRAL_PATTERN.test(code)) {
      localStorage.setItem(REFERRAL_STORAGE_KEY, code.toUpperCase());
    }
  }

  window.studTaskReferralCode = getReferralCode;

  async function claimReferral(user) {
    if (!user) return;

    const code = getReferralCode();
    if (!code) return;

    const { data: referrer, error: referrerError } = await client
      .from("profiles")
      .select("id, referral_code")
      .eq("referral_code", code)
      .maybeSingle();

    if (referrerError || !referrer || referrer.id === user.id) return;

    const { error } = await client.from("referrals").insert({
      referrer_id: referrer.id,
      referred_user_id: user.id,
      referral_code: code,
      status: "registered"
    });

    if (!error || error.code === "23505") {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
    }
  }

  function patchSignupClient() {
    if (!signupClient?.auth?.signUp || signupClient.auth.signUp.__studTaskReferralPatched) {
      return;
    }

    const originalSignUp = signupClient.auth.signUp.bind(signupClient.auth);

    const patchedSignUp = async (credentials) => {
      const code = getReferralCode();
      const nextCredentials = { ...credentials };
      const options = { ...(credentials?.options || {}) };
      const data = { ...(options.data || {}) };

      if (code) {
        data.referral_code = code;
      }

      options.data = data;
      nextCredentials.options = options;

      const result = await originalSignUp(nextCredentials);

      if (!result.error && result.data?.user && code) {
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
      }

      return result;
    };

    patchedSignUp.__studTaskReferralPatched = true;
    signupClient.auth.signUp = patchedSignUp;
  }

  rememberReferralCode();
  patchSignupClient();

  client.auth.getSession().then(({ data }) => {
    claimReferral(data?.session?.user || null);
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      window.setTimeout(() => claimReferral(session.user), 0);
    }
  });

  if (window.location.pathname.endsWith("/signup.html") || window.location.pathname.endsWith("/signup")) {
    const fixSignupMessage = () => {
      const message = document.getElementById("message");
      if (!message) return;

      if (message.textContent.includes("Account created, but your profile could not be completed.")) {
        message.textContent = "Account created successfully! Check your email to confirm your account.";
        message.className = "message success";
      }
    };

    new MutationObserver(fixSignupMessage).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true
    });
  }
})();
