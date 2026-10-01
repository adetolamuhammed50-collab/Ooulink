(() => {
  const SUPABASE_URL = "https://dthvdxgxesomltlruogp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_rpHsazbgtLck-E8784JHYA_q5WMGinr";
  const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
  if (!client) return;

  function vapidBytes(base64) {
    const padding = "=".repeat((4 - base64.length % 4) % 4);
    const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }

  async function getPublicKey() {
    const { data, error } = await client.functions.invoke("push-config", { method: "GET" });
    if (error || !data?.publicKey) throw error || new Error(data?.error || "Push notifications are not configured.");
    return data.publicKey;
  }

  async function saveSubscription(subscription) {
    const json = subscription.toJSON();
    const { data: { user } } = await client.auth.getUser();
    if (!user || !json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error("Please sign in first.");
    const { error } = await client.from("push_subscriptions").upsert({
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 500),
      updated_at: new Date().toISOString()
    }, { onConflict: "endpoint" });
    if (error) throw error;
  }

  async function enablePush() {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("Push notifications are not supported by this browser.");
    }
    if (Notification.permission === "denied") throw new Error("Notifications are blocked in browser settings.");
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission !== "granted") throw new Error("Notification permission was not granted.");
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const publicKey = await getPublicKey();
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidBytes(publicKey) });
    }
    await saveSubscription(subscription);
    return subscription;
  }

  async function disablePush() {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    const { data: { user } } = await client.auth.getUser();
    if (user) await client.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
  }

  async function render() {
    const host = document.getElementById("studtaskPushSettings");
    if (!host) return;
    if (window.isOwnProfile === false) { host.remove(); return; }
    host.innerHTML = '<div style="padding:15px;border:1px solid #dfe7e2;border-radius:14px;background:#fff"><b>🔔 Push Notifications</b><p style="margin:7px 0;color:#667085;font-size:12px;line-height:1.5">Get StudTask alerts even when the app is not open.</p><button id="studtaskPushButton" type="button" style="border:0;border-radius:10px;padding:11px 14px;background:#16834b;color:#fff;font-weight:800">Checking...</button><div id="studtaskPushStatus" style="margin-top:8px;font-size:11px;color:#667085"></div></div>';
    const button = document.getElementById("studtaskPushButton"), status = document.getElementById("studtaskPushStatus");
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription().catch(() => null);
    const update = active => {
      button.textContent = active ? "DISABLE PUSH" : "ENABLE PUSH";
      button.style.background = active ? "#b42318" : "#16834b";
      status.textContent = active ? "Push notifications are enabled on this device." : "Push notifications are currently off.";
    };
    update(!!subscription);
    button.onclick = async () => {
      button.disabled = true;
      status.textContent = "Updating notification permission...";
      try {
        if (button.textContent.startsWith("DISABLE")) {
          await disablePush();
          update(false);
        } else {
          await enablePush();
          update(true);
        }
      } catch (error) {
        status.textContent = error.message || "Could not update push notifications.";
      } finally { button.disabled = false; }
    };
  }

  window.StudTaskPush = { enable: enablePush, disable: disablePush, render };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render, { once: true });
  else render();
})();