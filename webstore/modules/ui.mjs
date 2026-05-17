import * as api from './api.mjs';
import * as utils from './utils.mjs';
let detailsOpen = false;

export function populateStarRating(number, parent) {
  const roundedNumber = Math.round(number * 2) / 2;

  for (let i = 0; i < 5; i++) {
    if (i < Math.floor(roundedNumber)) {
      const starElement = document.createElement('span');
      starElement.classList.add('star-full');
      parent.appendChild(starElement);
    } else if (i < roundedNumber) {
      const starElement = document.createElement('span');
      starElement.classList.add('star-half');
      parent.appendChild(starElement);
    } else {
      const starElement = document.createElement('span');
      starElement.classList.add('star-empty');
      parent.appendChild(starElement);
    }
  }
}

export function createCategory(hasHeader = false, type = 'grid', title = 'Title', summary = 'Summary', action = 'View all', slug) {
  const categoryElement = document.createElement('a');
  const categoryItems = document.createElement('div');

  categoryElement.classList.add('category');

  if (hasHeader) {
    const headerHtml = `
    <a class="category-header" href="javascript:void(0)">
      <div class="category-details">
        <span class="category-title">${title}</span>
        <span class="category-description">${summary}</span>
      </div>
      <span class="category-action">${action}</span>
    </a>
    `;

    categoryElement.innerHTML = headerHtml;
  }

  categoryItems.classList.add(`category-items-${type}`);

  categoryElement.appendChild(categoryItems);

  document.getElementById('content-items').appendChild(categoryElement);

  return categoryElement;
}

export async function openAddonDetails(slug, e, same) {
  if (detailsOpen == true) {
    return;
  }

  if (same) {
    e.preventDefault();
  }

  detailsOpen = true;

  const url = window.location.search;
  const urlParams = new URLSearchParams(url);

  urlParams.set('details', slug);
  window.history.pushState({}, '', `${window.location.pathname}?${urlParams.toString()}`);

  const json = await api.fetchAddonDetails(slug, utils.firefoxVersion, utils.userLocale);
  const detailsElement = document.createElement('div');
  detailsElement.id = 'details-background';

  const baseHtml = `
    <div id="details-main">
      <div id="details-close"></div>
      <div id="details-header">
        <div id="details-information">
          <div class="details-information-icon" id="${json.type}">
            <img id="details-information-icon" src="${json.icon}"/>
          </div>
          <div id="details-information-data">
            <span id="details-information-data-title">${json.name}</span>
            <div id="details-information-data-row">
              <div class="rating-container">
                <div class="stars-container">
                </div>
                <span class="rating-count">${json.rating.count}</span>
              </div>
              <div class="details-information-data-row-separator"></div>
              <a id="details-information-data-row-category" href="/?type=${json.type}&category=${json.category_slug}">${json.category}</a>
              <div class="details-information-data-row-separator"></div>
              <span id="details-information-data-row-author">from ${json.author}</span>
              <div class="details-information-data-row-separator"></div>
              <span id="details-information-data-row-users">${json.users} users</span>
            </div>
          </div>
          <div id="details-information-actions">
            <a id="details-information-add-button" href="${json.file.url}">
              <span class="details-information-add-icon"></span> Add to Chrome
            </a>
          </div>
        </div>
      </div>
      <div id="details-navigation">
        <a class="details-navigation-button" href="#" id="active">Overview</a>
        <!--<a class="details-navigation-button" href="#">Details</a>
        <a class="details-navigation-button" href="#">Reviews</a>
        <a class="details-navigation-button" href="#">Related</a>-->
      </div>
      <div id="details-content">
        <div id="overview-section">
          <div id="overview-slideshow-container">
            <div id="overview-slideshow-buttons">
            </div>
            <div id="overview-slideshow">
            </div>
          </div>
          <div id="overview-information">
            <span id="overview-title">${json.name}</span>
            <span id="overview-description">${json.description}</span>
          </div>
        </div>
      </div>
    </div>
  `;

  detailsElement.innerHTML = baseHtml;

  document.body.style.overflow = 'hidden';

  if (document.body.scrollHeight > document.body.clientHeight) {
    document.body.style.marginRight = `${utils.getScrollbarWidth()}px`;
  }

  populateStarRating(json.rating.average, detailsElement.querySelector('.stars-container'));

  Object.keys(json.previews).forEach((element) => {
    const previewImg = document.createElement('img');
    const previewButton = document.createElement('div');
    previewImg.src = json.previews[element];
    previewImg.classList.add('overview-slideshow-image');
    previewImg.setAttribute('data-img-id', element);
    previewImg.tabIndex = 0;
    previewButton.classList.add('overview-slideshow-button');
    previewButton.setAttribute('data-img-id', element);
    previewButton.addEventListener('click', function () {
      detailsElement.querySelector('.overview-slideshow-button#active').removeAttribute('id');
      previewButton.id = 'active';
      detailsElement.querySelector('#overview-slideshow').scroll({
        left: previewImg.offsetLeft - 42,
        top: 0,
        behavior: 'smooth',
      });
    });
    if (previewButton.getAttribute('data-img-id') == 0) {
      previewButton.id = 'active';
    }
    detailsElement.querySelector('#overview-slideshow-buttons').appendChild(previewButton);
    detailsElement.querySelector('#overview-slideshow').appendChild(previewImg);
  });

  detailsElement.addEventListener('click', (e) => {
    if (e.target.id == 'details-close' && detailsOpen == true) {
      urlParams.delete('details');
      window.history.pushState({}, '', `${window.location.pathname}?${urlParams.toString()}`);
      detailsElement.classList.add('closed');
      detailsElement.addEventListener(
        'transitionend',
        function handleTransitionEnd() {
          detailsElement.remove();
          document.body.removeAttribute('style');
          detailsOpen = false;
          detailsElement.removeEventListener('transitionend', handleTransitionEnd);
        },
        {once: true},
      );
    }
  });

  document.getElementById('main').prepend(detailsElement);
}

