export function LoadingState({ message = 'Carregando...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
      {message}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      <p className="font-semibold">Erro de conexão</p>
      <p className="mt-1">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}
