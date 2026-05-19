import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TextInput } from './text-input';
import { Select } from './select';
import { Textarea } from './textarea';
import { Fieldset } from './fieldset';

describe('form inputs', () => {
  it('TextInput exposes label and value', () => {
    render(<TextInput label="Name" defaultValue="Pak" />);
    expect(screen.getByLabelText('Name')).toHaveValue('Pak');
  });
  it('Select renders options', () => {
    render(
      <Select label="Pick" options={[{ value: 'a', label: 'A' }]} />,
    );
    expect(screen.getByRole('combobox', { name: 'Pick' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'A' })).toBeInTheDocument();
  });
  it('Textarea works', () => {
    render(<Textarea label="Note" defaultValue="hi" />);
    expect(screen.getByLabelText('Note')).toHaveValue('hi');
  });
  it('Fieldset renders legend and children', () => {
    render(<Fieldset legend="Group"><p>x</p></Fieldset>);
    expect(screen.getByText('Group')).toBeInTheDocument();
    expect(screen.getByText('x')).toBeInTheDocument();
  });
});
