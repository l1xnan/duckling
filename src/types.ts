export interface TreeNode {
  name: string;
  path: string;
  type?: string;
  children?: TreeNode[];
}
