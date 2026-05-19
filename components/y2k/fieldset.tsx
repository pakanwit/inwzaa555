import clsx from 'clsx';

type Props = {
  legend: string;
  children: React.ReactNode;
  className?: string;
};

export function Fieldset({ legend, children, className }: Props) {
  return (
    <fieldset className={clsx('border border-y2k-chrome-700 p-3', className)}>
      <legend className="px-1 font-bold">{legend}</legend>
      <div className="flex flex-col gap-3">{children}</div>
    </fieldset>
  );
}
