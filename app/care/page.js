'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadConfig } from '../config/app.config';
import { resolveConfigFromURL } from '../config/demoSessionLoader';
import * as orchestrator from '../orchestration/searchOrchestrator';
import ConversationThread from '../components/ConversationThread';
import FollowUpInput from '../components/FollowUpInput';
import LoadingDots from '../components/LoadingDots';
import { withCurrentQuery } from '../utils/urlState';

var DEFAULT_PROFILES = [
  { id: 'heidi-salonen', name: 'Heidi Salonen', specialty: 'Asthma nurse', location: 'Helsinki', languages: ['Finnish', 'English'], visitTypes: ['In person'], nextAvailable: 'Tomorrow', fit: 'Testing, guidance, follow-up plans', reasons: ['Strong for recurring asthma questions', 'Good for diagnostics and care plans'] },
  { id: 'anna-laine', name: 'Anna Laine', specialty: 'General practitioner', location: 'Espoo', languages: ['Finnish', 'Swedish', 'English'], visitTypes: ['Video', 'In person'], nextAvailable: 'Today', fit: 'First assessment, referrals, sick leave', reasons: ['Fast access', 'Good first stop when the issue is unclear'] },
  { id: 'markus-virtanen', name: 'Markus Virtanen', specialty: 'Orthopedist', location: 'Vantaa', languages: ['Finnish', 'English'], visitTypes: ['In person'], nextAvailable: 'In 2 days', fit: 'Sports injuries, joint pain, imaging follow-up', reasons: ['Best for injury comparison', 'Useful when surgery options may matter'] },
  { id: 'sofia-kallio', name: 'Sofia Kallio', specialty: 'Dermatologist', location: 'Turku', languages: ['Finnish', 'English'], visitTypes: ['Video', 'In person'], nextAvailable: 'This week', fit: 'Rashes, skin changes, long-term skin treatment', reasons: ['Strong remote suitability', 'Good for ongoing treatment plans'] },
];

export default function CarePage() {
  var [configReady, setConfigReady] = useState(false);
  var configRef = useRef(null);

  useEffect(function () {
    if (configRef.current) return;
    resolveConfigFromURL().then(function (resolved) {
      configRef.current = loadConfig(resolved.config);
      setConfigReady(true);
    });
  }, []);

  if (!configReady || !configRef.current) {
    return <main className="px-page"><div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}><LoadingDots /></div></main>;
  }

  return <CareApp config={configRef.current} />;
}

