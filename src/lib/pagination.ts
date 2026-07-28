export const PAGINATION_PER_PAGE_OPTIONS = [10, 100, 500, 1000] as const;

export type PaginationPerPageOption =
  (typeof PAGINATION_PER_PAGE_OPTIONS)[number];

export const DEFAULT_PER_PAGE: PaginationPerPageOption = 500;

export function isPaginationPerPageOption(
  value: number,
): value is PaginationPerPageOption {
  return (PAGINATION_PER_PAGE_OPTIONS as readonly number[]).includes(value);
}

export function resolveDefaultPerPage(value?: number | null): number {
  if (value != null && isPaginationPerPageOption(value)) {
    return value;
  }
  return DEFAULT_PER_PAGE;
}
