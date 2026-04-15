'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { loadConfig } from '../config/app.config';
import { resolveConfigFromURL } from '../config/demoSessionLoader';
import * as orchestrator from '../orchestration/searchOrchestrator';
import ConversationThread from '../components/ConversationThread';
import FollowUpInput from '../components/FollowUpInput';
import LoadingDots from '../components/LoadingDots';
import QuickActions from '../components/QuickActions';

export default function CarePage() {
  var [configReady, setConfigReady] = useState(false);
  var configRef = useRef(null);

  useEffect(function () {
    if (configRef.current) return;
    resolveConfigFromURL().then(function (resolved) {
      var base = resolved.config || {};
      if (!base.variant) base.variant = 'care-navigator';
      configRef.current = loadConfig(base);
      setConfigReady(true);
    });
  }, []);

  if (!configReady || !configRef.current) {
    return (
      <main className="px-page">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
          <LoadingDots />
        </div>
      </main>
    );
  }

  return <CareApp config={configRef.current} />;
}

function CareApp({ config }) {
  var labels = config.labels || {};
  var theme = config.theme || {};

  useEffect(function () {
    if (typeof document === 'undefined') return;
    var root = document.documentElement;
    if (theme.accentColor) root.style.setProperty('--accent', theme.accentColor);
    if (theme.bgColor) root.style.setProperty('--bg', theme.bgColor);
    if (theme.textColor) root.style.setProperty('--text', theme.textColor);
    if (theme.fontFamily) root.style.setProperty('--font', theme.fontFamily);
    if (theme.borderRadius) root.style.setProperty('--radius', theme.borderRadius);
  }, [theme]);

  var [state, setState] = useState(orchestrator.INITIAL_STATE);
  var stateRef = useRef(state);
  stateRef.current = state;
  var getState = useCallback(function () { return stateRef.current; }, []);

  var initialized = useRef(false);
  if (!initialized.current) {
    orchestrator.init(setState, getState);
    initialized.current = true;
  }

  var logoUrl = theme.logoUrl || '/add_search_logo.png';
  var hasMessages = state.messages.length > 0 || state.followUpLoading || state.followUpStreaming;

  function submitPrompt(prompt) {
    orchestrator.doChatMessage(prompt);
  }

  return (
    <main className="px-page px-care-page">
      <header className="px-header px-care-header">
        <a href="/" className="px-logo">
          <img src={logoUrl} alt="Mehiläinen" className="px-logo-img" />
        </a>
        <a href="/" className="px-care-backlink">Search demo</a>
      </header>

      <section className="px-care-hero">
        <div>
          <span className="px-care-eyebrow">Healthcare concierge variant</span>
          <h1 className="px-care-title">{labels.heroTitle}</h1>
          <p className="px-care-subtitle">{labels.heroSubtitle}</p>
        </div>
      </section>

      <section className="px-care-layout">
        <aside className="px-care-sidebar">
          <div className="px-care-card">
            <h3 className="px-care-card-title">{labels.supportTitle || 'Booking support'}</h3>
            <p className="px-care-card-body">{labels.supportBody}</p>
            <div className="px-care-support-row">
              <span className="px-care-support-label">Customer service</span>
              <strong>{config.careSupport && config.careSupport.phone}</strong>
            </div>
            <p className="px-care-note">{config.careSupport && config.careSupport.note}</p>
          </div>

          <div className="px-care-card">
            <QuickActions
              title={labels.quickActionsTitle}
              actions={config.careQuickActions || []}
              onSelect={submitPrompt}
            />
          </div>
        </aside>

        <div className="px-care-main">
          {!hasMessages && (
            <div className="px-care-empty">
              <div className="px-care-empty-card">
                <h2>Start with your care need</h2>
                <p>Use this demo to guide visitors toward the right service, specialty, or booking decision before they commit.</p>
              </div>
            </div>
          )}

          {hasMessages && (
            <div className="px-chat-thread px-care-thread">
              <ConversationThread
                messages={state.messages}
                isLoading={state.followUpLoading}
                isStreaming={state.followUpStreaming}
                streamingText={state.streamingText}
                streamingLabel={'Thinking...'}
                sourcesLabel={'Sources'}
              />
            </div>
          )}

          <div className="px-care-input-wrap">
            <FollowUpInput
              onSubmit={orchestrator.doChatMessage}
              isDisabled={state.followUpLoading || state.followUpStreaming}
              hasConversation={state.conversationStarted}
              followUpPlaceholder={labels.followUpPlaceholder}
              freshPlaceholder={labels.freshQuestionPlaceholder}
              maxLength={config.maxFollowUpLength}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
