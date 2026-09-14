export function LoadingState({ message = 'Carregando...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-500 border-t-transparent dark:border-sky-400" />
      <span className="animate-pulse">{message}</span>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-3 h-7 w-20 rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-2 h-3 w-32 rounded bg-slate-100 dark:bg-slate-800/60" />
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/40 dark:text-red-300">
      <p className="font-semibold">Erro de conexão</p>
      <p className="mt-1 text-red-600 dark:text-red-400">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-xl bg-red-600 px-4 py-1.5 text-xs font-semibold text-white shadow-md transition-all hover:bg-red-700 hover:shadow-lg active:scale-[0.98]"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
