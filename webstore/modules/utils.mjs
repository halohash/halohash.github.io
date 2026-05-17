function getFirefoxVersion() {
  if (navigator.userAgent.includes('Firefox/')) {
    const array = navigator.userAgent.split('/');
    const firefoxVersion = array[array.length - 1];
    return firefoxVersion;
  } else {
    return '128.0';
  }
}

export function getScrollbarWidth() {
  const outer = document.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll';
  outer.style.msOverflowStyle = 'scrollbar';
  document.body.appendChild(outer);

  const inner = document.createElement('div');
  outer.appendChild(inner);

  const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

  outer.parentNode.removeChild(outer);

  return scrollbarWidth;
}

document.querySelector(':root').style.setProperty('--scrollbar-width', `${getScrollbarWidth()}px`);

export const userLocale = navigator.language;
export const firefoxVersion = getFirefoxVersion();
