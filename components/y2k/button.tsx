import clsx from 'clsx';

type Variant = 'default' | 'primary' | 'danger';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
};

export function Button({
  className,
  variant = 'default',
  type = 'button',
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={clsx(
        'bevel-out px-3 py-1 min-h-[28px] min-w-[64px] text-[13px] font-sans',
        'active:bevel-in',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        variant === 'default' && 'bg-y2k-chrome-200 text-black',
        variant === 'primary' &&
          'bg-y2k-blue text-white font-bold',
        variant === 'danger' &&
          'bg-y2k-magenta text-white font-bold',
        className,
      )}
      {...rest}
    />
  );
}
