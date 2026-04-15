/**
 * services/keywordSearchService.js
 * Wraps AddSearch Search UI Library. Reads config at call time via getConfig().
 */

import { getConfig } from '../config/app.config';

var _sharedClient = null;
var _sharedClientKey = null;

/** Get or create the shared AddSearchClient. */
export function getClient() {
  var config = getConfig();
  var siteKey = config.siteKey;
  if (!siteKey) return null;

  if (_sharedClient && _sharedClientKey === siteKey) return _sharedClient;
  if (typeof window === 'undefined' || !window.AddSearchClient) return null;

  try {
    _sharedClient = new window.AddSearchClient(siteKey);
    _sharedClientKey = siteKey;
    return _sharedClient;
  } catch (e) {
    return null;
  }
}

/** Reset the shared client (e.g. after config change). */
export function resetClient() {
  _sharedClient = null;
  _sharedClientKey = null;
}

/** Initialize keyword search UI. Retries if CDN scripts aren't ready yet. */
export function initKeywordSearch(query) {
  var config = getConfig();
  var ids = config.containerIds;

  function tryInit() {
    if (typeof window === 'undefined' || !window.AddSearchClient || !window.AddSearchUI) {
      setTimeout(tryInit, 200);
      return;
    }

    Object.values(ids).forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });

    try {
      var client = new window.AddSearchClient(config.siteKey);
      var searchui = new window.AddSearchUI(client, { updateBrowserHistory: false });

      searchui.searchResults({ containerId: ids.results });
      searchui.filters({
        containerId: ids.filters,
        type: window.AddSearchUI.FILTER_TYPE.TABS,
        options: config.filterOptions,
      });
      searchui.sortBy({ containerId: ids.sortBy, options: config.sortOptions });
      searchui.pagination({ containerId: ids.pagination });
      searchui.start();
      setTimeout(function () { if (searchui.search) searchui.search(query); }, 100);
    } catch (e) { console.error('Search UI init error:', e); }
  }

  tryInit();
}

/** Fetch related results (normalized). */
export function fetchRelatedResults(query) {
  var config = getConfig();
  return new Promise(function (resolve) {
    if (!query) { resolve({ results: [], totalHits: 0 }); return; }
    function trySearch() {
      var client = getClient();
      if (!client) { setTimeout(trySearch, 300); return; }
      try {
        client.search(query, function (r) {
          if (r && r.hits && r.hits.length > 0) {
            resolve({
              results: r.hits.slice(0, config.maxRelatedResults).map(function (h) {
                var thumb = h.images ? (h.images.main || h.images.capture || '') : '';
                return { title: h.title || '', url: h.url || '', thumbnail: thumb };
              }),
              totalHits: r.total_hits || 0,
            });
          } else { resolve({ results: [], totalHits: 0 }); }
        });
      } catch (e) { resolve({ results: [], totalHits: 0 }); }
    }
    trySearch();
  });
}


export function fetchDoctorProfilesByNames(names, options) {
  var limit = options && options.limit ? options.limit : 6;
  var uniqueNames = [];
  var seen = {};

  (names || []).forEach(function (name) {
    var cleaned = cleanValue(name);
    var key = normalizeLookupValue(cleaned);
    if (!cleaned || !key || seen[key]) return;
    seen[key] = true;
    uniqueNames.push(cleaned);
  });

  uniqueNames = uniqueNames.slice(0, limit);

  return new Promise(function (resolve) {
    if (!uniqueNames.length) {
      resolve([]);
      return;
    }

    function trySearch() {
      var client = getClient();
      if (!client) {
        setTimeout(trySearch, 300);
        return;
      }

      Promise.all(uniqueNames.map(function (name) {
        return searchDoctorProfile(client, name);
      })).then(function (profiles) {
        resolve(profiles.filter(Boolean));
      }).catch(function () {
        resolve([]);
      });
    }

    trySearch();
  });
}


