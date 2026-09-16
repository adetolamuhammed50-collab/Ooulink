(() => {
  const SUPABASE_URL = "https://dthvdxgxesomltlruogp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_rpHsazbgtLck-E8784JHYA_q5WMGinr";
  const supabaseClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
  const REFERRAL_STORAGE_KEY = "studtask_referral_code";
  const REFERRAL_PATTERN = /^STUD-[A-F0-9]{8}$/i;

  if (!supabaseClient) {
    return;
  }

  function rememberReferralCode() {
    const code = new URLSearchParams(window.location.search).get("ref");

    if (!code || !REFERRAL_PATTERN.test(code)) {
      return;
    }

    localStorage.setItem(REFERRAL_STORAGE_KEY, code.toUpperCase());
  }

  async function claimReferral(user) {
    if (!user) {
      return;
    }

    const code = localStorage.getItem(REFERRAL_STORAGE_KEY);

    if (!code || !REFERRAL_PATTERN.test(code)) {
      return;
    }

    const { data: referrer, error: referrerError } = await supabaseClient
      .from("profiles")
      .select("id, referral_code")
      .eq("referral_code", code)
      .maybeSingle();

    if (referrerError || !referrer || referrer.id === user.id) {
      if (referrer?.id === user.id) {
        localStorage.removeItem(REFERRAL_STORAGE_KEY);
      }
      return;
    }

    const { error } = await supabaseClient
      .from("referrals")
      .insert({
        referrer_id: referrer.id,
        referred_user_id: user.id,
        referral_code: code,
        status: "registered"
      });

    if (!error || error.code === "23505") {
      localStorage.removeItem(REFERRAL_STORAGE_KEY);
    }
  }

  rememberReferralCode();

  supabaseClient.auth.getSession().then(({ data }) => {
    claimReferral(data?.session?.user || null);
  });

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session?.user) {
      window.setTimeout(() => claimReferral(session.user), 0);
    }
  });
})();
