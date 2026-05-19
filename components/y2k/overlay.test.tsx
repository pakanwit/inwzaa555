import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dialog } from './dialog';
import { Tabs } from './tabs';

describe('Dialog', () => {
  it('renders when open and exposes close', async () => {
    const user = userEvent.setup();
    let closed = false;
    render(
      <Dialog open title="t" onClose={() => { closed = true; }}>
        body
      </Dialog>,
    );
    expect(screen.getByText('body')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close/i }));
    expect(closed).toBe(true);
  });
});

describe('Tabs', () => {
  it('shows the active panel and switches', async () => {
    const user = userEvent.setup();
    render(
      <Tabs
        tabs={[
          { id: 'a', label: 'A', content: <div>panel A</div> },
          { id: 'b', label: 'B', content: <div>panel B</div> },
        ]}
        defaultId="a"
      />,
    );
    expect(screen.getByText('panel A')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'B' }));
    expect(screen.getByText('panel B')).toBeInTheDocument();
  });
});