export function fetchDoctorProfilesForQuery(query, options) {
  var limit = options && options.limit ? options.limit : 6;
  var normalizedQuery = cleanValue(query);
  return new Promise(function (resolve) {
    if (!normalizedQuery) {
      resolve([]);
      return;
    }

    function trySearch() {
      var client = getClient();
      if (!client) {
        setTimeout(trySearch, 300);
        return;
      }

      try {
        client.search(normalizedQuery, function (response) {
          var hits = response && response.hits ? response.hits : [];
          var profiles = hits
            .map(normalizeDoctorProfileHit)
            .filter(function (item) { return !!item && isDoctorProfileUrl(item.url); });

          var unique = [];
          var seen = {};
          profiles.forEach(function (profile) {
            var key = normalizeLookupValue(profile.name || profile.url);
            if (!key || seen[key]) return;
            seen[key] = true;
            unique.push(profile);
          });

          resolve(unique.slice(0, limit));
        });
      } catch (error) {
        resolve([]);
      }
    }

    trySearch();
  });
}

export function fetchCompareCandidates(query, options) {
  var limit = options && options.limit ? options.limit : 8;
  return new Promise(function (resolve) {
    if (!query) {
      resolve({ results: [], totalHits: 0, error: null });
      return;
    }

    function trySearch() {
      var client = getClient();
      if (!client) {
        setTimeout(trySearch, 300);
        return;
      }

      try {
        client.search(query, function (response) {
          var hits = response && response.hits ? response.hits : [];
          var normalized = hits
            .map(normalizeCompareHit)
            .filter(function (item) { return !!item; })
            .slice(0, limit);

          resolve({
            results: normalized,
            totalHits: response && response.total_hits ? response.total_hits : normalized.length,
            error: null,
          });
        });
      } catch (error) {
        resolve({ results: [], totalHits: 0, error: error && error.message ? error.message : 'Search failed' });
      }
    }

    trySearch();
  });
}

function normalizeCompareHit(hit) {
  if (!hit) return null;

  var name = firstNonEmpty([
    hit.title,
    pickDeep(hit, ['meta', 'title']),
    pickDeep(hit, ['customFields', 'pageTitle']),
    pickDeep(hit, ['customFields', 'pageName']),
    pickDeep(hit, ['custom_fields', 'pageTitle']),
    pickDeep(hit, ['custom_fields', 'pageName']),
    pickDeep(hit, ['custom_fields', 'title'])
  ]);
  var url = firstNonEmpty([
    pickDeep(hit, ['customFields', 'pagePath']),
    pickDeep(hit, ['custom_fields', 'pagePath']),
    hit.url,
    pickDeep(hit, ['meta', 'url'])
  ]);
  if (!name && !url) return null;

  var specialty = firstNonEmpty([
    hit.specialty,
    hit.profession,
    hit.role,
    hit.occupation,
    pickDeep(hit, ['customFields', 'title']),
    pickDeep(hit, ['customFields', 'expertise']),
    pickDeep(hit, ['custom_fields', 'specialty']),
    pickDeep(hit, ['custom_fields', 'title']),
    pickDeep(hit, ['custom_fields', 'expertise']),
    pickDeep(hit, ['meta', 'specialty']),
    hit.category,
    'Professional profile'
  ]);

  var location = firstNonEmpty([
    hit.location,
    hit.address,
    hit.city,
    pickDeep(hit, ['custom_fields', 'location']),
    pickDeep(hit, ['meta', 'location']),
    'See profile'
  ]);

  var languages = toArray(firstNonEmpty([
    hit.languages,
    hit.language,
    pickDeep(hit, ['custom_fields', 'languages']),
    pickDeep(hit, ['meta', 'languages'])
  ]));

  var visitTypes = toArray(firstNonEmpty([
    hit.visitTypes,
    hit.visitType,
    pickDeep(hit, ['custom_fields', 'visitTypes']),
    pickDeep(hit, ['meta', 'visitTypes'])
  ]));

  var nextAvailable = firstNonEmpty([
    hit.nextAvailable,
    hit.availability,
    pickDeep(hit, ['custom_fields', 'nextAvailable']),
    pickDeep(hit, ['meta', 'nextAvailable']),
    'Check booking'
  ]);

  var snippet = firstNonEmpty([
    hit.description,
    hit.summary,
    hit.text,
    pickDeep(hit, ['custom_fields', 'description']),
    pickDeep(hit, ['meta', 'description'])
  ]) || '';

  if (visitTypes.length === 0 && /video|remote|online/i.test(snippet)) visitTypes = ['Video'];
  if (visitTypes.length === 0) visitTypes = ['Check profile'];
  if (languages.length === 0 && /english/i.test(snippet)) languages = ['English'];
  if (languages.length === 0) languages = ['See profile'];

  return {
    id: String(firstNonEmpty([hit.id, url, name])),
    name: name || 'Professional',
    specialty: specialty,
    location: location,
    languages: languages,
    visitTypes: visitTypes,
    nextAvailable: nextAvailable,
    fit: snippet ? truncate(snippet, 120) : 'Open profile to review this professional.',
    reasons: [
      specialty,
      location,
      visitTypes.join(', ')
    ].filter(Boolean),
    bio: snippet,
    url: normalizeProfileUrl(url || '#'),
    imageUrl: extractImageUrl(hit),
    source: 'live'
  };
}

