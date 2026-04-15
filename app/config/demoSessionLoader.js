/**
 * config/demoSessionLoader.js
 *
 * Resolves demo configuration from URL parameters.
 *
 * Resolution order (first match wins):
 *   1. ?demo=SESSION_ID  -> fetches from /api/demo-sessions/{id}
 *   2. ?config=KEY       -> local config registry lookup (dev/testing)
 *   3. URL overrides     -> siteKey/theme/labels/behavior overrides
 *   4. (neither)         -> defaults
 */

import { resolveConfig as resolveRegistryConfig } from './configRegistry';

export async function resolveConfigFromURL() {
  if (typeof window === 'undefined') {
    return { config: {}, source: 'default', sessionId: null, error: null };
  }

  var params = new URLSearchParams(window.location.search);
  var baseConfig = {};
  var source = 'config-registry';
  var sessionId = null;
  var error = null;

  var demoId = params.get('demo');
  if (demoId) {
    var sessionResolved = await loadSessionFromAPI(demoId);
    baseConfig = sessionResolved.config || {};
    source = sessionResolved.source || 'demo-session';
    sessionId = sessionResolved.sessionId || demoId;
    error = sessionResolved.error || null;
  } else {
    var configKey = params.get('config');
    if (configKey) {
      baseConfig = resolveRegistryConfig(configKey);
      source = 'config-registry';
    } else {
      baseConfig = resolveRegistryConfig('default');
      source = 'config-registry';
    }
  }

  var overrides = parseUrlOverrides(params);
  var config = Object.keys(overrides).length > 0 ? deepMerge(baseConfig, overrides) : baseConfig;
  if (Object.keys(overrides).length > 0) source += '+url-overrides';

  return { config: config, source: source, sessionId: sessionId, error: error };
}

async function loadSessionFromAPI(sessionId) {
  var url = '/api/demo-sessions/' + encodeURIComponent(sessionId);
  try {
    var response = await fetch(url);
    if (response.status === 404) {
      return { config: {}, source: 'default', sessionId: sessionId, error: 'Session not found: ' + sessionId };
    }
    if (response.status === 410) {
      return { config: {}, source: 'default', sessionId: sessionId, error: 'Session expired or inactive: ' + sessionId };
    }
    if (!response.ok) {
      return { config: {}, source: 'default', sessionId: sessionId, error: 'API error: ' + response.status };
    }
    var session = await response.json();
    return { config: stripMeta(session), source: 'demo-session', sessionId: sessionId, error: null };
  } catch (err) {
    return { config: {}, source: 'default', sessionId: sessionId, error: 'Failed to load session: ' + err.message };
  }
}

function parseUrlOverrides(params) {
  var result = {};

  var siteKey = getParam(params, 'siteKey') || getParam(params, 'site_key');
  if (siteKey) result.siteKey = siteKey;

  var initialQuery = getParam(params, 'initialQuery');
  if (initialQuery) result.initialQuery = initialQuery;

  var answerProvider = getParam(params, 'answerProvider');
  if (answerProvider === 'conversations' || answerProvider === 'aiAnswers') {
    result.answerProvider = answerProvider;
  }

  var tags = getParam(params, 'tags');
  if (tags) result.tags = tags.split(',').map(function (t) { return t.trim(); }).filter(Boolean);

  var themeMap = {
    accentColor: 'accentColor',
    bgColor: 'bgColor',
    textColor: 'textColor',
    fontFamily: 'fontFamily',
    logoUrl: 'logoUrl',
    borderRadius: 'borderRadius',
  };
  var theme = extractMappedValues(params, themeMap);
  if (Object.keys(theme).length > 0) result.theme = theme;

  var labelMap = {
    heroTitle: 'heroTitle',
    heroSubtitle: 'heroSubtitle',
    searchPlaceholder: 'searchPlaceholder',
    searchButtonText: 'searchButtonText',
    headerSearchPlaceholder: 'headerSearchPlaceholder',
    aiAnswerLabel: 'aiAnswerLabel',
    followUpPlaceholder: 'followUpPlaceholder',
    footerBrand: 'footerBrand',
    footerBrandUrl: 'footerBrandUrl',
    footerTagline: 'footerTagline',
  };
  var labels = extractMappedValues(params, labelMap);
  if (Object.keys(labels).length > 0) result.labels = labels;

  return result;
}

function stripMeta(session) {
  var result = {};
  for (var key in session) {
    if (session.hasOwnProperty(key) && key !== '_meta') {
      result[key] = session[key];
    }
  }
  return result;
}

function getParam(params, key) {
  var value = params.get(key);
  if (!value) return '';
  try { return decodeURIComponent(value).trim(); } catch (e) { return value.trim(); }
}

function extractMappedValues(params, map) {
  var result = {};
  for (var key in map) {
    if (!map.hasOwnProperty(key)) continue;
    var val = getParam(params, key);
    if (val) result[map[key]] = val;
  }
  return result;
}

function deepMerge(target, source) {
  var result = Object.assign({}, target || {});
  for (var key in source) {
    if (!source.hasOwnProperty(key)) continue;
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
