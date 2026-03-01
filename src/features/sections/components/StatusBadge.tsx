export type IsochroneStatus = 'idle' | 'fetching' | 'done' | 'error';

export function StatusBadge({ status }: { status: IsochroneStatus }): React.ReactElement | null {
  if (status === 'idle') return null;

  if (status === 'fetching') {
    return (
      <span className="font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-1 bg-neutral-100 text-neutral-900 border border-neutral-300">
        Computing
      </span>
    );
  }

  if (status === 'done') {
    return (
      <span className="font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-1 bg-neutral-900 text-white">
        Ready
      </span>
    );
  }

  return (
    <span className="font-mono text-[9px] font-bold uppercase tracking-widest px-2 py-1 bg-white text-neutral-900 border-2 border-neutral-900">
      Error
    </span>
  );
}

export function IsochroneIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <path d="M8 5.5C7 5.3 6 6 5.8 7C5.6 8 6.3 8.8 7 9.3C7.7 9.8 8.5 10 9.2 9.5C10 9 10.5 8 10.3 7C10.1 6 9 5.7 8 5.5Z"
        stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 3.5C5.8 3.2 3.8 4.5 3.4 6.5C3 8.5 4 10 5.3 11C6.5 12 8.2 12.5 9.8 11.5C11.3 10.5 12.5 8.8 12.2 6.8C11.9 4.8 10.2 3.8 8 3.5Z"
        stroke="currentColor" strokeWidth="0.9" />
      <path d="M8 1.5C4.8 1.1 2 3 1.5 5.8C1 8.6 2.3 10.8 4 12.2C5.7 13.6 8 14.2 10.2 13C12.5 11.8 14.2 9.2 13.8 6.2C13.4 3.2 11.2 1.9 8 1.5Z"
        stroke="currentColor" strokeWidth="0.7" />
    </svg>
  );
}

export function PedshedIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="0.9" strokeDasharray="2.5 1.5" />
      <circle cx="8" cy="8" r="6.8" stroke="currentColor" strokeWidth="0.7" strokeDasharray="2.5 1.5" />
    </svg>
  );
}