function CareApp({ config }) {
  var labels = config.labels || {};
  var theme = config.theme || {};
  var compareProfiles = config.compareProfiles || DEFAULT_PROFILES;

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
  var initialized = useRef(false);
  if (!initialized.current) {
    orchestrator.init(setState, function () { return stateRef.current; });
    initialized.current = true;
  }

  var [selectedIds, setSelectedIds] = useState([]);
  var [focusSpecialty, setFocusSpecialty] = useState('All');

  var selectedDoctors = useMemo(function () {
    return compareProfiles.filter(function (item) { return selectedIds.indexOf(item.id) !== -1; });
  }, [selectedIds, compareProfiles]);

  var filteredProfiles = useMemo(function () {
    return compareProfiles.filter(function (item) {
      return focusSpecialty === 'All' || item.specialty === focusSpecialty;
    });
  }, [focusSpecialty, compareProfiles]);

  var specialties = useMemo(function () {
    var values = ['All'];
    compareProfiles.forEach(function (item) {
      if (values.indexOf(item.specialty) === -1) values.push(item.specialty);
    });
    return values;
  }, [compareProfiles]);

  function toggleCompare(id) {
    setSelectedIds(function (prev) {
      if (prev.indexOf(id) !== -1) return prev.filter(function (x) { return x !== id; });
      if (prev.length >= 3) return prev.slice(1).concat(id);
      return prev.concat(id);
    });
  }

  function askJourney(prompt) {
    orchestrator.doChatMessage(prompt);
  }

  var logoUrl = theme.logoUrl || '/mehilainen-wordmark.svg';
  var hasMessages = state.messages.length > 0 || state.followUpLoading || state.followUpStreaming;

  return (
    <main className="px-page px-care-page">
      <header className="px-header px-care-header">
        <a href={withCurrentQuery('/care')} className="px-logo"><img src={logoUrl} alt="Logo" className="px-logo-img" /></a>
        <nav className="px-care-nav">
          <a href={withCurrentQuery('/')} className="px-care-nav-link">Search demo</a>
          <a href={withCurrentQuery('/chat')} className="px-care-nav-link">Chat demo</a>
        </nav>
      </header>

      <section className="px-care-hero">
        <div>
          <p className="px-care-kicker">Mehiläinen care navigator</p>
          <h1 className="px-care-title">Choose the right professional faster, then compare before booking.</h1>
          <p className="px-care-subtitle">This variant is designed for healthcare visitors who are not only searching, but deciding. It combines guided AI triage with a shortlist and side-by-side comparison flow.</p>
          <div className="px-care-quick-actions">
            <button className="px-care-chip" onClick={function () { askJourney('I have recurring asthma symptoms and want to know whether to book a nurse, GP, or specialist.'); }}>Respiratory symptoms</button>
            <button className="px-care-chip" onClick={function () { askJourney('Help me decide between video care and an in-person appointment for a skin issue.'); }}>Video or in-person?</button>
            <button className="px-care-chip" onClick={function () { askJourney('I want to compare doctors based on specialty, language, and earliest availability.'); }}>Compare doctors</button>
          </div>
        </div>
        <aside className="px-care-summary-card">
          <div className="px-care-summary-top">
            <span className="px-care-summary-label">Live config</span>
            <span className="px-care-summary-pill">site key: {config.siteKey ? 'active' : 'missing'}</span>
          </div>
          <p className="px-care-summary-title">URL overrides work here too.</p>
          <p className="px-care-summary-body">Use <code>?site_key=...</code> or <code>?siteKey=...</code> with <code>/care</code>, and the same value is preserved when moving between variants.</p>
        </aside>
      </section>

      <section className="px-care-layout">
        <div className="px-care-main">
          <div className="px-care-panel">
            <div className="px-care-panel-head">
              <div>
                <p className="px-care-kicker">Guided conversation</p>
                <h2 className="px-care-section-title">Help visitors narrow down who they should book.</h2>
              </div>
              {hasMessages && <button className="px-dive-reset" onClick={orchestrator.resetChat}>{labels.resetButtonText || 'Start over'}</button>}
            </div>
            {hasMessages ? (
              <ConversationThread
                messages={state.messages}
                isLoading={state.followUpLoading}
                isStreaming={state.followUpStreaming}
                streamingText={state.streamingText}
                streamingLabel={labels.aiAnswerStreaming || 'Thinking...'}
                sourcesLabel={labels.sourcesLabel || 'Sources'}
              />
            ) : (
              <div className="px-care-empty-state">
                <p className="px-care-empty-title">Start with a care question.</p>
                <p className="px-care-empty-copy">Example: “I have knee pain and want to compare available orthopedists in Helsinki.”</p>
              </div>
            )}
            <div className="px-chat-input-wrap px-care-input-wrap">
              <FollowUpInput
                onSubmit={orchestrator.doChatMessage}
                isDisabled={state.followUpLoading || state.followUpStreaming}
                hasConversation={state.conversationStarted}
                followUpPlaceholder={labels.followUpPlaceholder || 'Ask about symptoms, visit type, or provider choice...'}
                freshPlaceholder={labels.searchPlaceholder || 'Describe your care need...'}
                maxLength={config.maxFollowUpLength}
              />
            </div>
          </div>
        </div>

        <aside className="px-care-side">
          <div className="px-care-panel">
            <div className="px-care-panel-head">
              <div>
                <p className="px-care-kicker">Doctor comparison</p>
                <h2 className="px-care-section-title">Shortlist up to 3 professionals.</h2>
              </div>
            </div>
            <div className="px-care-filter-row">
              {specialties.map(function (specialty) {
                return <button key={specialty} className={'px-care-filter' + (focusSpecialty === specialty ? ' px-care-filter-active' : '')} onClick={function () { setFocusSpecialty(specialty); }}>{specialty}</button>;
              })}
            </div>
            <div className="px-care-candidate-list">
              {filteredProfiles.map(function (profile) {
                var active = selectedIds.indexOf(profile.id) !== -1;
                return (
                  <article key={profile.id} className={'px-care-candidate' + (active ? ' px-care-candidate-active' : '')}>
                    <div>
                      <div className="px-care-candidate-top">
                        <h3>{profile.name}</h3>
                        <span className="px-care-badge">{profile.nextAvailable}</span>
                      </div>
                      <p className="px-care-meta">{profile.specialty} · {profile.location}</p>
                      <p className="px-care-fit">Best for: {profile.fit}</p>
                      <p className="px-care-mini">{profile.languages.join(', ')} · {profile.visitTypes.join(', ')}</p>
                    </div>
                    <button className={'px-care-select-btn' + (active ? ' is-active' : '')} onClick={function () { toggleCompare(profile.id); }}>{active ? 'Added' : 'Add to compare'}</button>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="px-care-panel">
            <div className="px-care-panel-head">
              <div>
                <p className="px-care-kicker">Comparison view</p>
                <h2 className="px-care-section-title">What a visitor needs before booking.</h2>
              </div>
            </div>
            {selectedDoctors.length === 0 ? (
              <p className="px-care-empty-copy">Select doctors to see languages, visit type, availability, and ideal use case side by side.</p>
            ) : (
              <div className="px-care-compare-table-wrap">
                <table className="px-care-compare-table">
                  <thead>
                    <tr>
                      <th>Criteria</th>
                      {selectedDoctors.map(function (doctor) { return <th key={doctor.id}>{doctor.name}</th>; })}
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Specialty</td>{selectedDoctors.map(function (doctor) { return <td key={doctor.id}>{doctor.specialty}</td>; })}</tr>
                    <tr><td>Location</td>{selectedDoctors.map(function (doctor) { return <td key={doctor.id}>{doctor.location}</td>; })}</tr>
                    <tr><td>Languages</td>{selectedDoctors.map(function (doctor) { return <td key={doctor.id}>{doctor.languages.join(', ')}</td>; })}</tr>
                    <tr><td>Visit type</td>{selectedDoctors.map(function (doctor) { return <td key={doctor.id}>{doctor.visitTypes.join(', ')}</td>; })}</tr>
                    <tr><td>Next available</td>{selectedDoctors.map(function (doctor) { return <td key={doctor.id}>{doctor.nextAvailable}</td>; })}</tr>
                    <tr><td>Best fit</td>{selectedDoctors.map(function (doctor) { return <td key={doctor.id}>{doctor.fit}</td>; })}</tr>
                    <tr><td>Why choose</td>{selectedDoctors.map(function (doctor) { return <td key={doctor.id}><ul>{doctor.reasons.map(function (reason) { return <li key={reason}>{reason}</li>; })}</ul></td>; })}</tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </aside>
      </section>
    </main>
  );
}
