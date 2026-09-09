const SUPABASE_URL = "https://dthvdxgxesomltlruogp.supabase.co";
const SUPABASE_KEY = "sb_publishable_rpHsazbgtLck-E8784JHYA_q5WMGinr";

const notificationSupabase =
  window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function updateNotificationDot() {
  const dot = document.getElementById("notificationDot");

  if (!dot) return;

  const { data, error } =
    await notificationSupabase.auth.getSession();

  if (error || !data.session) {
    dot.style.display = "none";
    return;
  }

  const userId = data.session.user.id;

  const { count, error: notificationError } =
    await notificationSupabase
      .from("notifications")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("user_id", userId)
      .eq("is_read", false);

  if (notificationError) {
    console.error(
      "Notification dot error:",
      notificationError
    );
    return;
  }

  dot.style.display = count > 0 ? "block" : "none";
}

document.addEventListener(
  "DOMContentLoaded",
  updateNotificationDot
);