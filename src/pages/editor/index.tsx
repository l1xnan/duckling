import Editor, { OnChange, OnMount } from '@monaco-editor/react';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { Box, IconButton, Stack, useTheme } from '@mui/material';
import { PrimitiveAtom, useAtomValue } from 'jotai';
import { useEffect, useRef } from 'react';

import { showTables } from '@/api';
import { ToolbarBox, ToolbarContainer } from '@/components/Toolbar';
import { useResize } from '@/hooks';
import classes from '@/hooks/resize.module.css';
import { TabContextType, useTabsStore } from '@/stores/tabs';
import { isDarkTheme } from '@/utils';

import Connection from './Connection';
import DatasetItem, { PageProvider } from './DatasetItem';

type OnMountParams = Parameters<OnMount>;

async function getTables(root: string) {
  const res = await showTables(root);

  const schema: ComplationSchemaType = {};
  res?.data?.forEach(({ table_name }) => {
    schema[table_name] = [];
  });

  return schema;
}

type ComplationSchemaType = {
  [key: string]: string[];
};

export default function MonacoEditor({
  context,
}: {
  context: PrimitiveAtom<TabContextType>;
}) {
  const tabContext = useAtomValue(context);
  const id = tabContext.id;
  const extra = tabContext.extra;

  const setStmt = useTabsStore((state) => state.setStmt);
  const docs = useTabsStore((state) => state.docs);
  const stmt = docs[id] ?? '';
  const theme = useTheme();

  useEffect(() => {
    if (extra) {
      setStmt(id, `${stmt}\n${extra}`);
    }
  }, []);

  const [targetRefTop, sizeTop, actionTop] = useResize(300, 'bottom');
  const editorRef = useRef<OnMountParams[0] | null>(null);

  const handleMount: OnMount = (editor, _monaco) => {
    editorRef.current = editor;
    _monaco.editor.defineTheme('dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {},
    });
  };
  const handleChange: OnChange = (value, _event) => {
    setStmt(id, value ?? '');
  };

  const handleClick = async () => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    let stmt = '';
    const selection = editor.getSelection();
    if (selection) {
      stmt = editor.getModel()?.getValueInRange(selection) ?? '';
    }
    if (stmt.length === 0) {
      stmt = editor.getValue() ?? '';
    }

    if (stmt.length > 0) {
      const tabContext = {
        ...context,
        stmt,
      };
      setTabs((prev) => [...prev, tabContext]);
    }
  };

  const activateTab = useTabsStore((state) => state.active);
  const removeTab = useTabsStore((state) => state.remove);
  const currentTab = useTabsStore((state) => state.currentTab);

  const items = tabContext?.children?.map((tab) => {
    const children = (
      <>
        {tab.type === 'editor' ? (
          <MonacoEditor context={tab} />
        ) : (
          <PageProvider context={tab}>
            <DatasetItem context={tab} />
          </PageProvider>
        )}
      </>
    );

    return { tab, children };
  });

  return (
    <Box
      sx={{
        height: 'calc(100vh - 32px)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <Box sx={{ height: '100%' }}>
        <EditorToolbar onClick={handleClick} />
        <Editor
          onMount={handleMount}
          value={stmt}
          height={`calc(100vh - ${sizeTop + 64}px)`}
          defaultLanguage="sql"
          theme={isDarkTheme(theme) ? 'vs-dark' : 'light'}
          onChange={handleChange}
        />
      </Box>
      <Box
        ref={targetRefTop}
        className={classes.rightBottom}
        sx={{ height: sizeTop + 'px', width: '100%' }}
      >
        <div className={classes.controlsH}>
          <div className={classes.resizeHorizontal} onMouseDown={actionTop} />
        </div>
        {/* <PageTabs
          items={items}
          onChange={(value) => activateTab(value)}
          activeKey={currentTab?.id ?? ''}
          onRemove={removeTab}
        /> */}
      </Box>
    </Box>
  );
}

function EditorToolbar({ onClick }: { onClick: () => void }) {
  return (
    <ToolbarContainer>
      <ToolbarBox>
        <Stack direction="row">
          <IconButton
            size="small"
            sx={{
              color: 'green',
            }}
            onClick={onClick}
          >
            <PlayArrowIcon fontSize="inherit" />
          </IconButton>
          <IconButton
            size="small"
            sx={{
              color: 'green',
            }}
            onClick={onClick}
          >
            <PlaylistAddIcon fontSize="inherit" />
          </IconButton>
        </Stack>
        <Stack direction="row">
          <Connection />
        </Stack>
      </ToolbarBox>
    </ToolbarContainer>
  );
}
function atom<T>(arg0: never[]): any {
  throw new Error('Function not implemented.');
}

function useAtom(tabsAtom: any): [any, any] {
  throw new Error('Function not implemented.');
}
