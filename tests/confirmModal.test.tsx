import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfirmModal } from '../src/components/ConfirmModal';

describe('ConfirmModal', () => {
  it('does not render when isOpen is false', () => {
    render(
      <ConfirmModal
        isOpen={false}
        title="Delete Item"
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByText('Delete Item')).not.toBeInTheDocument();
  });

  it('renders title, message, and confirm button when isOpen is true', () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Delete Note"
        message="Are you sure you want to delete Calculus.md?"
        confirmText="Delete"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('Delete Note')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to delete Calculus.md?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  it('calls onConfirm on clicking confirm button', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        title="Delete Note"
        message="Delete note?"
        confirmText="Delete"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel on clicking cancel button', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        title="Delete Folder"
        message="Delete folder?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel on pressing Escape key', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        title="Delete Folder"
        message="Delete folder?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
