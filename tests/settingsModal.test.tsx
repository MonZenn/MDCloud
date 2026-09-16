import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SettingsModal } from '../src/components/SettingsModal';
import { IosInstallBanner } from '../src/components/IosInstallBanner';
import { AppConfig } from '../src/services/configStore';

describe('SettingsModal', () => {
  it('returns null when isOpen is false', () => {
    const { container } = render(
      <SettingsModal
        isOpen={false}
        currentConfig={null}
        onSaveConfig={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('submits valid Client ID and parses folder link into folder ID', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <SettingsModal
        isOpen={true}
        currentConfig={null}
        onSaveConfig={handleSave}
        onClose={handleClose}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/apps\.googleusercontent\.com/i), {
      target: { value: 'my-client-id.apps.googleusercontent.com' },
    });
    fireEvent.change(screen.getByPlaceholderText(/drive\.google\.com\/drive\/folders/i), {
      target: { value: 'https://drive.google.com/drive/folders/folder987' },
    });

    fireEvent.click(screen.getByRole('button', { name: /save & connect/i }));

    expect(handleSave).toHaveBeenCalledWith({
      clientId: 'my-client-id.apps.googleusercontent.com',
      folderId: 'folder987',
      folderUrl: 'https://drive.google.com/drive/folders/folder987',
      theme: 'dark',
    });
    expect(handleClose).toHaveBeenCalled();
  });

  it('prepopulates inputs from currentConfig', () => {
    const existingConfig: AppConfig = {
      clientId: 'existing-client-id.apps.googleusercontent.com',
      folderId: 'folder123',
      folderUrl: 'https://drive.google.com/drive/folders/folder123',
      theme: 'dark',
    };

    render(
      <SettingsModal
        isOpen={true}
        currentConfig={existingConfig}
        onSaveConfig={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const clientInput = screen.getByPlaceholderText(/apps\.googleusercontent\.com/i) as HTMLInputElement;
    const folderInput = screen.getByPlaceholderText(/drive\.google\.com\/drive\/folders/i) as HTMLInputElement;

    expect(clientInput.value).toBe('existing-client-id.apps.googleusercontent.com');
    expect(folderInput.value).toBe('https://drive.google.com/drive/folders/folder123');
  });

  it('prepopulates folderId when folderUrl is undefined in currentConfig', () => {
    const existingConfig: AppConfig = {
      clientId: 'client-abc.apps.googleusercontent.com',
      folderId: 'raw-folder-id-xyz',
      theme: 'dark',
    };

    render(
      <SettingsModal
        isOpen={true}
        currentConfig={existingConfig}
        onSaveConfig={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const folderInput = screen.getByPlaceholderText(/drive\.google\.com\/drive\/folders/i) as HTMLInputElement;
    expect(folderInput.value).toBe('raw-folder-id-xyz');
  });

  it('displays validation error and does not save when client ID is empty', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <SettingsModal
        isOpen={true}
        currentConfig={null}
        onSaveConfig={handleSave}
        onClose={handleClose}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/drive\.google\.com\/drive\/folders/i), {
      target: { value: 'folder123' },
    });

    const form = screen.getByRole('button', { name: /save & connect/i }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(screen.getByText(/please enter your google oauth client id/i)).toBeInTheDocument();
    expect(handleSave).not.toHaveBeenCalled();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('displays validation error and does not save when folder ID/link is empty', () => {
    const handleSave = vi.fn();
    const handleClose = vi.fn();

    render(
      <SettingsModal
        isOpen={true}
        currentConfig={null}
        onSaveConfig={handleSave}
        onClose={handleClose}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/apps\.googleusercontent\.com/i), {
      target: { value: 'client123.apps.googleusercontent.com' },
    });

    const form = screen.getByRole('button', { name: /save & connect/i }).closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(screen.getByText(/please enter your google drive folder link or id/i)).toBeInTheDocument();
    expect(handleSave).not.toHaveBeenCalled();
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('clears validation error when typing into inputs', () => {
    render(
      <SettingsModal
        isOpen={true}
        currentConfig={null}
        onSaveConfig={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const form = screen.getByRole('button', { name: /save & connect/i }).closest('form');
    fireEvent.submit(form!);
    expect(screen.getByText(/please enter your google oauth client id/i)).toBeInTheDocument();

    const clientInput = screen.getByPlaceholderText(/apps\.googleusercontent\.com/i);
    fireEvent.change(clientInput, { target: { value: 'some-client' } });
    expect(screen.queryByText(/please enter your google oauth client id/i)).toBeNull();

    fireEvent.submit(form!);
    expect(screen.getByText(/please enter your google drive folder link or id/i)).toBeInTheDocument();

    const folderInput = screen.getByPlaceholderText(/drive\.google\.com\/drive\/folders/i);
    fireEvent.change(folderInput, { target: { value: 'some-folder' } });
    expect(screen.queryByText(/please enter your google drive folder link or id/i)).toBeNull();
  });

  it('updates form values when currentConfig prop changes', () => {
    const { rerender } = render(
      <SettingsModal
        isOpen={true}
        currentConfig={null}
        onSaveConfig={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const clientInput = screen.getByPlaceholderText(/apps\.googleusercontent\.com/i) as HTMLInputElement;
    expect(clientInput.value).toBe('');

    const newConfig: AppConfig = {
      clientId: 'updated-client.apps.googleusercontent.com',
      folderId: 'folder-abc',
      theme: 'dark',
    };

    rerender(
      <SettingsModal
        isOpen={true}
        currentConfig={newConfig}
        onSaveConfig={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(clientInput.value).toBe('updated-client.apps.googleusercontent.com');
  });

  it('shows close button when currentConfig exists and calls onClose on click', () => {
    const handleClose = vi.fn();
    const existingConfig: AppConfig = {
      clientId: 'id.apps.googleusercontent.com',
      folderId: 'folder1',
      theme: 'dark',
    };

    render(
      <SettingsModal
        isOpen={true}
        currentConfig={existingConfig}
        onSaveConfig={vi.fn()}
        onClose={handleClose}
      />
    );

    const closeButton = screen.getByLabelText(/close settings/i);
    expect(closeButton).toBeInTheDocument();
    fireEvent.click(closeButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not render close button during initial setup when currentConfig is null', () => {
    render(
      <SettingsModal
        isOpen={true}
        currentConfig={null}
        onSaveConfig={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.queryByLabelText(/close settings/i)).toBeNull();
  });
});

describe('IosInstallBanner', () => {
  let originalUserAgent: string;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalUserAgent = navigator.userAgent;
    originalMatchMedia = window.matchMedia;
  });

  afterEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    window.matchMedia = originalMatchMedia;
    delete (window.navigator as any).standalone;
    vi.restoreAllMocks();
  });

  it('renders install prompt banner on iOS in non-standalone browser', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<IosInstallBanner />);

    expect(
      screen.getByText(/install on ipad\/iphone: tap/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
  });

  it('dismisses banner when close button is clicked', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<IosInstallBanner />);

    expect(screen.getByText(/install on ipad\/iphone: tap/i)).toBeInTheDocument();

    const closeBtn = screen.getByLabelText(/dismiss install prompt/i);
    fireEvent.click(closeBtn);

    expect(screen.queryByText(/install on ipad\/iphone: tap/i)).toBeNull();
  });

  it('does not render banner when not iOS', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      configurable: true,
    });
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<IosInstallBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render banner on iOS if already in standalone mode (display-mode: standalone)', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(display-mode: standalone)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<IosInstallBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render banner on iOS if navigator.standalone is true', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'standalone', {
      value: true,
      configurable: true,
    });
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<IosInstallBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('does not render banner if window.MSStream is true (Windows Phone pretending to be iOS/IE)', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    });
    (window as any).MSStream = {};
    window.matchMedia = vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { container } = render(<IosInstallBanner />);
    expect(container.firstChild).toBeNull();
    delete (window as any).MSStream;
  });
});
