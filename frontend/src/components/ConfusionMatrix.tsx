import type { ConfusionMatrix } from '../types';

export function ConfusionMatrixView({ cm }: { cm: ConfusionMatrix }) {
  const max = Math.max(...cm.matrix.flat().map(Number), 1);
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-sm">
        <thead>
          <tr>
            <th className="p-1" />
            {cm.labels.map((label) => (
              <th key={label} className="px-2 py-1 text-xs font-semibold text-slate-500">
                Previsto: {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cm.matrix.map((row, i) => (
            <tr key={cm.labels[i]}>
              <th className="px-2 py-1 text-xs font-semibold text-slate-500">Real: {cm.labels[i]}</th>
              {row.map((cell, j) => (
                <td
                  key={`${i}-${j}`}
                  className="border border-slate-200 px-3 py-2 text-center font-semibold"
                  style={{
                    backgroundColor: `rgba(2, 132, 199, ${0.08 + (Number(cell) / max) * 0.75})`,
                    color: Number(cell) / max > 0.6 ? '#fff' : '#0f172a',
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
