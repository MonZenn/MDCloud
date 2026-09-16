import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PromptModal } from '../src/components/PromptModal';

describe('PromptModal', () => {
  it('does not render when isOpen is false', () => {
    render(
      <PromptModal
        isOpen={false}
        title="New Note"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.queryByText('New Note')).not.toBeInTheDocument();
  });

  it('renders title, placeholder, and initial value when isOpen is true', () => {
    render(
      <PromptModal
        isOpen={true}
        title="New Note"
        message="Enter note title:"
        placeholder="e.g. Plan.md"
        defaultValue="Draft.md"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    expect(screen.getByText('New Note')).toBeInTheDocument();
    expect(screen.getByText('Enter note title:')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('e.g. Plan.md') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe('Draft.md');
  });

  it('calls onConfirm with input text on clicking confirm button', () => {
    const onConfirm = vi.fn();
    render(
      <PromptModal
        isOpen={true}
        title="New Note"
        confirmText="Create Note"
        placeholder="Note.md"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    const input = screen.getByPlaceholderText('Note.md');
    fireEvent.change(input, { target: { value: 'Research.md' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Note' }));
    expect(onConfirm).toHaveBeenCalledWith('Research.md');
  });

  it('calls onConfirm on pressing Enter', () => {
    const onConfirm = vi.fn();
    render(
      <PromptModal
        isOpen={true}
        title="New Folder"
        placeholder="Folder"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    const input = screen.getByPlaceholderText('Folder');
    fireEvent.change(input, { target: { value: 'Biology' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onConfirm).toHaveBeenCalledWith('Biology');
  });

  it('does not call onConfirm when input is empty or only whitespace', () => {
    const onConfirm = vi.fn();
    render(
      <PromptModal
        isOpen={true}
        title="New Note"
        confirmText="Create"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );
    const confirmBtn = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(confirmBtn);
    expect(onConfirm).not.toHaveBeenCalled();

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('calls onCancel on clicking Cancel button', () => {
    const onCancel = vi.fn();
    render(
      <PromptModal
        isOpen={true}
        title="New Note"
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
      <PromptModal
        isOpen={true}
        title="New Note"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
