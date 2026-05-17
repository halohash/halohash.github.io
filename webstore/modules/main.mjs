import * as api from './api.mjs';
import * as utils from './utils.mjs';
import * as gui from './ui.mjs';

const url = window.location.search;
const urlParams = new URLSearchParams(url);

if (urlParams.get('q')) {
  document.getElementById('sidebar-search').value = urlParams.get('q');
}

if (urlParams.get('details')) {
  gui.openAddonDetails(urlParams.get('details'));
}

if (!urlParams.get('type') && !urlParams.get('category') && urlParams.get('q')) {
  const throbberElement = document.createElement('span');
  throbberElement.classList.add('throbber');
  document.getElementById('content-items').classList.add('loading');
  document.getElementById('content-header').prepend(throbberElement);

  const extensionResults = await api.getSearchResults(urlParams.get('q'), 'extension', utils.firefoxVersion, utils.userLocale, 1, 3);
  const themeResults = await api.getSearchResults(urlParams.get('q'), 'statictheme', utils.firefoxVersion, utils.userLocale, 1, 3);

  if (extensionResults == false) {
    document.querySelectorAll('.sidebar-item').forEach((item) => {
      if (item.getAttribute('data-slug') == 'extension') {
        item.remove();
      }
    });
  } else {
    const extensionCategory = gui.createCategory(true, 'list', 'Extensions', '', `${extensionResults.max} of ${extensionResults.count} Extension Results`);

    extensionCategory.querySelector('.category-header').addEventListener('click', function () {
      urlParams.set('type', 'extension');
      window.location.href = `${window.location.pathname}?${urlParams.toString()}`;
    });

    extensionResults.items.forEach((item) => {
      gui.createListItem(item, extensionCategory.querySelector("[class*='category-items-']"));
    });
  }

  if (themeResults == false) {
    document.querySelectorAll('.sidebar-item').forEach((item) => {
      if (item.getAttribute('data-slug') == 'statictheme') {
        item.remove();
      }
    });
  } else {
    const themeCategory = gui.createCategory(true, 'list', 'Themes', '', `${themeResults.max} of ${themeResults.count} Theme Results`);

    themeCategory.querySelector('.category-header').addEventListener('click', function () {
      urlParams.set('type', 'statictheme');
      window.location.href = `${window.location.pathname}?${urlParams.toString()}`;
    });

    themeResults.items.forEach((item) => {
      gui.createListItem(item, themeCategory.querySelector("[class*='category-items-']"));
    });
  }

  if (extensionResults == false && themeResults == false) {
    const searchError = document.createElement('span');
    searchError.id = 'search-error';
    searchError.innerHTML = `
    Your search for "${urlParams.get('q')}" did not match any items.
    <div id="search-error-suggestions">
      Suggestions:
      <ul>
        <li>Make sure that all words are spelled correctly.</li>
        <li>Try different Keywords.</li>
        <li>Try more general keywords.</li>
      </ul>
    </div>
    `;
    document.getElementById('content-items').appendChild(searchError);
  }
  document.getElementById('content-items').classList.remove('loading');
  throbberElement.remove();
} else if (urlParams.get('type') && !urlParams.get('category') && urlParams.get('q')) {
  const throbberElement = document.createElement('span');
  throbberElement.classList.add('throbber');
  document.getElementById('content-items').classList.add('loading');
  document.getElementById('content-header').prepend(throbberElement);

  let pageCount = 1;

  if (urlParams.get('type') == 'statictheme') {
    const testResults = await api.getSearchResults(urlParams.get('q'), 'extension', utils.firefoxVersion, utils.userLocale, pageCount, 1);
    if (testResults == false) {
      document.querySelectorAll('.sidebar-item').forEach((item) => {
        if (item.getAttribute('data-slug') == 'extension') {
          item.remove();
        }
      });
    }
  } else if (urlParams.get('type') == 'extension') {
    const testResults = await api.getSearchResults(urlParams.get('q'), 'statictheme', utils.firefoxVersion, utils.userLocale, pageCount, 1);
    if (testResults == false) {
      document.querySelectorAll('.sidebar-item').forEach((item) => {
        if (item.getAttribute('data-slug') == 'statictheme') {
          item.remove();
        }
      });
    }
  }

  const results = await api.getSearchResults(urlParams.get('q'), urlParams.get('type'), utils.firefoxVersion, utils.userLocale, pageCount, 20);

  const category = gui.createCategory(false, 'list');

  const moreButton = document.createElement('span');
  moreButton.id = 'more-button';
  moreButton.textContent = 'See other results';

  moreButton.addEventListener('click', async function () {
    pageCount += 1;
    moreButton.classList.add('throbber');
    const nextResults = await api.getSearchResults(urlParams.get('q'), urlParams.get('type'), utils.firefoxVersion, utils.userLocale, pageCount, 20);

    if (nextResults == false) {
      moreButton.remove();
      return;
    }

    nextResults.items.forEach((item) => {
      gui.createListItem(item, category.querySelector("[class*='category-items-']"));
    });
    moreButton.classList.remove('throbber');
  });

  results.items.forEach((item) => {
    gui.createListItem(item, category.querySelector("[class*='category-items-']"));
  });

  category.appendChild(moreButton);

  document.getElementById('content-items').classList.remove('loading');
  throbberElement.remove();
} else if (urlParams.get('type') && urlParams.get('category') && !urlParams.get('q')) {
  const throbberElement = document.createElement('span');
  throbberElement.classList.add('throbber');
  document.getElementById('content-items').classList.add('loading');
  document.getElementById('content-header').prepend(throbberElement);
  document.querySelectorAll('.sidebar-item').forEach((item) => {
    if (urlParams.get('type') != item.getAttribute('data-slug')) {
      item.remove();
    }
  });

  let pageCount = 1;

  const results = await api.getSearchResults('', urlParams.get('type'), utils.firefoxVersion, utils.userLocale, pageCount, 20, `&category=${urlParams.get('category')}`);

  const category = gui.createCategory(false, 'list');

  const moreButton = document.createElement('span');
  moreButton.id = 'more-button';
  moreButton.textContent = 'See other results';

  moreButton.addEventListener('click', async function () {
    pageCount += 1;
    moreButton.classList.add('throbber');
    const nextResults = await api.getSearchResults(urlParams.get('q'), urlParams.get('type'), utils.firefoxVersion, utils.userLocale, pageCount, 20);

    if (nextResults == false) {
      moreButton.remove();
      return;
    }

    nextResults.items.forEach((item) => {
      gui.createListItem(item, category.querySelector("[class*='category-items-']"));
    });
    moreButton.classList.remove('throbber');
  });

  results.items.forEach((item) => {
    gui.createListItem(item, category.querySelector("[class*='category-items-']"));
  });

  category.appendChild(moreButton);

  document.getElementById('content-items').classList.remove('loading');
  throbberElement.remove();
} else if (urlParams.get('type') && !urlParams.get('category') && !urlParams.get('q')) {
  const throbberElement = document.createElement('span');
  throbberElement.classList.add('throbber');
  document.getElementById('content-items').classList.add('loading');
  document.getElementById('content-header').prepend(throbberElement);
  for (const item of api.categoriesJson) {
    if (item.type != urlParams.get('type')) {
      continue;
    }

    const results = await api.getSearchResults('', item.type, utils.firefoxVersion, utils.userLocale, 1, 8, `&sort=recommended&category=${item.slug}`);

    const category = gui.createCategory(true, 'grid', item.name, item.description, 'View all');

    category.querySelector('.category-header').addEventListener('click', function () {
      urlParams.set('type', item.type);
      urlParams.set('category', item.slug);
      window.location.href = `${window.location.pathname}?${urlParams.toString()}`;
    });

    results.items.forEach((item) => {
      gui.createGridItem(item, category.querySelector("[class*='category-items-']"));
    });
  }
  document.getElementById('content-items').classList.remove('loading');
  throbberElement.remove();
} else {
  const throbberElement = document.createElement('span');
  throbberElement.classList.add('throbber');
  document.getElementById('content-items').classList.add('loading');
  document.getElementById('content-header').prepend(throbberElement);
  for (const item of api.categoriesJson) {
    if (item.type != 'extension' && item.type != 'statictheme') {
      continue;
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    const results = await api.getSearchResults('', item.type, utils.firefoxVersion, utils.userLocale, 1, 8, `&sort=recommended&category=${item.slug}`);

    const category = gui.createCategory(true, 'grid', item.name, item.description, 'View all');

    category.querySelector('.category-header').addEventListener('click', function () {
      urlParams.set('type', item.type);
      urlParams.set('category', item.slug);
      window.location.href = `${window.location.pathname}?${urlParams.toString()}`;
    });

    results.items.forEach((item) => {
      gui.createGridItem(item, category.querySelector("[class*='category-items-']"));
    });
  }
  document.getElementById('content-items').classList.remove('loading');
  throbberElement.remove();
}

document.querySelectorAll('.sidebar-item').forEach((item) => {
  item.addEventListener('click', function () {
    urlParams.set('type', item.getAttribute('data-slug'));
    window.location.href = `${window.location.pathname}?${urlParams.toString()}`;
  });
  if (urlParams.get('type') && urlParams.get('type') == item.getAttribute('data-slug')) {
    item.id = 'active';
  }
});
