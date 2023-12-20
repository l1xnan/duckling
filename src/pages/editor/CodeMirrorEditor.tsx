import { PostgreSQL, schemaCompletionSource, sql } from '@codemirror/lang-sql';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import { Box, IconButton, Stack, useTheme } from '@mui/material';
import { basicLight, vscodeDark } from '@uiw/codemirror-themes-all';
import CodeMirror, {
    ReactCodeMirrorRef,
    ViewUpdate,
} from '@uiw/react-codemirror';
import { useCallback, useEffect, useRef, useState } from 'react';

import { showTables } from '@/api';
import { ToolbarContainer } from '@/components/Toolbar';
import { useResize } from '@/hooks';
import classes from '@/hooks/resize.module.css';
import { usePageStore } from '@/stores/dataset';
import { useTabsStore } from '@/stores/tabs';
import { isDarkTheme } from '@/utils';

import DatasetItem from './DatasetItem';
import { sqlCompletions } from './complation';

const mySchema = { 'abc.table': ['id', 'name'] };
const sqlSnippets = PostgreSQL.language.data.of({
  autocomplete: [schemaCompletionSource({ schema: mySchema }), sqlCompletions],
});

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

export default function Editor() {
  const { context: table, refresh } = usePageStore();
  if (table === undefined) {
    return;
  }
  const id = table.id;
  const extra = table.extra;
  console.log('extra:', extra);
  const setStmt = useTabsStore((state) => state.setStmt);
  const docs = useTabsStore((state) => state.docs);
  const stmt = docs[id] ?? '';

  const [schema, setTables] = useState<ComplationSchemaType>({});

  useEffect(() => {
    if (extra) {
      setStmt(id, `${stmt}\n${extra}`);
    }
    (async () => {
      const schema = await getTables(table.dbId);
      setTables(schema);
    })();
  }, []);

  const onChange = useCallback((val: string, _viewUpdate: ViewUpdate) => {
    setStmt(id, val);
  }, []);

  const [targetRefTop, sizeTop, actionTop] = useResize(300, 'bottom');
  const refs = useRef<ReactCodeMirrorRef>({});
  useEffect(() => {
    if (refs.current?.view) console.log('EditorView:', refs.current?.view);
    if (refs.current?.state) console.log('EditorState:', refs.current?.state);
    if (refs.current?.editor)
      console.log('HTMLDivElement:', refs.current?.editor);
  }, [refs.current]);

  const theme = useTheme();

  const handleClick = async () => {
    if (refs.current?.view) {
      const view = refs.current.view;
      const selectedText = view.state.sliceDoc(
        view.state.selection.main.from,
        view.state.selection.main.to,
      );

      if (selectedText?.length > 0) {
        await refresh(selectedText);
      } else if (stmt?.length > 0) {
        await refresh(stmt);
      }
    }
  };
  return (
    <Box
      sx={{
        height: 'calc(100vh - 32px)',
        '& .cm-editor .cm-content': { fontFamily: 'Consolas' },
        '& *': { fontFamily: 'Consolas' },
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <Box sx={{ height: '100%' }}>
        <EditorToolbar onClick={handleClick} />
        <CodeMirror
          ref={refs}
          value={stmt}
          height={`calc(100vh - ${sizeTop + 64}px)`}
          extensions={[sql(), sqlSnippets]}
          theme={isDarkTheme(theme) ? vscodeDark : basicLight}
          onChange={onChange}
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
        <DatasetItem />
      </Box>
    </Box>
  );
}

function EditorToolbar({ onClick }: { onClick: () => void }) {
  return (
    <ToolbarContainer>
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
        </IconButton>{' '}
      </Stack>
    </ToolbarContainer>
  );
}
