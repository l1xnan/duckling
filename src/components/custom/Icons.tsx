import { createSvgIcon } from '@mui/material';

export const ClickhouseIcon = createSvgIcon(
  <svg viewBox="0 0 9 8" xmlns="http://www.w3.org/2000/svg">
    <path d="m0 7h1v1h-1z" fill="#f00" />
    <path
      d="m0 0h1v7h-1z m2 0h1v8h-1zm2 0h1v8h-1zm2 0h1v8h-1zm2 3.25h1v1.5h-1z"
      fill="#fc0"
    />
  </svg>,
  'Clickhouse',
);

export const DuckdbIcon = createSvgIcon(
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 300 300"
    width="300"
    height="300"
  >
    <defs>
      <clipPath id="a">
        <path d="M0 0h300v300H0z" />
      </clipPath>
    </defs>
    <g clip-path="url(#a)">
      <path
        d="M0 148c-81.853 0-148-66.146-148-148S-81.853-148 0-148c81.854 0 148 66.146 148 148S81.854 148 0 148z"
        transform="translate(150 150)"
      />
      <path
        fill="#FFF000"
        d="M-61.314 0c0 33.828 27.486 61.314 61.314 61.314 33.829 0 61.314-27.486 61.314-61.314S33.829-61.314 0-61.314c-33.828 0-61.314 27.486-61.314 61.314z"
        transform="translate(119.191 150)"
      />
      <path
        fill="#FFF000"
        d="M3.474-21.898h-28.996v43.796H3.474c12.082 0 22.049-9.968 22.049-22.049 0-12.082-9.967-21.747-22.049-21.747z"
        transform="translate(225.661 149.849)"
      />
    </g>
  </svg>,
  'DuckDB',
);
