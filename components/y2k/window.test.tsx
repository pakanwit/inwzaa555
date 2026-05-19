import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Window } from './window';

describe('Window', () => {
  it('renders title and children', () => {
    render(
      <Window title="Test Window">
        <p>hello</p>
      </Window>,
    );
    expect(screen.getByText('Test Window')).toBeInTheDocument();
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('exposes close button when onClose provided', () => {
    render(<Window title="X" onClose={() => {}}>x</Window>);
    expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument();
  });
});
