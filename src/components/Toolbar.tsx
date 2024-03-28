import React from 'react';

export const ToolbarContainer = (
  props: React.HTMLAttributes<HTMLDivElement>,
) => (
  <div
    className="h-8 min-h-8 w-full pl-1 flex flex-row items-center justify-between border-b"
    {...props}
  />
);

export const ToolbarBox = (props: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className="flex flex-row items-center justify-between w-full h-8"
    {...props}
  />
);

export const Stack = (props: React.ButtonHTMLAttributes<HTMLDivElement>) => (
  <div className="flex flex-row gap-1 items-center justify-start" {...props} />
);
