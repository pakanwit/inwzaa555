import { forwardRef, useId } from 'react';
import clsx from 'clsx';

type Option = { value: string; label: string };
type Props = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label: string;
  options: Option[];
  error?: string;
};

export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { label, options, error, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="font-bold">
        {label}
      </label>
      <select
        ref={ref}
        id={selectId}
        className={clsx(
          'bevel-in bg-white px-2 py-1 font-sans text-[13px]',
          className,
        )}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-y2k-magenta">{error}</span> : null}
    </div>
  );
});
