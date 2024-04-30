import { TreeNode } from '@/types.ts';
import { alpha, styled } from '@mui/material';
import {
  TreeItem as MTreeItem,
  TreeItemContentProps,
  TreeItemProps,
  useTreeItemState,
} from '@mui/x-tree-view/TreeItem';

import { getTypeIcon } from '@/components/custom/Icons';
import clsx from 'clsx';
import * as React from 'react';

const CustomContentRoot = styled('div')(({ theme }) => ({
  WebkitTapHighlightColor: 'transparent',
  whiteSpace: 'nowrap',
  '&&:hover, &&.Mui-disabled, &&.Mui-focused, &&.Mui-selected, &&.Mui-selected.Mui-focused, &&.Mui-selected:hover':
    {
      backgroundColor: 'transparent',
    },
  '.MuiTreeItem-contentBar': {
    position: 'absolute',
    width: '100%',
    height: 24,
    left: 0,
  },
  '&:hover .MuiTreeItem-contentBar': {
    backgroundColor: theme.palette.action.hover,
    // Reset on touch devices, it doesn't add specificity
    '@media (hover: none)': {
      backgroundColor: 'transparent',
    },
  },
  '&.Mui-disabled .MuiTreeItem-contentBar': {
    opacity: theme.palette.action.disabledOpacity,
    backgroundColor: 'transparent',
  },
  '&.Mui-focused .MuiTreeItem-contentBar': {
    backgroundColor: theme.palette.action.focus,
  },
  '&.Mui-selected .MuiTreeItem-contentBar': {
    backgroundColor: alpha(
      theme.palette.primary.main,
      theme.palette.action.selectedOpacity,
    ),
  },
  '&.Mui-selected:hover .MuiTreeItem-contentBar': {
    backgroundColor: alpha(
      theme.palette.primary.main,
      theme.palette.action.selectedOpacity + theme.palette.action.hoverOpacity,
    ),
    // Reset on touch devices, it doesn't add specificity
    '@media (hover: none)': {
      backgroundColor: alpha(
        theme.palette.primary.main,
        theme.palette.action.selectedOpacity,
      ),
    },
  },
  '&.Mui-selected.Mui-focused .MuiTreeItem-contentBar': {
    backgroundColor: alpha(
      theme.palette.primary.main,
      theme.palette.action.selectedOpacity + theme.palette.action.focusOpacity,
    ),
  },
}));

const CustomContent = React.forwardRef(function CustomContent(
  props: TreeItemContentProps,
  ref: React.Ref<HTMLDivElement>,
) {
  const {
    classes,
    className,
    label,
    itemId,
    icon: iconProp,
    expansionIcon,
    displayIcon,
    onClick,
    ...other
  } = props;

  const {
    disabled,
    expanded,
    selected,
    focused,
    handleExpansion,
    handleSelection,
    preventSelection,
  } = useTreeItemState(itemId);

  const icon = iconProp || expansionIcon || displayIcon;

  const handleMouseDown = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    preventSelection(event);
  };

  const handleExpansionClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    handleExpansion(event);
  };

  const handleSelectionClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    handleSelection(event);
  };
  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    handleExpansion(event);
    handleSelection(event);

    if (onClick) {
      onClick(event);
    }
  };
  return (
    <CustomContentRoot
      {...other}
      className={clsx(className, classes.root, {
        [classes.expanded]: expanded,
        [classes.selected]: selected,
        [classes.focused]: focused,
        [classes.disabled]: disabled,
      })}
      onDoubleClick={handleClick}
      onMouseDown={handleMouseDown}
      ref={ref}
    >
      <div className="MuiTreeItem-contentBar" />

      <div onClick={handleExpansionClick} className={classes.iconContainer}>
        {icon}
      </div>
      <div onClick={handleSelectionClick} className={classes.label}>
        {label}
      </div>
    </CustomContentRoot>
  );
});

export const TreeItem = React.forwardRef(function CustomTreeItem(
  props: TreeItemProps,
  ref: React.Ref<HTMLLIElement>,
) {
  return <MTreeItem ContentComponent={CustomContent} {...props} ref={ref} />;
});

interface TreeItemLabelProps {
  node: TreeNode;
  nodeId: string;
  icon: string;
}

export const TreeItemLabel = React.forwardRef(
  (props: TreeItemLabelProps, ref) => {
    const { node, nodeId, icon } = props;
    const { expanded } = useTreeItemState(nodeId);
    return (
      <div
        className="flex items-center p-0 pt-0.5 pb-0.5 text-sm h-6"
        ref={ref as React.Ref<HTMLDivElement>}
      >
        <div className="mr-1 flex items-center h-full [&_svg]:text-base [&_svg]:size-4">
          {getTypeIcon(icon, expanded)}
        </div>
        <div className="overflow-hidden text-ellipsis font-mono">
          {node.name}
        </div>
      </div>
    );
  },
);
