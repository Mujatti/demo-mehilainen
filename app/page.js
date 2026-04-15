/**
 * app/page.js — Starter App entry point
 *
 * Config resolution (async, first match wins):
 *   ?demo=SESSION_ID  → fetches /demo-sessions/{id}.json (Sales path)
 *   ?config=KEY       → local config registry lookup (dev/testing)
 *   (neither)         → defaults
 *
 * Test URLs:
 *   /                          → default AddSearch demo
 *   /?demo=acme-2026           → Acme Corp (purple, docs, auto-searches)
 *   /?demo=bigretail-q1        → BigRetail (blue, products)
 *   /?demo=stateuni-demo       → State University (green, campus)
 *   /?config=default           → dev: config registry
 *   /?config=ecommerce         → dev: config registry
 */
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { loadConfig } from './config/app.config';
import { resolveConfigFromURL } from './config/demoSessionLoader';
import * as orchestrator from './orchestration/searchOrchestrator';

// Components (all dumb — receive labels via props, never import config)
import Header from './components/Header';
import Landing from './components/Landing';
import ModeToggle from './components/ModeToggle';
import ExplorationBanner from './components/ExplorationBanner';
import AiAnswerCard from './components/AiAnswerCard';
import ConversationThread from './components/ConversationThread';
import FollowUpInput from './components/FollowUpInput';
import RelatedResults from './components/RelatedResults';
import LoadingDots from './components/LoadingDots';

export default function HomePage() {
  // ── Config loading state (async because sessions are fetched from JSON files) ──
  var [configReady, setConfigReady] = useState(false);
  var configRef = useRef(null);
  var sessionRef = useRef(null);

  useEffect(function () {
    if (configRef.current) return; // Already loaded

    resolveConfigFromURL().then(function (resolved) {
      configRef.current = loadConfig(resolved.config);
      sessionRef.current = resolved;
      setConfigReady(true);
    });
  }, []);

  // ── Show loading while config is being fetched ──
  if (!configReady || !configRef.current) {
    return (
      <main className="px-page">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <LoadingDots />
        </div>
      </main>
    );
  }

  // ── Config is ready — render the app ──
  return <AppWithConfig config={configRef.current} session={sessionRef.current} />;
}

/**
 * Inner component — only renders after config is loaded.
 * This separation keeps hooks unconditional (React rules of hooks).
 */
