'use client';

var STORAGE_KEY = 'px-care-compare-selection';
var MAX_ITEMS = 3;

export function loadCompareSelection() {
  if (typeof window === 'undefined') return [];
  try {
    var raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    var parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch (e) {
    return [];
  }
}

export function saveCompareSelection(items) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify((items || []).slice(0, MAX_ITEMS)));
  } catch (e) {}
}

export function addDoctorToCompare(doctor) {
  if (!doctor || !doctor.id) return loadCompareSelection();
  var items = loadCompareSelection();
  var next = items.filter(function (item) { return item && item.id !== doctor.id; });
  next.push(sanitizeDoctor(doctor));
  if (next.length > MAX_ITEMS) next = next.slice(next.length - MAX_ITEMS);
  saveCompareSelection(next);
  return next;
}

export function removeDoctorFromCompare(id) {
  var next = loadCompareSelection().filter(function (item) { return item && item.id !== id; });
  saveCompareSelection(next);
  return next;
}

export function clearCompareSelection() {
  if (typeof window === 'undefined') return;
  try { window.sessionStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

function sanitizeDoctor(doctor) {
  return {
    id: String(doctor.id),
    name: doctor.name || 'Professional',
    specialty: doctor.specialty || 'Professional profile',
    location: doctor.location || 'See profile',
    languages: Array.isArray(doctor.languages) ? doctor.languages.slice(0, 5) : [],
    visitTypes: Array.isArray(doctor.visitTypes) ? doctor.visitTypes.slice(0, 5) : [],
    nextAvailable: doctor.nextAvailable || 'Check booking',
    fit: doctor.fit || 'Open profile to review this professional.',
    reasons: Array.isArray(doctor.reasons) ? doctor.reasons.slice(0, 5) : [],
    bio: doctor.bio || '',
    url: doctor.url || '#',
    imageUrl: doctor.imageUrl || '',
    source: doctor.source || 'main-demo'
  };
}