function firstNonEmpty(values) {
  for (var i = 0; i < values.length; i += 1) {
    var value = extractScalar(values[i]);
    if (Array.isArray(value) && value.length) return value;
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value && typeof value !== 'object') return value;
  }
  return '';
}

function extractScalar(value) {
  if (value == null) return '';
  if (Array.isArray(value)) {
    for (var i = 0; i < value.length; i += 1) {
      var nested = extractScalar(value[i]);
      if (Array.isArray(nested) && nested.length) return nested;
      if (typeof nested === 'string' && nested.trim()) return nested.trim();
      if (nested && typeof nested !== 'object') return nested;
    }
    return '';
  }

  if (typeof value === 'object') {
    var preferredKeys = ['value', 'raw', 'text', 'label', 'title', 'name', 'path', 'src', 'url', 'main', 'capture'];
    for (var j = 0; j < preferredKeys.length; j += 1) {
      var key = preferredKeys[j];
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        var preferred = extractScalar(value[key]);
        if (preferred) return preferred;
      }
    }

    var objectKeys = Object.keys(value);
    for (var k = 0; k < objectKeys.length; k += 1) {
      var nestedValue = extractScalar(value[objectKeys[k]]);
      if (nestedValue) return nestedValue;
    }

    return '';
  }

  return value;
}

function pickDeep(obj, path) {
  var current = obj;
  for (var i = 0; i < path.length; i += 1) {
    if (!current || typeof current !== 'object') return '';
    current = current[path[i]];
  }
  return extractScalar(current) || '';
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(extractScalar).map(cleanValue).filter(Boolean);
  if (typeof value === 'string') return value.split(/[,|/]/).map(cleanValue).filter(Boolean);
  return [cleanValue(String(extractScalar(value) || value))].filter(Boolean);
}

function cleanValue(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function truncate(text, maxLen) {
  var clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen - 1).trim() + '…';
}


