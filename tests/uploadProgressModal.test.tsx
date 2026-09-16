import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UploadProgressModal } from '../src/components/UploadProgressModal';

describe('UploadProgressModal', () => {
  it('does not render when isOpen is false', () => {
    render(
      <UploadProgressModal
        isOpen={false}
        current={0}
        total={5}
        currentFileName=""
        isComplete={false}
        errors={[]}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders progress, current file name, and progress bar when uploading', () => {
    render(
      <UploadProgressModal
        isOpen={true}
        current={2}
        total={5}
        currentFileName="figure1.png"
        isComplete={false}
        errors={[]}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Uploading 2 of 5 files/i)).toBeInTheDocument();
    expect(screen.getByText('figure1.png')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
  });

  it('shows completed state with Done button when isComplete is true', () => {
    const onClose = vi.fn();
    render(
      <UploadProgressModal
        isOpen={true}
        current={5}
        total={5}
        currentFileName=""
        isComplete={true}
        errors={[]}
        onClose={onClose}
      />
    );
    expect(screen.getByText(/Upload Complete/i)).toBeInTheDocument();
    expect(screen.getByText(/5 of 5 files uploaded successfully/i)).toBeInTheDocument();
    const doneBtn = screen.getByRole('button', { name: /Done/i });
    fireEvent.click(doneBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays error messages when upload errors occur', () => {
    render(
      <UploadProgressModal
        isOpen={true}
        current={2}
        total={3}
        currentFileName=""
        isComplete={true}
        errors={['Failed to upload bad-image.png: Network Error']}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/Failed to upload bad-image.png: Network Error/i)).toBeInTheDocument();
  });
});
