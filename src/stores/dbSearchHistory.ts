import { createTermHistoryStore, MAX_TERM_HISTORY } from './termHistory';

export const MAX_DB_SEARCH_HISTORY = MAX_TERM_HISTORY;

export const useDbSearchHistoryStore = createTermHistoryStore(
  'db-search-history',
);
