/**
 * components/AiAnswerCard.js
 * Dumb component. All labels from props. Never imports config.
 */
'use client';

import { useEffect, useMemo, useState } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import SmoothStreamingText from './SmoothStreamingText';
import ThinkingIndicator from './ThinkingIndicator';
import DoctorResultsBlock from './DoctorResultsBlock';
import { fetchDoctorProfilesByNames, fetchDoctorProfilesForQuery, mergeDoctorNames } from '../services/keywordSearchService';

export default function AiAnswerCard({
  answer, sources, isStreaming, isThinking,
  label, query, streamingLabel, sourcesLabel, diveButtonText,
  showDiveCta, onDiveDeeper, showDoctorCards,
}) {
  var sourcesText = (sourcesLabel || 'Sources').replace('{count}', (sources || []).length);
  var doctorNames = useMemo(function () {
    return mergeDoctorNames(extractDoctorNamesFromAnswer(answer), sources || []);
  }, [answer, sources]);
  var doctorProfiles = useDoctorProfiles(doctorNames, query, isStreaming, isThinking);

  return (
    <div className={'px-answer-card' + (query ? ' px-initial-answer' : '')}>
      <div className="px-answer-label">
        {label || 'AI Answer'}
        {query && <> for: <strong>{query}</strong></>}
        {(isStreaming || isThinking) && <span className="px-streaming-badge">{streamingLabel || 'Thinking...'}</span>}
      </div>

      {!isStreaming && !isThinking && showDoctorCards !== false && doctorProfiles.length > 0 && (
        <DoctorResultsBlock
          doctors={doctorProfiles}
          title="Profiles to compare before booking"
          subtitle="Structured profile cards are generated from live doctor hits so visitors can review and compare before they commit to an appointment."
          showCompare={true}
        />
      )}

      {isStreaming ? (
        <SmoothStreamingText content={answer} isStreaming={isStreaming} />
      ) : isThinking ? (
        <ThinkingIndicator compact={true} label={streamingLabel || 'Thinking...'} />
      ) : (
        <MarkdownRenderer content={answer} />
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

function useDoctorProfiles(doctorNames, query, isStreaming, isThinking) {
  var doctorNamesKey = doctorNames.join('|');
  var queryKey = String(query || '').trim();
  var [profiles, setProfiles] = useState([]);

  useEffect(function () {
    var cancelled = false;

    if (isStreaming || isThinking || !doctorNames.length) {
      setProfiles([]);
      return function () {};
    }

    fetchDoctorProfilesByNames(doctorNames, { limit: 6 }).then(function (result) {
      if (cancelled) return;
      var safeResult = Array.isArray(result) ? result : [];
      if (safeResult.length > 0 || !queryKey) {
        setProfiles(safeResult);
        return;
      }

      fetchDoctorProfilesForQuery(queryKey, { limit: 6 }).then(function (fallback) {
        if (!cancelled) setProfiles(Array.isArray(fallback) ? fallback : []);
      }).catch(function () {
        if (!cancelled) setProfiles([]);
      });
    }).catch(function () {
      if (!queryKey) {
        if (!cancelled) setProfiles([]);
        return;
      }
      fetchDoctorProfilesForQuery(queryKey, { limit: 6 }).then(function (fallback) {
        if (!cancelled) setProfiles(Array.isArray(fallback) ? fallback : []);
      }).catch(function () {
        if (!cancelled) setProfiles([]);
      });
    });

    return function () { cancelled = true; };
  }, [doctorNamesKey, queryKey, isStreaming, isThinking]);

  return profiles;
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

  var plainBulletRegex = /(?:^|\n)\s*[-*•]\s+([^:\n]{3,80}):/gm;
  while ((match = plainBulletRegex.exec(answer))) {
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

  var sentenceLeadRegex = /(?:^|\n)([A-ZÅÄÖÉÜ][A-Za-zÀ-ÖØ-öø-ÿÅÄÖåäöÉéÜü'’-]+(?:\s+[A-ZÅÄÖÉÜ][A-Za-zÀ-ÖØ-öø-ÿÅÄÖåäöÉéÜü'’-]+){1,3}):/gm;
  while ((match = sentenceLeadRegex.exec(answer))) {
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
