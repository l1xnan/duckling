import { createTermHistoryStore, MAX_TERM_HISTORY } from './termHistory';

export const MAX_COLUMN_SEARCH_HISTORY = MAX_TERM_HISTORY;

export const useColumnSearchHistoryStore = createTermHistoryStore(
  'column-search-history',
);
