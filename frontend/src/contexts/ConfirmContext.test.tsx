import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider, useConfirm } from './ConfirmContext';

// Test component that uses the confirm hook
function TestComponent({ onResult }: { onResult: (result: boolean) => void }) {
  const { confirm, confirmDelete } = useConfirm();

  const handleConfirm = async () => {
    const result = await confirm({
      title: 'Test Confirmation',
      message: 'Are you sure you want to proceed?',
      confirmText: 'Yes',
      cancelText: 'No',
      variant: 'warning',
    });
    onResult(result);
  };

  const handleDelete = async () => {
    const result = await confirmDelete('Test Item');
    onResult(result);
  };

  return (
    <div>
      <button onClick={handleConfirm}>Show Confirm</button>
      <button onClick={handleDelete}>Show Delete Confirm</button>
    </div>
  );
}

describe('ConfirmContext', () => {
  it('should show confirmation dialog', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();

    render(
      <ConfirmProvider>
        <TestComponent onResult={onResult} />
      </ConfirmProvider>
    );

    await user.click(screen.getByText('Show Confirm'));

    expect(screen.getByText('Test Confirmation')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('should return true when confirmed', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();

    render(
      <ConfirmProvider>
        <TestComponent onResult={onResult} />
      </ConfirmProvider>
    );

    await user.click(screen.getByText('Show Confirm'));
    await user.click(screen.getByText('Yes'));

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledWith(true);
    });
  });

  it('should return false when cancelled', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();

    render(
      <ConfirmProvider>
        <TestComponent onResult={onResult} />
      </ConfirmProvider>
    );

    await user.click(screen.getByText('Show Confirm'));
    await user.click(screen.getByText('No'));

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledWith(false);
    });
  });

  it('should return false when clicking overlay', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();

    render(
      <ConfirmProvider>
        <TestComponent onResult={onResult} />
      </ConfirmProvider>
    );

    await user.click(screen.getByText('Show Confirm'));

    // Find and click the overlay (the dark background)
    const overlay = document.querySelector('[class*="overlay"]');
    expect(overlay).toBeInTheDocument();
    await user.click(overlay!);

    await waitFor(() => {
      expect(onResult).toHaveBeenCalledWith(false);
    });
  });

  it('should show delete confirmation with correct text', async () => {
    const user = userEvent.setup();
    const onResult = vi.fn();

    render(
      <ConfirmProvider>
        <TestComponent onResult={onResult} />
      </ConfirmProvider>
    );

    await user.click(screen.getByText('Show Delete Confirm'));

    expect(screen.getByText('Delete Confirmation')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete "Test Item"/)).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('should throw error when used outside provider', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestComponent onResult={() => {}} />);
    }).toThrow('useConfirm must be used within a ConfirmProvider');

    consoleSpy.mockRestore();
  });
});
