import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Typography } from "@mui/material";
import { alpha, styled } from "@mui/material/styles";
import {
  TreeItem,
  TreeItemContentProps,
  TreeItemProps,
  useTreeItem,
} from "@mui/x-tree-view/TreeItem";
import { TreeView, TreeViewProps } from "@mui/x-tree-view/TreeView";
import { IconFile, IconFolder } from "@tabler/icons-react";
import clsx from "clsx";
import * as React from "react";

const CustomContentRoot = styled("div")(({ theme }) => ({
  WebkitTapHighlightColor: "transparent",
  "&&:hover, &&.Mui-disabled, &&.Mui-focused, &&.Mui-selected, &&.Mui-selected.Mui-focused, &&.Mui-selected:hover":
    {
      backgroundColor: "transparent",
    },
  ".MuiTreeItem-contentBar": {
    position: "absolute",
    width: "100%",
    height: 24,
    top: 0,
    left: 0,
  },

  "&": {
    position: "relative",
  },

  "&:hover .MuiTreeItem-contentBar": {
    backgroundColor: theme.palette.action.hover,
    // Reset on touch devices, it doesn't add specificity
    "@media (hover: none)": {
      backgroundColor: "transparent",
    },
  },
  "&.Mui-disabled .MuiTreeItem-contentBar": {
    opacity: theme.palette.action.disabledOpacity,
    backgroundColor: "transparent",
  },
  "&.Mui-focused .MuiTreeItem-contentBar": {
    backgroundColor: theme.palette.action.focus,
  },
  "&.Mui-selected .MuiTreeItem-contentBar": {
    backgroundColor: alpha(
      theme.palette.primary.main,
      theme.palette.action.selectedOpacity
    ),
  },
  "&.Mui-selected:hover .MuiTreeItem-contentBar": {
    backgroundColor: alpha(
      theme.palette.primary.main,
      theme.palette.action.selectedOpacity + theme.palette.action.hoverOpacity
    ),
    // Reset on touch devices, it doesn't add specificity
    "@media (hover: none)": {
      backgroundColor: alpha(
        theme.palette.primary.main,
        theme.palette.action.selectedOpacity
      ),
    },
  },
  "&.Mui-selected.Mui-focused .MuiTreeItem-contentBar": {
    backgroundColor: alpha(
      theme.palette.primary.main,
      theme.palette.action.selectedOpacity + theme.palette.action.focusOpacity
    ),
  },
}));

const CustomContent = React.forwardRef(function CustomContent(
  props: TreeItemContentProps,
  ref
) {
  const {
    className,
    classes,
    label,
    nodeId,
    icon: iconProp,
    expansionIcon,
    displayIcon,
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
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    preventSelection(event);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    handleExpansion(event);
    handleSelection(event);
  };

  return (
    <CustomContentRoot
      className={clsx(className, classes.root, {
        "Mui-expanded": expanded,
        "Mui-selected": selected,
        "Mui-focused": focused,
        "Mui-disabled": disabled,
      })}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      ref={ref as React.Ref<HTMLDivElement>}
    >
      <div className="MuiTreeItem-contentBar" />
      <div className={classes.iconContainer}>{icon}</div>
      <Typography component="div" className={classes.label}>
        {label}
      </Typography>
    </CustomContentRoot>
  );
});

const CustomTreeItem = React.forwardRef(function CustomTreeItem(
  props: TreeItemProps,
  ref: React.Ref<HTMLLIElement>
) {
  return <TreeItem ContentComponent={CustomContent} {...props} ref={ref} />;
});

export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
}

export interface FileTreeProps extends TreeViewProps<undefined> {
  data: FileNode[];
}

export default function FileTree({
  data,
  onNodeSelect,
  ...rest
}: FileTreeProps) {
  const renderTree = (node: FileNode) => (
    <CustomTreeItem
      key={node.path}
      nodeId={node.path}
      label={
        <Typography
          variant="body2"
          sx={{
            fontWeight: "inherit",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.name}
        </Typography>
      }
      icon={node.is_dir ? <IconFolder /> : <IconFile />}
    >
      {Array.isArray(node.children)
        ? node.children.map((node) => renderTree(node))
        : null}
    </CustomTreeItem>
  );

  return (
    <TreeView
      aria-label="file tree"
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpanded={["root"]}
      defaultExpandIcon={<ChevronRightIcon />}
      onNodeSelect={onNodeSelect}
      {...rest}
    >
      {data?.map((item) => renderTree(item))}
    </TreeView>
  );
}
