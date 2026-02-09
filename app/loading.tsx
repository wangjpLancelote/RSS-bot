export default function Loading() {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/20 border-t-accent" />
        <p className="text-sm text-gray-600">加载中...</p>
      </div>
    </div>
  );
}

