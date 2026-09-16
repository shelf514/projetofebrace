import type { ConfusionMatrix } from '../types';
import { useTheme } from './ThemeProvider';

export function ConfusionMatrixView({ cm }: { cm: ConfusionMatrix }) {
  const max = Math.max(...cm.matrix.flat().map(Number), 1);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <caption className="sr-only">Matriz de confusão do modelo (linhas: classe real, colunas: classe prevista)</caption>
        <thead>
          <tr>
            <th scope="col" className="p-1"><span className="sr-only">Real / Previsto</span></th>
            {cm.labels.map((label) => (
              <th key={label} scope="col" className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
                Previsto: {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cm.matrix.map((row, i) => (
            <tr key={cm.labels[i]}>
              <th scope="row" className="px-2 py-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Real: {cm.labels[i]}</th>
              {row.map((cell, j) => {
                const intensity = Number(cell) / max;
                const bg = isDark
                  ? `rgba(56, 189, 248, ${0.1 + intensity * 0.75})`
                  : `rgba(2, 132, 199, ${0.08 + intensity * 0.75})`;
                const color = intensity > 0.55 ? (isDark ? '#0b1220' : '#fff') : isDark ? '#e2e8f0' : '#0f172a';
                return (
                  <td
                    key={`${i}-${j}`}
                    className="border border-slate-200 px-3 py-2 text-center font-semibold dark:border-slate-700"
                    style={{ backgroundColor: bg, color }}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