export async function createGridItem(json, parent) {
  const newUrl = new URL('/', window.location.href);
  const newUrlParams = new URLSearchParams(newUrl);
  newUrlParams.set('details', json.slug);

  const gridItem = document.createElement('a');
  gridItem.classList.add('grid-item');
  gridItem.href = `${newUrl.pathname}?${newUrlParams.toString()}`;
  gridItem.addEventListener('click', function (e) {
    openAddonDetails(json.slug, e, true);
  });

  const baseHtml = `
  <div class="grid-item-thumbnail-container">
    <img
      class="grid-item-thumbnail"
      src="${json.thumbnail.url}"
      width="${json.thumbnail.width}"
      height="${json.thumbnail.height}"
    />
    <span class="grid-item-summary"
      >${json.summary}</span
    >
  </div>
  <div class="grid-item-details">
    <span class="grid-item-title">${json.name}</span>
    <div class="rating-container">
      <div class="stars-container">
      </div>
      <span class="rating-count">(${json.rating.count})</span>
    </div>
  </div>
  `;
  gridItem.innerHTML = baseHtml;

  populateStarRating(json.rating.average, gridItem.querySelector('.stars-container'));

  parent.appendChild(gridItem, gridItem.querySelector('.stars-container'));
}

export async function createListItem(json, parent) {
  const newUrl = new URL('/', window.location.href);
  const newUrlParams = new URLSearchParams(newUrl);
  newUrlParams.set('details', json.slug);

  const listItem = document.createElement('a');
  listItem.classList.add('list-item');
  listItem.href = `${newUrl.pathname}?${newUrlParams.toString()}`;
  listItem.addEventListener('click', function (e) {
    openAddonDetails(json.slug, e, true);
  });

  const baseHtml = `
  <div class="list-item-thumbnail-container">
    <img
      class="list-item-thumbnail"
      src="${json.thumbnail.url}"
      width="${json.thumbnail.width}"
      height="${json.thumbnail.height}"
    />
  </div>
  <div class="list-item-details">
    <span class="list-item-title">${json.name}</span>
    <span class="list-item-author">from ${json.author}</span>
    <span class="list-item-summary">${json.summary}</span>
  </div>
  <div class="list-item-extra-details">
    <span class="list-item-category">${json.category}</span>
    <div class="rating-container">
      <div class="stars-container">
      </div>
      <span class="rating-count">(${json.rating.count})</span>
    </div>
  </div>
  `;
  listItem.innerHTML = baseHtml;

  populateStarRating(json.rating.average, listItem.querySelector('.stars-container'));

  parent.appendChild(listItem, listItem.querySelector('.stars-container'));
}
