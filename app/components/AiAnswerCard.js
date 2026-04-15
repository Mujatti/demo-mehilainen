/**
 * components/AiAnswerCard.js
 * Dumb component. All labels from props. Never imports config.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import SmoothStreamingText from './SmoothStreamingText';
import ThinkingIndicator from './ThinkingIndicator';
import { fetchDoctorProfilesByNames } from '../services/keywordSearchService';

export default function AiAnswerCard({
  answer, sources, isStreaming, isThinking,
  label, query, streamingLabel, sourcesLabel, diveButtonText,
  showDiveCta, onDiveDeeper,
}) {
  var sourcesText = (sourcesLabel || 'Sources').replace('{count}', (sources || []).length);
  var doctorNames = useMemo(function () {
    return extractDoctorNamesFromAnswer(answer);
  }, [answer]);
  var doctorNamesKey = doctorNames.join('|');
  var doctorProfileMap = useDoctorPreviewMap(doctorNames, isStreaming, isThinking);
  var renderedAnswer = useMemo(function () {
    if (isStreaming || isThinking) return answer;
    return injectDoctorPreviewMarkup(answer, doctorProfileMap);
  }, [answer, doctorProfileMap, isStreaming, isThinking]);

  return (
    <div className={'px-answer-card' + (query ? ' px-initial-answer' : '')}>
      <div className="px-answer-label">
        {label || 'AI Answer'}
        {query && <> for: <strong>{query}</strong></>}
        {(isStreaming || isThinking) && <span className="px-streaming-badge">{streamingLabel || 'Thinking...'}</span>}
      </div>
      {isStreaming ? (
        <SmoothStreamingText content={answer} isStreaming={isStreaming} />
      ) : isThinking ? (
        <ThinkingIndicator compact={true} label={streamingLabel || 'Thinking...'} />
      ) : (
        <MarkdownRenderer content={renderedAnswer} />
      )}
      {!isStreaming && !isThinking && sources && sources.length > 0 && (
        <div className="px-sources">
          <p className="px-sources-label">{sourcesText}</p>
          <div className="px-sources-row">
            {sources.map(function (s, i) {
              return <a key={i} className="px-source" href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>;
            })}
          </div>
        </div>
      )}
      {showDiveCta && !isStreaming && !isThinking && (
        <button className="px-dive-cta" onClick={onDiveDeeper}>{diveButtonText || 'Dive Deeper →'}</button>
      )}
    </div>
  );
}

function useDoctorPreviewMap(doctorNames, isStreaming, isThinking) {
  var doctorNamesKey = doctorNames.join('|');
  var [profiles, setProfiles] = useState([]);

  useEffect(function () {
    var cancelled = false;

    if (isStreaming || isThinking || !doctorNames.length) {
      setProfiles([]);
      return function () {};
    }

    fetchDoctorProfilesByNames(doctorNames, { limit: 6 }).then(function (result) {
      if (!cancelled) setProfiles(result || []);
    }).catch(function () {
      if (!cancelled) setProfiles([]);
    });

    return function () { cancelled = true; };
  }, [doctorNamesKey, isStreaming, isThinking]);

  return useMemo(function () {
    var map = {};
    (profiles || []).forEach(function (profile) {
      if (!profile || !profile.name) return;
      map[normalizeName(profile.name)] = profile;
    });
    return map;
  }, [profiles]);
}

function extractDoctorNamesFromAnswer(answer) {
  if (!answer || typeof answer !== 'string') return [];

  var names = [];
  var seen = {};
  var match = null;

  var bulletRegex = /(?:^|\n)\s*[-*]\s+\*\*([^*\n]+?)\*\*:?/gm;
  while ((match = bulletRegex.exec(answer))) {
    pushName(match[1]);
  }

  var linkedProfileRegex = /\[([^\]]+?)\]\((https?:\/\/www\.mehilainen\.fi\/en\/doctors-and-specialists\/[^)]+)\)/gim;
  while ((match = linkedProfileRegex.exec(answer))) {
    pushName(match[1]);
  }

  var strongNameRegex = /\*\*([^*\n]+?)\*\*:?/g;
  while ((match = strongNameRegex.exec(answer))) {
    pushName(match[1]);
  }

  return names;

  function pushName(raw) {
    var cleaned = cleanDoctorName(raw);
    var key = normalizeName(cleaned);
    if (!looksLikeDoctorName(cleaned) || seen[key]) return;
    seen[key] = true;
    names.push(cleaned);
  }
}

function cleanDoctorName(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/[:,-]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeDoctorName(value) {
  if (!value) return false;
  var parts = value.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return false;
  for (var i = 0; i < parts.length; i += 1) {
    if (!/^[A-ZÅÄÖÉÜ][A-Za-zÀ-ÖØ-öø-ÿÅÄÖåäöÉéÜü'’-]+$/.test(parts[i])) return false;
  }
  return true;
}

function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-zà-öø-ÿåäö0-9]+/g, ' ').trim();
}

function injectDoctorPreviewMarkup(answer, doctorProfileMap) {
  if (!answer || !doctorProfileMap || !Object.keys(doctorProfileMap).length) return answer;

  var transformed = answer;

  Object.keys(doctorProfileMap).forEach(function (key) {
    var profile = doctorProfileMap[key];
    if (!profile || !profile.name || !profile.imageUrl) return;

    var escapedName = escapeRegExp(profile.name);
    var replacement = buildDoctorInlineMarkup(profile);

    transformed = transformed.replace(
      new RegExp('\\*\\*' + escapedName + '\\*\\*', 'g'),
      replacement
    );
  });

  return transformed;
}

function buildDoctorInlineMarkup(profile) {
  var safeName = escapeHtml(profile.name);
  var safeSpecialty = escapeHtml(profile.specialty || 'Specialist profile');
  var safeImage = escapeHtml(profile.imageUrl);
  var safeUrl = escapeHtml(profile.url || '#');

  return (
    '<a class="px-inline-doctor" href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' +
      '<img class="px-inline-doctor-avatar" src="' + safeImage + '" alt="' + safeName + '" loading="lazy" />' +
      '<span class="px-inline-doctor-copy">' +
        '<strong class="px-inline-doctor-name">' + safeName + '</strong>' +
        '<span class="px-inline-doctor-meta">' + safeSpecialty + '</span>' +
      '</span>' +
    '</a>'
  );
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
