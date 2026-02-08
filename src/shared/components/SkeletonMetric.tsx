export function SkeletonMetric(): React.ReactElement {
  return (
    <div className="border border-neutral-200 p-3 text-center">
      <div className="h-6 w-14 bg-neutral-100 mx-auto animate-pulse" />
      <div className="h-3 w-16 bg-neutral-50 mx-auto mt-2 animate-pulse" />
    </div>
  );
}
