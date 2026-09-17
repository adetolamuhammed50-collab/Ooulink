(() => {
  const SUPABASE_URL = "https://dthvdxgxesomltlruogp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_rpHsazbgtLck-E8784JHYA_q5WMGinr";

  if (!window.supabase) return;

  const notificationSupabase = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  let notificationsChannel = null;
  let currentUserId = null;

  function getNotificationDots() {
    return Array.from(
      document.querySelectorAll("#notificationDot, #dot, .notification-dot")
    );
  }

  function setNotificationDot(hasUnread) {
    getNotificationDots().forEach(dot => {
      dot.style.display = hasUnread ? "block" : "none";
    });
  }

  async function updateNotificationDot() {
    const dots = getNotificationDots();

    if (!dots.length) return;

    const { data, error } = await notificationSupabase.auth.getSession();

    if (error || !data.session) {
      setNotificationDot(false);
      return;
    }

    currentUserId = data.session.user.id;

    const { count, error: notificationError } = await notificationSupabase
      .from("notifications")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("user_id", currentUserId)
      .eq("is_read", false);

    if (notificationError) {
      console.error("Notification dot error:", notificationError);
      return;
    }

    setNotificationDot((count || 0) > 0);
  }

  function ensurePopupStyles() {
    if (document.getElementById("studtaskNotificationStyles")) return;

    const style = document.createElement("style");
    style.id = "studtaskNotificationStyles";
    style.textContent = `
      .studtask-notification-popup {
        position: fixed;
        top: 14px;
        left: 50%;
        width: min(440px, calc(100vw - 24px));
        transform: translate(-50%, -140%);
        z-index: 100000;
        background: rgba(255,255,255,.97);
        border: 1px solid rgba(22,131,75,.16);
        border-radius: 18px;
        box-shadow: 0 18px 45px rgba(0,0,0,.18), 0 4px 14px rgba(22,131,75,.12);
        backdrop-filter: blur(18px);
        -webkit-backdrop-filter: blur(18px);
        overflow: hidden;
        opacity: 0;
        transition: transform .32s cubic-bezier(.2,.8,.2,1), opacity .25s ease;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      .studtask-notification-popup.show {
        transform: translate(-50%, 0);
        opacity: 1;
      }

      .studtask-notification-popup:active {
        transform: translate(-50%, 2px) scale(.985);
      }

      .studtask-notification-popup-inner {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 14px;
      }

      .studtask-notification-icon {
        width: 42px;
        height: 42px;
        min-width: 42px;
        border-radius: 13px;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #16834b, #20a461);
        color: #fff;
        font-size: 20px;
        box-shadow: 0 7px 16px rgba(22,131,75,.22);
      }

      .studtask-notification-copy {
        min-width: 0;
        flex: 1;
      }

      .studtask-notification-label {
        color: #16834b;
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
        margin-bottom: 3px;
      }

      .studtask-notification-title {
        color: #111827;
        font-size: 14px;
        font-weight: 800;
        line-height: 1.3;
      }

      .studtask-notification-message {
        color: #5b6472;
        font-size: 12px;
        line-height: 1.4;
        margin-top: 3px;
      }

      .studtask-notification-hint {
        color: #16834b;
        font-size: 10px;
        font-weight: 700;
        margin-top: 7px;
      }

      .studtask-notification-close {
        width: 28px;
        height: 28px;
        flex: none;
        border: 0;
        border-radius: 50%;
        background: #f1f4f2;
        color: #68727d;
        font-size: 17px;
        line-height: 1;
        cursor: pointer;
      }

      .studtask-notification-progress {
        height: 3px;
        background: #16834b;
        width: 100%;
        transform-origin: left;
        animation: studtaskNotificationProgress 6s linear forwards;
      }

      @keyframes studtaskNotificationProgress {
        from { transform: scaleX(1); }
        to { transform: scaleX(0); }
      }

      @media (prefers-reduced-motion: reduce) {
        .studtask-notification-popup {
          transition: none;
        }

        .studtask-notification-progress {
          animation: none;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function removePopup() {
    const popup = document.getElementById("studtaskNotificationPopup");
    if (!popup) return;

    popup.classList.remove("show");
    window.setTimeout(() => popup.remove(), 280);
  }

  function showMessagePopup(notification) {
    if (!notification || notification.type !== "new_message") return;
    if (location.pathname.endsWith("/admin.html") || location.pathname.endsWith("/admin")) return;

    ensurePopupStyles();
    removePopup();

    const popup = document.createElement("div");
    popup.id = "studtaskNotificationPopup";
    popup.className = "studtask-notification-popup";
    popup.setAttribute("role", "button");
    popup.setAttribute("tabindex", "0");
    popup.innerHTML = `
      <div class="studtask-notification-popup-inner">
        <div class="studtask-notification-icon">💬</div>
        <div class="studtask-notification-copy">
          <div class="studtask-notification-label">New message</div>
          <div class="studtask-notification-title"></div>
          <div class="studtask-notification-message"></div>
          <div class="studtask-notification-hint">Tap to open Alerts</div>
        </div>
        <button class="studtask-notification-close" type="button" aria-label="Dismiss">×</button>
      </div>
      <div class="studtask-notification-progress"></div>
    `;

    popup.querySelector(".studtask-notification-title").textContent = notification.title || "New message";
    popup.querySelector(".studtask-notification-message").textContent = notification.message || "You received a new message.";

    const close = event => {
      event.stopPropagation();
      removePopup();
    };

    popup.querySelector(".studtask-notification-close").addEventListener("click", close);

    const openAlerts = async () => {
      if (notification.id) {
        await notificationSupabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", notification.id)
          .eq("user_id", currentUserId);
      }

      window.location.href = "alerts.html";
    };

    popup.addEventListener("click", openAlerts);
    popup.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAlerts();
      }
    });

    document.body.appendChild(popup);
    requestAnimationFrame(() => popup.classList.add("show"));

    window.setTimeout(removePopup, 6000);
  }

  async function subscribeToNotifications(userId) {
    if (!userId) return;

    if (notificationsChannel) {
      await notificationSupabase.removeChannel(notificationsChannel);
      notificationsChannel = null;
    }

    notificationsChannel = notificationSupabase
      .channel(`studtask-notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`
        },
        payload => {
          const notification = payload.new;

          if (notification?.is_read === false) {
            setNotificationDot(true);
          }

          showMessagePopup(notification);
        }
      )
      .subscribe(status => {
        if (status === "SUBSCRIBED") {
          updateNotificationDot();
        }
      });
  }

  async function initializeNotifications() {
    const { data, error } = await notificationSupabase.auth.getSession();

    if (error || !data.session) {
      setNotificationDot(false);
      return;
    }

    currentUserId = data.session.user.id;
    await updateNotificationDot();
    await subscribeToNotifications(currentUserId);
  }

  notificationSupabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      currentUserId = null;
      setNotificationDot(false);
      removePopup();
      if (notificationsChannel) {
        notificationSupabase.removeChannel(notificationsChannel);
        notificationsChannel = null;
      }
      return;
    }

    if (session?.user) {
      currentUserId = session.user.id;
      updateNotificationDot();
      subscribeToNotifications(currentUserId);
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      updateNotificationDot();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeNotifications, { once: true });
  } else {
    initializeNotifications();
  }
})();