import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './badge';
import { StatusBar } from './status-bar';
import { Spinner } from './spinner';
import { Marquee } from './marquee';
import { ImageThumb } from './image-thumb';

describe('display primitives', () => {
  it('Badge renders text', () => {
    render(<Badge>admin</Badge>);
    expect(screen.getByText('admin')).toBeInTheDocument();
  });
  it('StatusBar renders children', () => {
    render(<StatusBar><span>hi</span></StatusBar>);
    expect(screen.getByText('hi')).toBeInTheDocument();
  });
  it('Spinner has role=status', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
  it('Marquee renders content', () => {
    render(<Marquee>scrolling</Marquee>);
    expect(screen.getByText('scrolling')).toBeInTheDocument();
  });
  it('ImageThumb renders an img', () => {
    render(<ImageThumb src="/x.png" alt="x" />);
    expect(screen.getByAltText('x')).toBeInTheDocument();
  });
});
