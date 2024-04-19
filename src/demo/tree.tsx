import { TreeView, TreeViewItem } from '@/components/custom/TreeView1';
import { Icon12Hours, IconBrandJavascript } from '@tabler/icons-react';
import {
    CrossIcon,
    FanIcon,
    FolderArchiveIcon,
    FolderCheckIcon,
} from 'lucide-react';
import { flattenTree } from 'react-accessible-treeview';

export const folder = {
  name: '',
  children: [
    {
      name: 'src',
      children: [
        { name: 'index.js', type: 'js' },
        { name: 'styles.css', type: 'css' },
      ],
    },
    {
      name: 'node_modules',
      children: [
        {
          name: 'react-accessible-treeview',
          children: [{ name: 'index.js' }],
        },
        { name: 'react', children: [{ name: 'index.js' }] },
      ],
    },
    {
      name: '.npmignore',
    },
    {
      name: 'package.json',
    },
    {
      name: 'webpack.config.js',
      metadata: {
        type: 'js',
      },
    },
  ],
};

const data = flattenTree(folder);

function DirectoryTreeView() {
  return (
    <div>
      <div className="directory">
        <TreeView
          data={data}
          aria-label="directory tree"
          nodeRenderer={({
            element,
            isBranch,
            isExpanded,
            getNodeProps,
            level,
            isSelected,
          }) => {
            console.log('element', element);
            return (
              <TreeViewItem
                isExpanded={isExpanded}
                isBranch={isBranch}
                isSelected={isSelected}
                level={level}
                xPadding={8}
                name={element.name}
                {...getNodeProps()}
              />
            );
          }}
        />
      </div>
    </div>
  );
}

const FolderIcon = ({ isOpen }) =>
  isOpen ? <FolderArchiveIcon /> : <FolderCheckIcon />;

const FileIcon = ({ filename }) => {
  const extension = filename.slice(filename.lastIndexOf('.') + 1);
  switch (extension) {
    case 'js':
      return <IconBrandJavascript color="yellow" className="icon" />;
    case 'css':
      return <CrossIcon color="turquoise" className="icon" />;
    case 'json':
      return <FanIcon color="yellow" className="icon" />;
    case 'npmignore':
      return <Icon12Hours color="red" className="icon" />;
    default:
      return null;
  }
};

export default DirectoryTreeView;
