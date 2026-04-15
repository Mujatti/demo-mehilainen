'use client';

import { useEffect, useMemo, useState } from 'react';
import { addDoctorToCompare, loadCompareSelection } from '../utils/compareSelection';
import { withCurrentQuery } from '../utils/urlState';

export default function DoctorResultsBlock({ doctors, title, subtitle, showCompare }) {
  var safeDoctors = Array.isArray(doctors) ? doctors.filter(function (item) { return !!item; }) : [];
  var [selectedIds, setSelectedIds] = useState([]);

  useEffect(function () {
    var stored = loadCompareSelection();
    setSelectedIds(stored.map(function (item) { return item.id; }));
  }, [safeDoctors.map(function (item) { return item.id; }).join('|')]);

  var compareHref = useMemo(function () {
    return withCurrentQuery('/care');
  }, []);

  function handleAdd(profile) {
    var next = addDoctorToCompare(profile);
    setSelectedIds(next.map(function (item) { return item.id; }));
  }

  if (!safeDoctors.length) return null;

  return (
    <section className="px-doctor-block">
      <div className="px-doctor-block-head">
        <div>
          <p className="px-doctor-block-kicker">Recommended professionals</p>
          <h3 className="px-doctor-block-title">{title || 'Best-fit doctors to review first'}</h3>
          {subtitle && <p className="px-doctor-block-subtitle">{subtitle}</p>}
        </div>
        {showCompare && (
          <a className="px-doctor-compare-link" href={compareHref}>
            Open compare view
          </a>
        )}
      </div>

      <div className="px-doctor-card-list">
        {safeDoctors.map(function (profile) {
          var isAdded = selectedIds.indexOf(profile.id) !== -1;
          return (
            <article className="px-doctor-card" key={profile.id || profile.url || profile.name}>
              <div className="px-doctor-card-main">
                {profile.imageUrl ? (
                  <img className="px-doctor-card-avatar" src={profile.imageUrl} alt={profile.name} loading="lazy" />
                ) : (
                  <div className="px-doctor-card-avatar px-doctor-card-avatar-fallback" aria-hidden="true">
                    {(profile.name || '?').charAt(0)}
                  </div>
                )}
                <div className="px-doctor-card-copy">
                  <div className="px-doctor-card-top">
                    <h4 className="px-doctor-card-name">{profile.name}</h4>
                    {profile.nextAvailable && <span className="px-doctor-card-badge">{profile.nextAvailable}</span>}
                  </div>
                  <p className="px-doctor-card-meta">{profile.specialty || 'Professional profile'}</p>
                  <p className="px-doctor-card-mini">{profile.location || 'See profile'}</p>
                  {profile.fit && <p className="px-doctor-card-fit">Best for: {profile.fit}</p>}
                </div>
              </div>
              <div className="px-doctor-card-actions">
                {profile.url && profile.url !== '#' && (
                  <a className="px-doctor-card-link" href={profile.url} target="_blank" rel="noopener noreferrer">View full profile</a>
                )}
                {showCompare && (
                  <button className={'px-doctor-card-compare' + (isAdded ? ' is-added' : '')} type="button" onClick={function () { handleAdd(profile); }}>
                    {isAdded ? 'Added to compare' : 'Add to compare'}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
