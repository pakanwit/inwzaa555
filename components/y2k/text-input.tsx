import { forwardRef, useId } from 'react';
import clsx from 'clsx';

type Props = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export const TextInput = forwardRef<HTMLInputElement, Props>(function TextInput(
  { label, error, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="font-bold">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        className={clsx(
          'bevel-in bg-white px-2 py-1 font-sans text-[13px]',
          className,
        )}
        {...rest}
      />
      {error ? <span className="text-y2k-magenta">{error}</span> : null}
    </div>
  );
});
