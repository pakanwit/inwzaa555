import clsx from 'clsx';

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  alt: string;
};

export function ImageThumb({ className, alt, ...rest }: Props) {
  return (
    <span className={clsx('bevel-in bg-white p-1 inline-block', className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={alt} className="block max-w-full h-auto" {...rest} />
    </span>
  );
}
