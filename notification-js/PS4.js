function showPS4Notification({ title = 'Notification', subtitle = '', iconUrl, duration = 4500 }) {
  
  if (!document.getElementById('ps4-notify-styles')) {
    const style = document.createElement('style');
    style.id = 'ps4-notify-styles';
    style.textContent = `
      @keyframes ps4SlideIn {
        0% { transform: translateX(-110%); opacity: 0; }
        100% { transform: translateX(0); opacity: 1; }
      }
      @keyframes ps4SlideOut {
        0% { transform: translateX(0); opacity: 1; }
        100% { transform: translateX(-110%); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  
  let container = document.getElementById('ps4-notify-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'ps4-notify-container';
    Object.assign(container.style, {
      position: 'fixed',
      top: '36px',
      left: '0',
      zIndex: '999999',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      pointerEvents: 'none',
    });
    document.body.appendChild(container);
  }

  
  const toast = document.createElement('div');
  Object.assign(toast.style, {
    display: 'flex',
    alignItems: 'center',
    background: 'linear-gradient(90deg, rgba(22, 24, 29, 0.96) 0%, rgba(36, 40, 48, 0.94) 100%)',
    color: '#ffffff',
    padding: '12px 28px 12px 24px',
    borderRadius: '0 40px 40px 0',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    minWidth: '300px',
    maxWidth: '460px',
    backdropFilter: 'blur(8px)',
    animation: 'ps4SlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
  });

  
  const iconWrapper = document.createElement('div');
  Object.assign(iconWrapper.style, {
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    backgroundColor: '#006FCD', 
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '16px',
    flexShrink: '0',
    overflow: 'hidden',
    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
  });

  if (iconUrl) {
    const img = document.createElement('img');
    img.src = iconUrl;
    Object.assign(img.style, {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
    });
    iconWrapper.appendChild(img);
  }

  
  const textWrapper = document.createElement('div');
  Object.assign(textWrapper.style, {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    overflow: 'hidden',
  });

  const titleEl = document.createElement('div');
  titleEl.textContent = title;
  Object.assign(titleEl.style, {
    fontSize: '15px',
    fontWeight: '500',
    letterSpacing: '0.2px',
    lineHeight: '1.3',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });
  textWrapper.appendChild(titleEl);

  if (subtitle) {
    const subtitleEl = document.createElement('div');
    subtitleEl.textContent = subtitle;
    Object.assign(subtitleEl.style, {
      fontSize: '13px',
      color: '#b0b5bd',
      marginTop: '2px',
      lineHeight: '1.2',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    });
    textWrapper.appendChild(subtitleEl);
  }

  toast.appendChild(iconWrapper);
  toast.appendChild(textWrapper);
  container.appendChild(toast);

  
  setTimeout(() => {
    toast.style.animation = 'ps4SlideOut 0.35s cubic-bezier(0.7, 0, 0.84, 0) forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    });
  }, duration);
}

/* Example usage:
showPS4Notification({
  title: 'Trophy Earned!',
  subtitle: 'Platinum - Master of the Realm',
  iconUrl: 'https://example.com'
});
*/
