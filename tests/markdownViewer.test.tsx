import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import mermaid from 'mermaid';
import { MarkdownViewer } from '../src/components/MarkdownViewer';

// Mock mermaid to control render behavior in jsdom
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockImplementation(async (_id: string, chart: string) => {
      if (chart.includes('INVALID_SYNTAX')) {
        throw new Error('Parse error on line 1');
      }
      return { svg: `<svg data-testid="mermaid-svg"><text>${chart}</text></svg>` };
    })
  }
}));

describe('MarkdownViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders standard markdown headings and lists', () => {
    const md = '# Note Title\n\n## Subheading\n\n* Item 1\n* Item 2\n\nA regular paragraph.';
    render(
      <MarkdownViewer
        content={md}
        currentFolderId="folder-1"
        resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
      />
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Note Title');
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Subheading');
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('A regular paragraph.')).toBeInTheDocument();
  });

  it('renders GFM tables', () => {
    const md = '| Header A | Header B |\n| --- | --- |\n| Cell 1 | Cell 2 |';
    render(
      <MarkdownViewer
        content={md}
        currentFolderId="folder-1"
        resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
      />
    );
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Header A')).toBeInTheDocument();
    expect(screen.getByText('Cell 1')).toBeInTheDocument();
  });

  it('renders highlights and comments in markdown', () => {
    const md = 'This is ==highlighted text== and this has <mark data-comment="Verify citation">commented text</mark>.';
    render(
      <MarkdownViewer
        content={md}
        currentFolderId="folder-1"
        resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
      />
    );
    expect(screen.getByText('highlighted text')).toBeInTheDocument();
    expect(screen.getByText('commented text')).toBeInTheDocument();
    expect(screen.getByText(/Verify citation/i)).toBeInTheDocument();
  });

  it('renders KaTeX math equations (inline and display)', () => {
    const md = 'Here is inline math: $E = mc^2$\n\n$$\n\\int_0^1 x^2 dx\n$$';
    const { container } = render(
      <MarkdownViewer
        content={md}
        currentFolderId="folder-1"
        resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
      />
    );
    const katexElements = container.querySelectorAll('.katex');
    expect(katexElements.length).toBeGreaterThanOrEqual(2);
    const katexDisplay = container.querySelectorAll('.katex-display');
    expect(katexDisplay.length).toBe(1);
  });

  it('renders code blocks with syntax highlighting classes', () => {
    const md = '```typescript\nconst greeting: string = "hello world";\n```';
    const { container } = render(
      <MarkdownViewer
        content={md}
        currentFolderId="folder-1"
        resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
      />
    );
    const codeBlock = container.querySelector('code.hljs');
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock?.className).toContain('language-typescript');
    expect(codeBlock?.textContent).toContain('const greeting: string = "hello world";');
  });

  it('renders Mermaid diagram blocks using MermaidBlock', async () => {
    const md = '```mermaid\ngraph TD\n  A --> B\n```';
    const { container } = render(
      <MarkdownViewer
        content={md}
        currentFolderId="folder-1"
        resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
      />
    );

    await waitFor(() => {
      expect(mermaid.render).toHaveBeenCalled();
      const svg = container.querySelector('[data-testid="mermaid-svg"]');
      expect(svg).toBeInTheDocument();
    });
  });

  it('renders error badge when Mermaid diagram fails to render', async () => {
    const md = '```mermaid\nINVALID_SYNTAX\n```';
    render(
      <MarkdownViewer
        content={md}
        currentFolderId="folder-1"
        resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed to render diagram: Parse error on line 1/)).toBeInTheDocument();
    });
  });

  it('displays loading state while resolving relative image', async () => {
    let resolvePromise: (value: string | null) => void;
    const pendingPromise = new Promise<string | null>((resolve) => {
      resolvePromise = resolve;
    });
    const resolveImageBlobUrl = vi.fn().mockReturnValue(pendingPromise);

    render(
      <MarkdownViewer
        content="![My Figure](./images/figure1.png)"
        currentFolderId="folder-1"
        resolveImageBlobUrl={resolveImageBlobUrl}
      />
    );

    expect(screen.getByText('Loading figure: ./images/figure1.png...')).toBeInTheDocument();

    resolvePromise!('blob:http://localhost/test-blob-123');

    await waitFor(() => {
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('src', 'blob:http://localhost/test-blob-123');
      expect(img).toHaveAttribute('alt', 'My Figure');
    });
  });

  it('displays fallback warning badge when relative image resolves to null', async () => {
    const resolveImageBlobUrl = vi.fn().mockResolvedValue(null);

    render(
      <MarkdownViewer
        content="![Missing Figure](./missing-figure.png)"
        currentFolderId="folder-1"
        resolveImageBlobUrl={resolveImageBlobUrl}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('⚠️ Figure not found: ./missing-figure.png')).toBeInTheDocument();
    });
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('displays fallback warning badge when relative image resolution rejects', async () => {
    const resolveImageBlobUrl = vi.fn().mockRejectedValue(new Error('Network failure'));

    render(
      <MarkdownViewer
        content="![Failed Figure](./error-figure.png)"
        currentFolderId="folder-1"
        resolveImageBlobUrl={resolveImageBlobUrl}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('⚠️ Figure not found: ./error-figure.png')).toBeInTheDocument();
    });
  });

  it('renders external http/https and data URLs directly without calling resolveImageBlobUrl', async () => {
    const resolveImageBlobUrl = vi.fn().mockResolvedValue(null);
    const md = `
![External HTTP](http://example.com/pic1.jpg)
![External HTTPS](https://example.com/pic2.png)
![Data URL](data:image/png;base64,iVBORw0KGgo=)
    `;

    render(
      <MarkdownViewer
        content={md}
        currentFolderId="folder-1"
        resolveImageBlobUrl={resolveImageBlobUrl}
      />
    );

    await waitFor(() => {
      const imgs = screen.getAllByRole('img');
      expect(imgs).toHaveLength(3);
      expect(imgs[0]).toHaveAttribute('src', 'http://example.com/pic1.jpg');
      expect(imgs[1]).toHaveAttribute('src', 'https://example.com/pic2.png');
      expect(imgs[2]).toHaveAttribute('src', 'data:image/png;base64,iVBORw0KGgo=');
    });

    expect(resolveImageBlobUrl).not.toHaveBeenCalled();
  });

  it('triggers onImageClick callback when image is clicked', async () => {
    const onImageClick = vi.fn();
    const resolveImageBlobUrl = vi.fn().mockResolvedValue('blob:http://localhost/clicked-image');

    render(
      <MarkdownViewer
        content="![Clickable](./photo.jpg)"
        currentFolderId="folder-1"
        resolveImageBlobUrl={resolveImageBlobUrl}
        onImageClick={onImageClick}
      />
    );

    const img = await screen.findByRole('img');
    fireEvent.click(img);

    expect(onImageClick).toHaveBeenCalledTimes(1);
    expect(onImageClick).toHaveBeenCalledWith('blob:http://localhost/clicked-image', 'Clickable');
  });

  it('renders inline code and code block without language', () => {
    const md = 'This has `const a = 1;` inline code and:\n\n```\nplain code block\n```';
    const { container } = render(
      <MarkdownViewer
        content={md}
        currentFolderId="folder-1"
        resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
      />
    );

    const codes = container.querySelectorAll('code');
    expect(codes.length).toBe(2);
    expect(screen.getByText('const a = 1;')).toBeInTheDocument();
    expect(screen.getByText('plain code block')).toBeInTheDocument();
  });

  it('renders MermaidBlock directly and handles empty or whitespace chart', async () => {
    const { MermaidBlock } = await import('../src/components/MermaidBlock');
    const { container } = render(<MermaidBlock chart="graph LR\n  X --> Y" />);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="mermaid-svg"]')).toBeInTheDocument();
    });
  });

  it('does not re-resolve image or flash loading when parent re-renders with new resolveImageBlobUrl reference', async () => {
    const resolve1 = vi.fn().mockResolvedValue('blob:http://localhost/stable-img');
    const { rerender } = render(
      <MarkdownViewer
        content="![Stable Image](./stable.png)"
        currentFolderId="folder-1"
        resolveImageBlobUrl={resolve1}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:http://localhost/stable-img');
    });
    expect(resolve1).toHaveBeenCalledTimes(1);

    // Re-render with new function reference for resolveImageBlobUrl
    const resolve2 = vi.fn().mockResolvedValue('blob:http://localhost/stable-img-new');
    rerender(
      <MarkdownViewer
        content="![Stable Image](./stable.png)"
        currentFolderId="folder-1"
        resolveImageBlobUrl={resolve2}
      />
    );

    // Should NOT have triggered loading flash or called resolve2 because src did not change
    expect(screen.queryByText('Loading figure: ./stable.png...')).not.toBeInTheDocument();
    expect(resolve2).not.toHaveBeenCalled();
    expect(screen.getByRole('img')).toHaveAttribute('src', 'blob:http://localhost/stable-img');
  });
});
