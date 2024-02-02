'use client';

import { Folder, Layout, Workflow } from 'lucide-react';
import * as React from 'react';

import { Tree } from '@/components/custom/TreeView';

const data = [
  { path: '1', name: 'Unread' },
  { path: '2', name: 'Threads' },
  {
    path: '3',
    name: 'Chat Rooms',
    children: [
      { path: 'c1', name: 'General' },
      { path: 'c2', name: 'Random' },
      { path: 'c3', name: 'Open Source Projects' },
    ],
  },
  {
    path: '4',
    name: 'Direct Messages',
    children: [
      {
        path: 'd1',
        name: 'Alice',
        children: [
          { path: 'd11', name: 'Alice2', icon: Layout },
          { path: 'd12', name: 'Bob2' },
          { path: 'd13', name: 'Charlie2' },
        ],
      },
      { path: 'd2', name: 'Bob', icon: Layout },
      { path: 'd3', name: 'Charlie' },
    ],
  },
  {
    path: '5',
    name: 'Direct Messages',
    children: [
      {
        path: 'e1',
        name: 'Alice',
        children: [
          { path: 'e11', name: 'Alice2' },
          { path: 'e12', name: 'Bob2' },
          { path: 'e13', name: 'Charlie2' },
        ],
      },
      { path: 'e2', name: 'Bob' },
      { path: 'e3', name: 'Charlie' },
    ],
  },
  {
    path: '6',
    name: 'Direct Messages',
    children: [
      {
        path: 'f1',
        name: 'Alice',
        children: [
          { path: 'f11', name: 'Alice2' },
          { path: 'f12', name: 'Bob2' },
          { path: 'f13', name: 'Charlie2' },
        ],
      },
      { path: 'f2', name: 'Bob' },
      { path: 'f3', name: 'Charlie' },
    ],
  },
];

export default function IndexPage({ data }) {
  const [content, setContent] = React.useState('Admin Page');
  return (
    <div className="flex min-h-full space-x-2">
      <Tree
        data={data}
        className="flex-shrink-0 w-full border-[1px]"
        initialSlelectedItemId="f12"
        onSelectChange={(item) => setContent(item?.name ?? '')}
        folderIcon={Folder}
        itemIcon={Workflow}
      />
    </div>
  );
}
