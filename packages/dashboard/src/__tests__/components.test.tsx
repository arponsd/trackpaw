import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MetricCard } from '../components/shared/MetricCard';
import { EmptyState } from '../components/shared/EmptyState';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { PageShell } from '../components/layout/PageShell';
import { Pagination } from '../components/data/Pagination';

describe('MetricCard', () => {
  it('renders label and formatted value', () => {
    render(<MetricCard label="Total Events" value={1234} />);
    expect(screen.getByText('Total Events')).toBeInTheDocument();
    expect(screen.getByText('1.2K')).toBeInTheDocument();
  });

  it('shows positive change in green', () => {
    render(<MetricCard label="Users" value={500} change={12.5} />);
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
  });

  it('shows negative change in red', () => {
    render(<MetricCard label="Users" value={500} change={-5.2} />);
    expect(screen.getByText('-5.2%')).toBeInTheDocument();
  });
});

describe('EmptyState', () => {
  it('renders default message', () => {
    render(<EmptyState />);
    expect(screen.getByText('No data available')).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<EmptyState message="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});

describe('LoadingSpinner', () => {
  it('renders without crashing', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

describe('PageShell', () => {
  it('renders title and children', () => {
    render(<PageShell title="Test Page"><p>Content</p></PageShell>);
    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('shows page info', () => {
    render(<Pagination total={100} limit={10} offset={0} onChange={() => {}} />);
    expect(screen.getByText('Showing 1–10 of 100')).toBeInTheDocument();
  });

  it('hides when single page', () => {
    const { container } = render(<Pagination total={5} limit={10} offset={0} onChange={() => {}} />);
    expect(container.innerHTML).toBe('');
  });
});
