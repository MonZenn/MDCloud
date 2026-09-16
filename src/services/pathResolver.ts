export interface VirtualNode {
  id: string;
  name: string;
  isFolder: boolean;
  parentId: string | null;
  children?: VirtualNode[];
}

/**
 * Resolves a relative path string against an in-memory virtual node tree
 * starting from a given folder ID.
 *
 * Handles:
 * - Current directory references (`.` and `./`)
 * - Parent directory traversal (`..` and `../`)
 * - Subfolder navigation
 * - Case-insensitive name matching
 * - URI component decoding (`decodeURIComponent`)
 * - Leading and trailing quote trimming
 *
 * Returns the resolved VirtualNode or null if not found or invalid.
 */
export function resolveRelativePath(
  currentFolderId: string,
  relativePath: string,
  nodeMap: Map<string, VirtualNode>
): VirtualNode | null {
  const cleanPath = relativePath.trim().replace(/^['"]+|['"]+$/g, '').trim();
  if (!cleanPath) return null;

  // Normalize path segments
  const rawSegments = cleanPath.split('/').filter((s) => s.length > 0);
  if (rawSegments.length === 0) return null;

  let currentNode: VirtualNode | undefined = nodeMap.get(currentFolderId);
  if (!currentNode || !currentNode.isFolder) return null;

  for (let i = 0; i < rawSegments.length; i++) {
    if (!currentNode) return null;

    let segment: string;
    try {
      segment = decodeURIComponent(rawSegments[i]);
    } catch {
      segment = rawSegments[i];
    }

    if (segment === '.') {
      continue;
    } else if (segment === '..') {
      if (!currentNode.parentId) return null;
      const parentNode = nodeMap.get(currentNode.parentId);
      if (!parentNode) return null;
      currentNode = parentNode;
    } else {
      const isLastSegment = i === rawSegments.length - 1;
      const children: VirtualNode[] = currentNode.children || [];
      const child = children.find(
        (c) => c.name.toLowerCase() === segment.toLowerCase()
      );
      if (!child) return null;
      if (isLastSegment) {
        return child;
      }
      if (!child.isFolder) return null;
      currentNode = child;
    }
  }

  return currentNode || null;
}
