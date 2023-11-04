import * as React from "react";
import clsx from "clsx";
import Typography from "@mui/material/Typography";
import {
  TreeItem,
  TreeItemProps,
  useTreeItem,
  TreeItemContentProps,
} from "@mui/x-tree-view/TreeItem";
import { Box } from "@mui/material";
import { getTypeIcon } from "./FileTree";
import { FileNode } from "@/stores/db";

const CustomContent = React.forwardRef(function CustomContent(
  props: TreeItemContentProps,
  ref: React.Ref<HTMLDivElement>
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
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    preventSelection(event);
  };

  const handleExpansionClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    handleExpansion(event);
  };

  const handleSelectionClick = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
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
    <div
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
      <div onClick={handleExpansionClick} className={classes.iconContainer}>
        {icon}
      </div>
      <div onClick={handleSelectionClick} className={classes.label}>
        {label}
      </div>
    </div>
  );
});

export const DBTreeItem = React.forwardRef(function CustomTreeItem(
  props: TreeItemProps,
  ref: React.Ref<HTMLLIElement>
) {
  return <TreeItem ContentComponent={CustomContent} {...props} ref={ref} />;
});

interface TreeItemLabelProps {
  node: FileNode;
  nodeId: string;
}

export const TreeItemLabel = React.forwardRef(
  (props: TreeItemLabelProps, ref) => {
    const { node, nodeId } = props;
    const { expanded } = useTreeItem(nodeId);
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          p: 0,
          pt: 0.5,
          pb: 0.5,
          fontSize: "12px",
          height: "24px",
        }}
        ref={ref as React.Ref<HTMLDivElement>}
      >
        <Box
          color="inherit"
          sx={{
            mr: 1,
            display: "flex",
            alignItems: "center",
            height: "100%",
            "& svg": {
              fontSize: "16px",
              height: "16px",
              width: "16px",
            },
          }}
        >
          {getTypeIcon(
            !node.is_dir
              ? node?.type ?? node.path.split(".")[1]
              : expanded
              ? "folder-open"
              : "folder"
          )}
        </Box>

        <Typography
          sx={{
            fontWeight: "inherit",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {node.name}
        </Typography>
      </Box>
    );
  }
);
