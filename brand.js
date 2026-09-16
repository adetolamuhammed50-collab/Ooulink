(() => {
  const injectStudTaskBrand = () => {
    if (document.querySelector(".studtask-global-brand")) return;
    if (document.querySelector('img[src="logo.svg"]')) return;

    const brand = document.createElement("a");
    brand.className = "studtask-global-brand";
    brand.href = "index.html";
    brand.setAttribute("aria-label", "StudTask home");
    brand.innerHTML = '<img src="logo.svg" alt="StudTask — Connect. Get things done. Earn.">';

    const style = document.createElement("style");
    style.textContent = `
      .studtask-global-brand {
        position: fixed;
        top: max(10px, env(safe-area-inset-top));
        right: 10px;
        z-index: 99999;
        display: inline-flex;
        align-items: center;
        width: 132px;
        padding: 5px 8px;
        border-radius: 12px;
        background: rgba(255,255,255,.96);
        box-shadow: 0 4px 16px rgba(0,0,0,.08);
        text-decoration: none;
        -webkit-backdrop-filter: blur(8px);
        backdrop-filter: blur(8px);
      }
      .studtask-global-brand img {
        display: block;
        width: 100%;
        height: auto;
      }
      .studtask-global-brand:active {
        transform: scale(.97);
      }
      @media (min-width: 600px) {
        .studtask-global-brand {
          right: 18px;
          top: max(14px, env(safe-area-inset-top));
          width: 150px;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(brand);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectStudTaskBrand, { once: true });
  } else {
    injectStudTaskBrand();
  }
})();
