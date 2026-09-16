import { describe, it, expect } from 'vitest';
import { resolveRelativePath, VirtualNode } from '../src/services/pathResolver';

describe('PathResolver', () => {
  // Tree:
  // root (id: 'root')
  // ├── Math (id: 'math')
  // │   ├── Lecture.md (id: 'lec')
  // │   ├── plot.png (id: 'plot-img')
  // │   └── figures (id: 'math-figs')
  // │       ├── diagram.svg (id: 'diag-svg')
  // │       └── my chart.png (id: 'chart-img')
  // └── CS (id: 'cs')
  //     └── AI.png (id: 'ai-img')

  const nodeMap = new Map<string, VirtualNode>();

  const root: VirtualNode = { id: 'root', name: 'Root', isFolder: true, parentId: null, children: [] };
  const math: VirtualNode = { id: 'math', name: 'Math', isFolder: true, parentId: 'root', children: [] };
  const cs: VirtualNode = { id: 'cs', name: 'CS', isFolder: true, parentId: 'root', children: [] };
  const lec: VirtualNode = { id: 'lec', name: 'Lecture.md', isFolder: false, parentId: 'math' };
  const plot: VirtualNode = { id: 'plot-img', name: 'plot.png', isFolder: false, parentId: 'math' };
  const mathFigs: VirtualNode = { id: 'math-figs', name: 'figures', isFolder: true, parentId: 'math', children: [] };
  const diag: VirtualNode = { id: 'diag-svg', name: 'diagram.svg', isFolder: false, parentId: 'math-figs' };
  const chart: VirtualNode = { id: 'chart-img', name: 'my chart.png', isFolder: false, parentId: 'math-figs' };
  const aiImg: VirtualNode = { id: 'ai-img', name: 'AI.png', isFolder: false, parentId: 'cs' };

  root.children = [math, cs];
  math.children = [lec, plot, mathFigs];
  mathFigs.children = [diag, chart];
  cs.children = [aiImg];

  [root, math, cs, lec, plot, mathFigs, diag, chart, aiImg].forEach((n) => nodeMap.set(n.id, n));

  it('resolves image in the same folder by simple filename', () => {
    const target = resolveRelativePath('math', 'plot.png', nodeMap);
    expect(target?.id).toBe('plot-img');
  });

  it('resolves image in the same folder with ./ prefix', () => {
    const target = resolveRelativePath('math', './plot.png', nodeMap);
    expect(target?.id).toBe('plot-img');
  });

  it('resolves image inside a subfolder ./figures/diagram.svg', () => {
    const target = resolveRelativePath('math', './figures/diagram.svg', nodeMap);
    expect(target?.id).toBe('diag-svg');
  });

  it('resolves image in sibling folder using parent traversal ../CS/AI.png', () => {
    const target = resolveRelativePath('math', '../CS/AI.png', nodeMap);
    expect(target?.id).toBe('ai-img');
  });

  it('returns null if path does not exist', () => {
    const target = resolveRelativePath('math', './nonexistent.png', nodeMap);
    expect(target).toBeNull();
  });

  it('handles case-insensitive path matching', () => {
    expect(resolveRelativePath('math', 'PLOT.PNG', nodeMap)?.id).toBe('plot-img');
    expect(resolveRelativePath('math', './FIGURES/DIAGRAM.SVG', nodeMap)?.id).toBe('diag-svg');
    expect(resolveRelativePath('math', '../cs/ai.png', nodeMap)?.id).toBe('ai-img');
  });

  it('handles URL decoding in path segments', () => {
    const target = resolveRelativePath('math', './figures/my%20chart.png', nodeMap);
    expect(target?.id).toBe('chart-img');
    const targetDots = resolveRelativePath('math', '../CS/AI%2Epng', nodeMap);
    expect(targetDots?.id).toBe('ai-img');
  });

  it('handles malformed URL encoding gracefully without throwing', () => {
    const target = resolveRelativePath('math', './figures/%999.png', nodeMap);
    expect(target).toBeNull();
  });

  it('trims leading and trailing quotes from path', () => {
    expect(resolveRelativePath('math', '"./plot.png"', nodeMap)?.id).toBe('plot-img');
    expect(resolveRelativePath('math', "'./figures/diagram.svg'", nodeMap)?.id).toBe('diag-svg');
    expect(resolveRelativePath('math', '  "../CS/AI.png"  ', nodeMap)?.id).toBe('ai-img');
  });

  it('returns null when traversing through a non-folder node', () => {
    const target = resolveRelativePath('math', 'Lecture.md/subfile.png', nodeMap);
    expect(target).toBeNull();
  });

  it('returns null when traversing above the root directory', () => {
    const target = resolveRelativePath('math', '../../../../plot.png', nodeMap);
    expect(target).toBeNull();
  });

  it('resolves current folder with . or ./', () => {
    expect(resolveRelativePath('math', '.', nodeMap)?.id).toBe('math');
    expect(resolveRelativePath('math', './', nodeMap)?.id).toBe('math');
  });

  it('resolves parent folder with .. or ../', () => {
    expect(resolveRelativePath('math', '..', nodeMap)?.id).toBe('root');
    expect(resolveRelativePath('math', '../', nodeMap)?.id).toBe('root');
  });

  it('handles back-and-forth traversal', () => {
    const target = resolveRelativePath('math', './figures/../plot.png', nodeMap);
    expect(target?.id).toBe('plot-img');
  });

  it('returns null for empty, whitespace, or quote-only paths', () => {
    expect(resolveRelativePath('math', '', nodeMap)).toBeNull();
    expect(resolveRelativePath('math', '   ', nodeMap)).toBeNull();
    expect(resolveRelativePath('math', '""', nodeMap)).toBeNull();
    expect(resolveRelativePath('math', "''", nodeMap)).toBeNull();
    expect(resolveRelativePath('math', '/', nodeMap)).toBeNull();
  });

  it('returns null if start folder does not exist in nodeMap', () => {
    expect(resolveRelativePath('non-existent-id', './plot.png', nodeMap)).toBeNull();
  });

  it('returns null if start folder is actually a file', () => {
    expect(resolveRelativePath('plot-img', './sub.png', nodeMap)).toBeNull();
  });
});
