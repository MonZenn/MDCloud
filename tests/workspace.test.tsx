import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Workspace } from '../src/components/Workspace';
import { SyncBadge } from '../src/components/SyncBadge';
import { ImageLightbox } from '../src/components/ImageLightbox';

// Mock mermaid to prevent errors in jsdom
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockImplementation(async (_id: string, chart: string) => {
      return { svg: `<svg data-testid="mermaid-svg"><text>${chart}</text></svg>` };
    })
  }
}));

describe('SyncBadge', () => {
  it('renders synced status', () => {
    render(<SyncBadge status="synced" />);
    expect(screen.getByText('Saved to Drive')).toBeInTheDocument();
  });

  it('renders saving status', () => {
    render(<SyncBadge status="saving" />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('renders offline status', () => {
    render(<SyncBadge status="offline" />);
    expect(screen.getByText('Saved Locally (Offline)')).toBeInTheDocument();
  });

  it('renders error status with clickable retry button', () => {
    const onRetry = vi.fn();
    render(<SyncBadge status="error" onRetry={onRetry} />);
    const retryBtn = screen.getByRole('button', { name: /Sync Failed \(Retry\)/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('ImageLightbox', () => {
  it('renders full-size image and close button', () => {
    const onClose = vi.fn();
    render(
      <ImageLightbox
        url="blob:http://localhost/test-figure.png"
        alt="Test Diagram"
        onClose={onClose}
      />
    );

    const img = screen.getByRole('img', { name: 'Test Diagram' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'blob:http://localhost/test-figure.png');

    const closeBtn = screen.getByRole('button', { name: /close/i });
    expect(closeBtn).toBeInTheDocument();
  });

  it('calls onClose when close button or backdrop is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(
      <ImageLightbox
        url="blob:http://localhost/test-figure.png"
        alt="Test Diagram"
        onClose={onClose}
      />
    );

    // Close button click
    const closeBtn = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Backdrop click
    const backdrop = container.firstChild as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('stops propagation when image itself is clicked so lightbox stays open', () => {
    const onClose = vi.fn();
    render(
      <ImageLightbox
        url="blob:http://localhost/test-figure.png"
        alt="Test Diagram"
        onClose={onClose}
      />
    );

    const img = screen.getByRole('img', { name: 'Test Diagram' });
    fireEvent.click(img);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Workspace', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders initial note title, editor textarea, and preview in split mode by default', () => {
    render(
      <Workspace
        noteTitle="Calculus.md"
        initialContent="# Hello Calculus"
        currentFolderId="folder-1"
        onSaveContent={vi.fn().mockResolvedValue(undefined)}
        onUploadImage={vi.fn().mockResolvedValue('./images/fig.png')}
        resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
      />
    );

    expect(screen.getByText('Calculus.md')).toBeInTheDocument();
    expect(screen.getByDisplayValue('# Hello Calculus')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Hello Calculus' })).toBeInTheDocument();
    expect(screen.getByText('Saved to Drive')).toBeInTheDocument();
  });

  it('switches view modes between edit, preview, and split', () => {
    render(
      <Workspace
        noteTitle="Calculus.md"
        initialContent="# Calculus Notes"
        currentFolderId="folder-1"
        onSaveContent={vi.fn().mockResolvedValue(undefined)}
        onUploadImage={vi.fn().mockResolvedValue('./images/fig.png')}
        resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
      />
    );

    const editBtn = screen.getByRole('button', { name: /edit/i });
    const splitBtn = screen.getByRole('button', { name: /split/i });
    const previewBtn = screen.getByRole('button', { name: /preview/i });

    // Switch to edit-only mode
    fireEvent.click(editBtn);
    expect(screen.getByPlaceholderText('Write your markdown note here...')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();

    // Switch to preview-only mode
    fireEvent.click(previewBtn);
    expect(screen.queryByPlaceholderText('Write your markdown note here...')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Calculus Notes' })).toBeInTheDocument();

    // Switch back to split mode
    fireEvent.click(splitBtn);
    expect(screen.getByPlaceholderText('Write your markdown note here...')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Calculus Notes' })).toBeInTheDocument();
  });

  describe('Autosave and Sync Status', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('debounces content changes by 1500ms and updates sync status', async () => {
      const onSaveContent = vi.fn().mockResolvedValue(undefined);

      render(
        <Workspace
          noteTitle="Calculus.md"
          initialContent="# Hello"
          currentFolderId="folder-1"
          onSaveContent={onSaveContent}
          onUploadImage={vi.fn()}
          resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
        />
      );

      const textarea = screen.getByPlaceholderText('Write your markdown note here...');

      // First change
      fireEvent.change(textarea, { target: { value: '# Hello World' } });

      // Immediate status: Saving...
      expect(screen.getByText('Saving...')).toBeInTheDocument();
      expect(onSaveContent).not.toHaveBeenCalled();

      // Advance by 1000ms (not yet 1500ms)
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onSaveContent).not.toHaveBeenCalled();

      // Second change within debounce window resets timer
      fireEvent.change(textarea, { target: { value: '# Hello World 2' } });

      // Advance by 1000ms again (total 2000ms from start, but 1000ms from second change)
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onSaveContent).not.toHaveBeenCalled();

      // Advance remaining 500ms to complete second debounce
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(onSaveContent).toHaveBeenCalledTimes(1);
      expect(onSaveContent).toHaveBeenCalledWith('# Hello World 2');
      expect(screen.getByText('Saved to Drive')).toBeInTheDocument();
    });

    it('displays error badge when autosave rejects and allows manual retry', async () => {
      const onSaveContent = vi.fn().mockRejectedValueOnce(new Error('Network error'));

      render(
        <Workspace
          noteTitle="Calculus.md"
          initialContent="# Draft"
          currentFolderId="folder-1"
          onSaveContent={onSaveContent}
          onUploadImage={vi.fn()}
          resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
        />
      );

      const textarea = screen.getByPlaceholderText('Write your markdown note here...');
      fireEvent.change(textarea, { target: { value: '# Draft Edited' } });

      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      expect(onSaveContent).toHaveBeenCalledTimes(1);
      const retryBtn = screen.getByRole('button', { name: /Sync Failed \(Retry\)/i });
      expect(retryBtn).toBeInTheDocument();

      // Retry succeeding
      onSaveContent.mockResolvedValueOnce(undefined);
      await act(async () => {
        fireEvent.click(retryBtn);
      });

      expect(onSaveContent).toHaveBeenCalledTimes(2);
      expect(onSaveContent).toHaveBeenLastCalledWith('# Draft Edited');
      expect(screen.getByText('Saved to Drive')).toBeInTheDocument();
    });
  });

  describe('Image Operations', () => {
    it('handles image paste into textarea', async () => {
      const onSaveContent = vi.fn().mockResolvedValue(undefined);
      const onUploadImage = vi.fn().mockResolvedValue('./images/pasted.png');

      render(
        <Workspace
          noteTitle="Calculus.md"
          initialContent="Initial content."
          currentFolderId="folder-1"
          onSaveContent={onSaveContent}
          onUploadImage={onUploadImage}
          resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
        />
      );

      const textarea = screen.getByPlaceholderText('Write your markdown note here...') as HTMLTextAreaElement;
      textarea.selectionStart = 7;
      textarea.selectionEnd = 7;

      const file = new File(['fake-image'], 'pasted.png', { type: 'image/png' });
      const clipboardItem = {
        type: 'image/png',
        getAsFile: () => file
      };

      await act(async () => {
        fireEvent.paste(textarea, {
          clipboardData: {
            items: [clipboardItem]
          }
        });
      });

      expect(onUploadImage).toHaveBeenCalledWith(file);
      const expectedContent = 'Initial\n![pasted.png](./images/pasted.png)\n content.';
      expect(textarea.value).toBe(expectedContent);
      expect(onSaveContent).toHaveBeenCalledWith(expectedContent);
      expect(screen.getByText('Saved to Drive')).toBeInTheDocument();
    });

    it('ignores non-image paste in textarea', async () => {
      const onSaveContent = vi.fn().mockResolvedValue(undefined);
      const onUploadImage = vi.fn().mockResolvedValue('./images/pasted.png');

      render(
        <Workspace
          noteTitle="Calculus.md"
          initialContent="Initial content."
          currentFolderId="folder-1"
          onSaveContent={onSaveContent}
          onUploadImage={onUploadImage}
          resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
        />
      );

      const textarea = screen.getByPlaceholderText('Write your markdown note here...');
      const clipboardItem = {
        type: 'text/plain',
        getAsFile: () => null
      };

      await act(async () => {
        fireEvent.paste(textarea, {
          clipboardData: {
            items: [clipboardItem]
          }
        });
      });

      expect(onUploadImage).not.toHaveBeenCalled();
      expect(onSaveContent).not.toHaveBeenCalled();
    });

    it('handles file upload button and hidden file input', async () => {
      const onSaveContent = vi.fn().mockResolvedValue(undefined);
      const onUploadImage = vi.fn().mockResolvedValue('./images/figure1.png');

      render(
        <Workspace
          noteTitle="Calculus.md"
          initialContent="# Calculus Notes"
          currentFolderId="folder-1"
          onSaveContent={onSaveContent}
          onUploadImage={onUploadImage}
          resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
        />
      );

      const uploadBtn = screen.getByTitle('Upload figure');
      const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement;

      const clickSpy = vi.spyOn(fileInput, 'click');
      fireEvent.click(uploadBtn);
      expect(clickSpy).toHaveBeenCalled();

      const file = new File(['image-bits'], 'figure1.png', { type: 'image/png' });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(onUploadImage).toHaveBeenCalledWith(file);
      const expectedContent = '# Calculus Notes\n![figure1.png](./images/figure1.png)\n';
      expect(onSaveContent).toHaveBeenCalledWith(expectedContent);
      expect(screen.getByText('Saved to Drive')).toBeInTheDocument();
    });

    it('sets sync status to error if image upload rejects', async () => {
      const onSaveContent = vi.fn().mockResolvedValue(undefined);
      const onUploadImage = vi.fn().mockRejectedValue(new Error('Upload failed'));

      render(
        <Workspace
          noteTitle="Calculus.md"
          initialContent="# Calculus Notes"
          currentFolderId="folder-1"
          onSaveContent={onSaveContent}
          onUploadImage={onUploadImage}
          resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
        />
      );

      const fileInput = screen.getByTestId('file-upload-input');
      const file = new File(['image-bits'], 'figure1.png', { type: 'image/png' });
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [file] } });
      });

      expect(screen.getByRole('button', { name: /Sync Failed \(Retry\)/i })).toBeInTheDocument();
    });
  });

  describe('Lightbox Integration', () => {
    it('opens ImageLightbox when an image in MarkdownViewer is clicked and closes it', async () => {
      const resolveImageBlobUrl = vi.fn().mockResolvedValue('blob:http://localhost/fig1.png');

      render(
        <Workspace
          noteTitle="Calculus.md"
          initialContent="![Figure 1](./fig1.png)"
          currentFolderId="folder-1"
          onSaveContent={vi.fn().mockResolvedValue(undefined)}
          onUploadImage={vi.fn()}
          resolveImageBlobUrl={resolveImageBlobUrl}
        />
      );

      const renderedImg = await screen.findByRole('img', { name: 'Figure 1' });
      fireEvent.click(renderedImg);

      // Lightbox should now be open
      const closeBtn = screen.getByRole('button', { name: /close/i });
      expect(closeBtn).toBeInTheDocument();

      // Close lightbox
      fireEvent.click(closeBtn);
      expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    });
  });

  describe('Prop synchronization', () => {
    it('updates editor content when initialContent prop changes', () => {
      const { rerender } = render(
        <Workspace
          noteTitle="Calculus.md"
          initialContent="# Note 1"
          currentFolderId="folder-1"
          onSaveContent={vi.fn().mockResolvedValue(undefined)}
          onUploadImage={vi.fn()}
          resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
        />
      );

      expect(screen.getByDisplayValue('# Note 1')).toBeInTheDocument();

      rerender(
        <Workspace
          noteTitle="Calculus.md"
          initialContent="# Note 2 - Changed"
          currentFolderId="folder-1"
          onSaveContent={vi.fn().mockResolvedValue(undefined)}
          onUploadImage={vi.fn()}
          resolveImageBlobUrl={vi.fn().mockResolvedValue(null)}
        />
      );

      expect(screen.getByDisplayValue('# Note 2 - Changed')).toBeInTheDocument();
    });
  });
});
