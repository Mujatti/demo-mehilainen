'use client';

export function withCurrentQuery(pathname) {
  if (typeof window === 'undefined') return pathname;
  var search = window.location.search || '';
  return pathname + search;
}
