import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Button from '../Button';
import Badge from '../Badge';
import Panel from '../Panel';
import StatTile from '../StatTile';
import Select from '../Select';
import ErrorState from '../ErrorState';
import Table from '../Table';


describe('Academic Registrar UI Primitives', () => {
  test('Button renders with primary variant and handles click', () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Enroll Student</Button>);
    const btn = screen.getByRole('button', { name: /enroll student/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('Badge renders 4px rectangular with label and dot', () => {
    render(<Badge tone="success">Active</Badge>);
    const badgeText = screen.getByText('Active');
    expect(badgeText).toBeInTheDocument();
    expect(badgeText.parentElement).toHaveClass('rounded');
  });


  test('Panel renders header, children, and footer', () => {
    render(
      <Panel title="Roster Ledger" footer="End of records">
        <div>Registry rows</div>
      </Panel>
    );
    expect(screen.getByText('Roster Ledger')).toBeInTheDocument();
    expect(screen.getByText('Registry rows')).toBeInTheDocument();
    expect(screen.getByText('End of records')).toBeInTheDocument();
  });

  test('StatTile renders label and tabular value', () => {
    render(<StatTile label="Total Enrolled" value="1,420" trend="+4.2%" />);
    expect(screen.getByText('Total Enrolled')).toBeInTheDocument();
    expect(screen.getByText('1,420')).toHaveClass('tnum');
    expect(screen.getByText(/4\.2%/)).toBeInTheDocument();
  });

  test('Select renders with options and handles change', () => {
    const onChange = jest.fn();
    render(
      <Select
        label="Academic Term"
        options={[
          { value: 'fall', label: 'Fall 2026' },
          { value: 'spring', label: 'Spring 2027' },
        ]}
        onChange={onChange}
      />
    );
    const select = screen.getByLabelText(/academic term/i);
    expect(select).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'spring' } });
    expect(onChange).toHaveBeenCalled();
  });

  test('ErrorState renders alert message with retry button', () => {
    const onRetry = jest.fn();
    render(<ErrorState title="Sync Interrupted" onRetry={onRetry} />);
    expect(screen.getByText('Sync Interrupted')).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('Table renders column headers and rows with tabular numbers', () => {
    const columns = [
      { header: 'Roll No', accessor: 'rollNo', mono: true },
      { header: 'Student Name', accessor: 'name' },
      { header: 'Attendance', accessor: 'attendance', numeric: true },
    ];
    const data = [
      { rollNo: 'CS-101', name: 'Alice Smith', attendance: '94%' },
      { rollNo: 'CS-102', name: 'Bob Jones', attendance: '88%' },
    ];
    render(<Table columns={columns} data={data} />);
    expect(screen.getByText('Alice Smith')).toBeInTheDocument();
    expect(screen.getByText('CS-101')).toHaveClass('tnum');
  });
});
