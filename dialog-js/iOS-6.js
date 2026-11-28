window.ios6Alert = function({ title = "Alert", message = "", buttons = ["OK"] }) {
  return new Promise((resolve) => {
    // 1. Inject CSS once if not already present
    if (!document.getElementById("ios6-alert-styles")) {
      const style = document.createElement("style");
      style.id = "ios6-alert-styles";
      style.textContent = `
        .ios6-backdrop {
          position: fixed; inset: 0;
          background: radial-gradient(circle, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.7) 100%);
          display: flex; align-items: center; justify-content: center;
          z-index: 99999; font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
          animation: ios6FadeIn 0.15s ease-out;
        }
        .ios6-dialog {
          position: relative; width: 270px; border-radius: 12px;
          background: linear-gradient(180deg, rgba(46,72,118,0.92) 0%, rgba(22,42,82,0.94) 100%);
          border: 2px solid rgba(255, 255, 255, 0.78);
          box-shadow: 0 10px 25px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.4);
          color: #fff; text-align: center; overflow: hidden;
          animation: ios6PopIn 0.22s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        }
        /* Classic curved top glass gloss */
        .ios6-dialog::before {
          content: ""; position: absolute; top: -38px; left: -15%;
          width: 130%; height: 68px; border-radius: 50%;
          background: linear-gradient(180deg, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0.12) 100%);
          pointer-events: none;
        }
        .ios6-content {
          position: relative; z-index: 1; padding: 16px 14px 12px;
        }
        .ios6-title {
          font-size: 17px; font-weight: bold; margin: 0 0 6px;
          text-shadow: 0 -1px 1px rgba(0,0,0,0.75);
        }
        .ios6-message {
          font-size: 14px; line-height: 1.35; margin: 0;
          text-shadow: 0 -1px 1px rgba(0,0,0,0.75);
        }
        .ios6-buttons {
          position: relative; z-index: 1; display: flex; gap: 8px;
          padding: 4px 10px 12px;
        }
        .ios6-btn {
          flex: 1; height: 40px; border-radius: 6px; cursor: pointer;
          font-family: inherit; font-size: 16px; font-weight: bold; color: #fff;
          text-shadow: 0 -1px 1px rgba(0,0,0,0.75);
          border: 1px solid rgba(10, 20, 45, 0.85);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.45), 0 1px 2px rgba(0,0,0,0.35);
          background: linear-gradient(180deg, #6e88b7 0%, #3d5b92 50%, #2a477e 51%, #385892 100%);
        }
        /* Primary / Bold right-hand button */
        .ios6-btn.primary {
          background: linear-gradient(180deg, #8aa5d6 0%, #4b6da8 50%, #355693 51%, #496ba8 100%);
        }
        .ios6-btn:active {
          background: linear-gradient(180deg, #223966 0%, #36548a 100%);
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.6);
        }
        @keyframes ios6PopIn {
          0% { transform: scale(1.22); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes ios6FadeIn {
          from { opacity: 0; } to { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    // 2. Build DOM elements
    const backdrop = document.createElement("div");
    backdrop.className = "ios6-backdrop";

    const dialog = document.createElement("div");
    dialog.className = "ios6-dialog";

    const content = document.createElement("div");
    content.className = "ios6-content";

    if (title) {
      const titleEl = document.createElement("h3");
      titleEl.className = "ios6-title";
      titleEl.textContent = title;
      content.appendChild(titleEl);
    }

    if (message) {
      const msgEl = document.createElement("p");
      msgEl.className = "ios6-message";
      msgEl.textContent = message;
      content.appendChild(msgEl);
    }

    const btnContainer = document.createElement("div");
    btnContainer.className = "ios6-buttons";

    buttons.forEach((label, index) => {
      const btn = document.createElement("button");
      btn.className = "ios6-btn" + (index === buttons.length - 1 ? " primary" : "");
      btn.textContent = label;
      btn.onclick = () => {
        backdrop.remove();
        resolve({ index, label });
      };
      btnContainer.appendChild(btn);
    });

    dialog.append(content, btnContainer);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);
  });
}
