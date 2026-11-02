import { useCallback, useEffect, useState } from 'react';
import { ALL_PAGE_IDS } from '../navigation';
import type { PageId } from '../types/dashboard';

// Hash routes (#/orders) survive a refresh and work with the browser Back button,
// without needing server rewrites for the /admin static mount.
const readPage = (): PageId => {
  const id = window.location.hash.replace(/^#\/?/, '').split(/[?/]/)[0] as PageId;
  return ALL_PAGE_IDS.includes(id) ? id : 'dashboard';
};

export function usePageRoute() {
  const [page, setPage] = useState<PageId>(readPage);
  useEffect(() => {
    const sync = () => setPage(readPage());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const navigate = useCallback((next: PageId) => {
    if (`#/${next}` !== window.location.hash) window.location.hash = `/${next}`;
    setPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);
  return [page, navigate] as const;
}
