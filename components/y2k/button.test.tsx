import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('renders children and fires onClick', async () => {
    const user = userEvent.setup();
    const handle = vi.fn();
    render(<Button onClick={handle}>Click me</Button>);
    await user.click(screen.getByRole('button', { name: /click me/i }));
    expect(handle).toHaveBeenCalledOnce();
  });

  it('respects disabled', async () => {
    const user = userEvent.setup();
    const handle = vi.fn();
    render(<Button onClick={handle} disabled>Nope</Button>);
    await user.click(screen.getByRole('button', { name: /nope/i }));
    expect(handle).not.toHaveBeenCalled();
  });
});
