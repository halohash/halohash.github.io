const categories = await fetch(`https://addons.mozilla.org/api/v5/addons/categories/`);
export const categoriesJson = await categories.json();

export async function formatAddonDetails(json, locale = 'en-US') {
  let formattedJson = {
    slug: 'unknown',
    name: 'Untitled',
    author: 'unknown',
    type: 'unknown',
    users: 0,
    summary: 'No summary provided.',
    description: 'No description provided.',
    icon: './images/empty.png',
    file: {
      url: '#',
      version: '0.0',
    },
    thumbnail: {
      url: './images/empty.png',
      width: '100%',
      height: '100%',
    },
    category_slug: 'none',
    category: 'None',
    previews: {
      0: './images/empty.png',
    },
    rating: {
      average: 0,
      count: 0,
    },
  };

  // Fill in json template

  // Set slug
  formattedJson.slug = json.slug;

  // Set name
  if (json.name) {
    formattedJson.name = json.name[locale] || json.name[json.name._default] || json.name[json.default_locale];
  }

  // Set author
  formattedJson.author = json.authors[0].name;

  // Set type
  switch (json.type) {
    case 'extension':
      formattedJson.type = 'extension';
      break;
    case 'statictheme':
      formattedJson.type = 'statictheme';
      break;
  }

  // Set users
  formattedJson.users = json.average_daily_users.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Set summary
  if (json.summary) {
    formattedJson.summary = json.summary[locale] || json.summary[json.summary._default];
    formattedJson.summary = formattedJson.summary.replace(/<[^>]*>/g, '');
  }

  // Set description
  if (json.description) {
    formattedJson.description = json.description[locale] || json.description[json.description._default];
  } else if (!json.description && json.summary) {
    formattedJson.description = json.summary[locale] || json.summary[json.summary._default];
  }
  formattedJson.description = formattedJson.description.replace(/\n/g, '<br>');

  // Set Icon
  formattedJson.icon = json.icons[32];

  // Set file & version
  formattedJson.file.url = json.current_version.file.url;
  formattedJson.file.version = json.current_version.version;

  // Set thumbnail & previews
  if (json.previews && json.previews[0]) {
    if (json.type == 'statictheme') {
      formattedJson.thumbnail.url = json.previews[1].image_url;
      formattedJson.previews[0] = json.previews[1].image_url;
    } else {
      formattedJson.thumbnail.url = json.previews[0].thumbnail_url;
      json.previews.forEach((i) => {
        formattedJson.previews[i.position] = i.image_url;
      });
    }
  } else {
    formattedJson.thumbnail.url = json.icons['64'];
    formattedJson.thumbnail.width = '50px';
    formattedJson.thumbnail.height = '50px';
  }

  // Set category
  formattedJson.category_slug = json.categories[0];

  categoriesJson.forEach((item) => {
    if (item.slug == json.categories[0]) {
      formattedJson.category = item.name;
    }
  });

  // Set rating
  formattedJson.rating.average = Math.round(json.ratings.average * 2) / 2;
  formattedJson.rating.count = json.ratings.count;

  return formattedJson;
}

export async function fetchAddonDetails(slug, version = '128.0', locale = 'en-US') {
  const url = `https://addons.mozilla.org/api/v5/addons/addon/${slug}?app=firefox&version=${version}&lang=${locale}`;
  const response = await fetch(url);
  const json = await response.json();
  return formatAddonDetails(json, locale);
}

export async function getSearchResults(query, type = 'extension', version = '128.0', locale = 'en-US', page = 1, amount = 8, extra = '') {
  const url = `https://addons.mozilla.org/api/v5/addons/search/?app=firefox&appversion=${version}&q=${query}&lang=${locale}&page=${page}&page_size=${amount}&type=${type}${extra}`;
  const response = await fetch(url);
  const json = await response.json();

  if (!response.ok || json.count == 0) {
    return false;
  }

  let formattedJson = {
    max: 0,
    count: 0,
    items: [],
  };

  formattedJson.max = json.page_size;
  formattedJson.count = json.count;

  json.results.forEach(async (item) => {
    const addonJson = await formatAddonDetails(item, locale);
    formattedJson.items.push(addonJson);
  });

  return formattedJson;
}