function AppWithConfig({ config, session }) {
  var labels = config.labels;
  var theme = config.theme;

  // ── Apply theme CSS variables ──
  useEffect(function () {
    if (typeof document === 'undefined') return;
    var root = document.documentElement;
    if (theme.accentColor) root.style.setProperty('--accent', theme.accentColor);
    if (theme.bgColor) root.style.setProperty('--bg', theme.bgColor);
    if (theme.textColor) root.style.setProperty('--text', theme.textColor);
    if (theme.fontFamily) root.style.setProperty('--font', theme.fontFamily);
    if (theme.borderRadius) root.style.setProperty('--radius', theme.borderRadius);
  }, [theme]);

  // ── React state: single source of truth ──
  var [state, setState] = useState(orchestrator.INITIAL_STATE);

  var stateRef = useRef(state);
  stateRef.current = state;
  var getState = useCallback(function () { return stateRef.current; }, []);

  // ── Initialize orchestrator ──
  var initialized = useRef(false);
  if (!initialized.current) {
    orchestrator.init(setState, getState);
    initialized.current = true;
  }

  // ── Auto-execute initial query if configured ──
  var autoSearched = useRef(false);
  useEffect(function () {
    if (config.initialQuery && !autoSearched.current) {
      autoSearched.current = true;
      orchestrator.doSearch(config.initialQuery);
    }
  }, [config.initialQuery]);

  // ── Logo URL ──
  var logoUrl = theme.logoUrl || '/add_search_logo.png';

  // ── Shared search input props ──
  var searchProps = {
    query: state.query,
    suggestions: state.suggestions,
    showSuggestions: state.showSuggestions,
    onInputChange: orchestrator.handleInputChange,
    onSubmit: function () { orchestrator.clearSuggestions(); orchestrator.doSearch(state.query.trim()); },
    onSelectSuggestion: orchestrator.selectSuggestion,
    onFocus: orchestrator.showSuggestions,
    onBlur: orchestrator.hideSuggestions,
  };

  return (
    <main className="px-page">
      {/* ── Header ── */}
      <Header
        hasSearched={state.hasSearched}
        logoUrl={logoUrl}
        placeholder={labels.headerSearchPlaceholder}
        {...searchProps}
      />

      {/* ── Landing ── */}
      {!state.hasSearched && (
        <Landing
          title={labels.heroTitle}
          subtitle={labels.heroSubtitle}
          placeholder={labels.searchPlaceholder}
          buttonText={labels.searchButtonText}
          {...searchProps}
        />
      )}

      {/* ── Search + Dive views ── */}
      {state.hasSearched && (
        <div className="px-content">
          <ModeToggle
            activeView={state.view}
            searchLabel={labels.searchTabLabel}
            diveLabel={labels.diveTabLabel}
            onSwitchToSearch={orchestrator.switchToSearch}
            onSwitchToDive={orchestrator.switchToDive}
          />

          {/* ═══ SEARCH TAB ═══ */}
          {state.view === 'search' && (
            <div className="px-search-pane">
              {state.returnedFromDive && state.hasDiveSession && (
                <ExplorationBanner
                  topic={state.refinedQuery || state.latestDiveQuery || state.query}
                  exploringLabel={labels.exploringLabel}
                  resumeLabel={labels.resumeButtonText}
                  resetLabel={labels.resetAllButtonText}
                  onResume={orchestrator.switchToDive}
                  onReset={orchestrator.resetAll}
                />
              )}

              {state.showAiAnswer && (
                <>
                  
                  {((state.aiLoading || state.aiStreaming || state.aiAnswer) ? true : false) && (
                    <AiAnswerCard
                      answer={state.aiAnswer}
                      sources={state.aiSources}
                      isStreaming={state.aiStreaming}
                      label={'AI Answers'}
                      streamingLabel={'Thinking...'}
                      sourcesLabel={'Sources'}
                      diveButtonText={labels.diveButtonText}
                      isThinking={state.aiLoading && !state.aiStreaming && !state.aiAnswer}
                      showDiveCta={true}
                      onDiveDeeper={orchestrator.switchToDive}
                    />
                  )}
                </>
              )}

              <div className="px-keyword-section">
                <div className="px-keyword-toolbar px-keyword-toolbar-sort-only">
                  <div id={config.containerIds.sortBy} className="px-sortby-container" />
                </div>
                <div id={config.containerIds.results} className="px-results-container" />
                <div id={config.containerIds.pagination} className="px-pagination-container" />
              </div>
            </div>
          )}

          {/* ═══ DIVE DEEPER TAB ═══ */}
          {state.view === 'dive' && (
            <div className="px-dive-pane">
              <div className="px-dive-toolbar">
                <button className="px-dive-reset" onClick={orchestrator.resetConversation}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  {labels.resetButtonText}
                </button>
              </div>

              {state.aiAnswer && (
                <AiAnswerCard
                  answer={state.aiAnswer}
                  sources={state.aiSources}
                  isStreaming={false}
                  label={labels.initialAnswerLabel}
                  query={state.query}
                  sourcesLabel={'Sources'}
                />
              )}

              <ConversationThread
                messages={state.messages}
                isLoading={state.followUpLoading}
                isStreaming={state.followUpStreaming}
                streamingText={state.streamingText}
                streamingLabel={'Thinking...'}
                sourcesLabel={'Sources'}
              />

              {!state.followUpLoading && !state.followUpStreaming && (
                <RelatedResults
                  results={state.relatedResults}
                  totalHits={state.totalRelated}
                  headline={labels.relatedResultsLabel}
                  onViewAll={orchestrator.switchToSearch}
                />
              )}

              <FollowUpInput
                onSubmit={orchestrator.doFollowUp}
                isDisabled={state.followUpLoading || state.followUpStreaming}
                hasConversation={state.conversationStarted}
                followUpPlaceholder={labels.followUpPlaceholder}
                freshPlaceholder={labels.freshQuestionPlaceholder}
                maxLength={config.maxFollowUpLength}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Footer ── */}
      <footer className="px-footer">
        <p><a href={labels.footerBrandUrl} target="_blank" rel="noopener noreferrer">Powered by AddSearch</a></p>
      </footer>
    </main>
  );
}
