import {
  Box,
  Tooltip,
  TooltipProps,
  alpha,
  styled,
  tooltipClasses,
} from '@mui/material';
import Typography from '@mui/material/Typography';
import {
  TreeItem,
  TreeItemContentProps,
  TreeItemProps,
  useTreeItem,
} from '@mui/x-tree-view/TreeItem';
import clsx from 'clsx';
import * as React from 'react';

import { FileNode } from '@/stores/dbList';

import { getTypeIcon } from './FileTree';

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
    nodeId,
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
  } = useTreeItem(nodeId);

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

export const DBTreeItem = React.forwardRef(function CustomTreeItem(
  props: TreeItemProps,
  ref: React.Ref<HTMLLIElement>,
) {
  return <TreeItem ContentComponent={CustomContent} {...props} ref={ref} />;
});

interface TreeItemLabelProps {
  node: FileNode;
  nodeId: string;
}

export const NoMaxWidthTooltip = styled(
  ({ className, ...props }: TooltipProps) => (
    <Tooltip
      PopperProps={{
        modifiers: [
          {
            name: 'offset',
            options: {
              offset: [5, -10],
            },
          },
        ],
      }}
      {...props}
      classes={{ popper: className }}
    />
  ),
)({
  [`& .${tooltipClasses.tooltip}`]: {
    maxWidth: 'none',
  },
});

export const TreeItemLabel = React.forwardRef(
  (props: TreeItemLabelProps, ref) => {
    const { node, nodeId } = props;
    const { expanded } = useTreeItem(nodeId);
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 0,
          pt: 0.5,
          pb: 0.5,
          fontSize: '12px',
          height: '24px',
        }}
        ref={ref as React.Ref<HTMLDivElement>}
      >
        <Box
          color="inherit"
          sx={{
            mr: 1,
            display: 'flex',
            alignItems: 'center',
            height: '100%',
            '& svg': {
              fontSize: '16px',
              height: '16px',
              width: '16px',
            },
          }}
        >
          {getTypeIcon(
            !node.is_dir
              ? node?.type ?? node.path.split('.')[1]
              : expanded
                ? 'folder-open'
                : 'folder',
          )}
        </Box>

        <Typography
          sx={{
            fontWeight: 'inherit',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {node.name}
        </Typography>
      </Box>
    );
  },
);