function searchDoctorProfile(client, name) {
  return new Promise(function (resolve) {
    try {
      client.search(name, function (response) {
        var hits = response && response.hits ? response.hits : [];
        var profiles = hits
          .map(normalizeDoctorProfileHit)
          .filter(function (item) { return !!item; });

        var targetKey = normalizeLookupValue(name);
        var best = profiles.find(function (profile) {
          return normalizeLookupValue(profile.name) === targetKey && isDoctorProfileUrl(profile.url);
        }) || profiles.find(function (profile) {
          return normalizeLookupValue(profile.name) === targetKey;
        }) || profiles.find(function (profile) {
          return isDoctorProfileUrl(profile.url);
        }) || profiles[0] || null;

        resolve(best);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

function normalizeDoctorProfileHit(hit) {
  if (!hit) return null;

  var name = firstNonEmpty([
    hit.title,
    pickDeep(hit, ['meta', 'title']),
    pickDeep(hit, ['customFields', 'pageTitle']),
    pickDeep(hit, ['customFields', 'pageName']),
    pickDeep(hit, ['custom_fields', 'pageTitle']),
    pickDeep(hit, ['custom_fields', 'pageName']),
    pickDeep(hit, ['custom_fields', 'title'])
  ]);
  var url = firstNonEmpty([
    pickDeep(hit, ['customFields', 'pagePath']),
    pickDeep(hit, ['custom_fields', 'pagePath']),
    hit.url,
    pickDeep(hit, ['meta', 'url'])
  ]);
  if (!name && !url) return null;

  var specialty = firstNonEmpty([
    hit.specialty,
    hit.profession,
    hit.role,
    hit.occupation,
    pickDeep(hit, ['customFields', 'title']),
    pickDeep(hit, ['customFields', 'expertise']),
    pickDeep(hit, ['custom_fields', 'specialty']),
    pickDeep(hit, ['custom_fields', 'title']),
    pickDeep(hit, ['custom_fields', 'expertise']),
    pickDeep(hit, ['meta', 'specialty']),
    hit.category,
    'Professional profile'
  ]);

  return {
    id: String(firstNonEmpty([hit.id, url, name])),
    name: name || 'Professional',
    specialty: specialty,
    url: normalizeProfileUrl(url || '#'),
    imageUrl: extractImageUrl(hit)
  };
}


function normalizeProfileUrl(url) {
  var str = String(url || '').trim();
  if (!str) return '#';
  if (/^https?:\/\//i.test(str)) return str;
  if (str.charAt(0) === '/') return 'https://www.mehilainen.fi' + str;
  return str;
}

function extractImageUrl(hit) {
  var raw = firstNonEmpty([
    hit.picturePath,
    hit.picturepath,
    hit.image,
    hit.thumbnail,
    hit.thumbnailUrl,
    pickDeep(hit, ['custom_fields', 'picturePath']),
    pickDeep(hit, ['custom_fields', 'picturepath']),
    pickDeep(hit, ['customFields', 'picturePath']),
    pickDeep(hit, ['customFields', 'picturepath']),
    pickDeep(hit, ['meta', 'picturePath']),
    pickDeep(hit, ['meta', 'picturepath']),
    pickDeep(hit, ['images', 'main']),
    pickDeep(hit, ['images', 'capture']),
    pickDeep(hit, ['image', 'src']),
    pickDeep(hit, ['image', 'url'])
  ]);

  return normalizeImageUrl(raw);
}

function normalizeImageUrl(value) {
  if (!value) return '';
  if (Array.isArray(value)) value = firstNonEmpty(value);
  var str = String(value || '').trim();
  if (!str) return '';
  if (/^https?:\/\//i.test(str)) return str;
  if (str.indexOf('//') === 0) return 'https:' + str;
  if (str.charAt(0) === '/') {
    if (/\/media\//i.test(str) || /\/images?\//i.test(str)) {
      return 'https://media3.mehilainen.fi' + str;
    }
    return 'https://www.mehilainen.fi' + str;
  }
  if (/^(media|terveyspalvelut\/media|images?\/)/i.test(str)) {
    return 'https://media3.mehilainen.fi/' + str.replace(/^\/+/, '');
  }
  if (/^[a-z0-9_-]+\.(jpg|jpeg|png|webp|gif)$/i.test(str)) {
    return 'https://media3.mehilainen.fi/terveyspalvelut/media/images/l/' + str;
  }
  return str;
}

function isDoctorProfileUrl(url) {
  return /\/doctors-and-specialists\//i.test(String(url || ''));
}

function normalizeLookupValue(value) {
  return cleanValue(value).toLowerCase().replace(/[^a-zà-öø-ÿåäö0-9]+/g, ' ').trim();
}


export function extractDoctorNameFromSourceTitle(title) {
  var raw = cleanValue(title);
  if (!raw) return '';
  var beforeComma = raw.split(',')[0];
  var beforeDash = beforeComma.split(' - ')[0];
  return looksLikePersonName(beforeDash) ? beforeDash : '';
}

function looksLikePersonName(value) {
  if (!value) return false;
  var parts = cleanValue(value).split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return false;
  for (var i = 0; i < parts.length; i += 1) {
    if (!/^[A-ZÅÄÖÉÜ][A-Za-zÀ-ÖØ-öø-ÿÅÄÖåäöÉéÜü'’-]+$/.test(parts[i])) return false;
  }
  return true;
}

export function mergeDoctorNames(names, sources) {
  var merged = [];
  var seen = {};

  function pushName(name) {
    var cleaned = cleanValue(name);
    var key = normalizeLookupValue(cleaned);
    if (!cleaned || !key || seen[key]) return;
    seen[key] = true;
    merged.push(cleaned);
  }

  (names || []).forEach(pushName);
  (sources || []).forEach(function (source) {
    if (!source) return;
    pushName(extractDoctorNameFromSourceTitle(source.title));
  });

  return merged;
}
