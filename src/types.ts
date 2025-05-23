export interface TreeNode {
  name: string;
  path: string;
  type?: string;
  children?: TreeNode[];
}

export interface NodeElementType {
  id: string;
  path: string;
  dbId: string;
  name: string;
  displayName?: string;
  icon: string;
  type: string;
  loading?: boolean;
  children?: NodeElementType[];
}
