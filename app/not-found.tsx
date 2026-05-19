export default function NotFound() {
  return (
    <main
      className="min-h-screen p-6 font-mono text-y2k-bsod-text"
      style={{ background: 'var(--color-y2k-bsod)' }}
    >
      <div className="max-w-2xl mx-auto space-y-4 mt-12">
        <p className="text-center text-y2k-bsod inline-block px-2 bg-y2k-bsod-text">
          Windows
        </p>
        <p>
          A fatal exception <strong>0E</strong> has occurred at{' '}
          <strong>0028:C0011E36</strong> in the route handler. The current
          application will be terminated.
        </p>
        <ul className="list-disc pl-6">
          <li>Press any key to terminate the current application.</li>
          <li>
            Press CTRL+ALT+DEL again to restart your computer. You will lose any
            unsaved information in all applications.
          </li>
        </ul>
        <p className="text-center mt-12">
          Press any key to continue <span className="animate-pulse">_</span>
        </p>
        <p className="text-center mt-8 text-xs">
          <a className="underline text-y2k-bsod-text" href="/">
            Return to the desktop
          </a>
        </p>
      </div>
    </main>
  );
}
