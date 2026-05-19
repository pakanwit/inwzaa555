import { forwardRef, useId } from 'react';
import clsx from 'clsx';

type Props = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  error?: string;
};

export const Textarea = forwardRef<HTMLTextAreaElement, Props>(function Textarea(
  { label, error, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const taId = id ?? autoId;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={taId} className="font-bold">{label}</label>
      <textarea
        ref={ref}
        id={taId}
        className={clsx(
          'bevel-in bg-white px-2 py-1 font-sans text-[13px] min-h-[72px]',
          className,
        )}
        {...rest}
      />
      {error ? <span className="text-y2k-magenta">{error}</span> : null}
    </div>
  );
});
