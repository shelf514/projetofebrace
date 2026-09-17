import { Link } from 'react-router-dom';

const sensors = [
  { nome: 'Temperatura (DS18B20)', mede: 'Temperatura da água em °C', como: 'Sensor digital 1-Wire com calibração de fábrica (±0,5 °C); converte a temperatura em sinal digital (9–12 bits).', detalhe: '15–30 °C em águas naturais. Variação brusca pode indicar efluente.' },
  { nome: 'Turbidez (óptico)', mede: 'Partículas suspensas em NTU', como: 'LED + fotodiodo: menos luz = mais partículas (argila, areia).', detalhe: 'Até 5 NTU para água potável (Portaria 888/2021).' },
  { nome: 'TDS (condutividade)', mede: 'Sólidos dissolvidos em ppm', como: 'Hastes medem corrente entre si: mais sais = mais corrente.', detalhe: 'Até 1000 mg/L no Brasil. Alto pode indicar esgoto/salinização.' },
];

export function ComoFunciona() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-2xl font-extrabold tracking-tight text-transparent dark:from-white dark:to-slate-300">Como funciona</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Da água ao gráfico no celular — sem mistério.</p>
      </div>

      <div className="animate-stagger grid grid-cols-1 gap-3 md:grid-cols-3">
        {['SENSOR','ESP32 + FIRMWARE','BACKEND + IA'].map((stage, i) => (
          <div key={stage} className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="text-2xl font-black text-sky-600 dark:text-sky-400">{i+1}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{stage}</p>
            <p className="mt-1 text-xs text-slate-400">{['Medição física','Coleta e envio','Validação + IA'][i]}</p>
          </div>
        ))}
      </div>
      <p className="text-center text-xs font-bold tracking-widest text-slate-300 dark:text-slate-600">▼ FLUXO ▼</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {['Leitura','POST /api/readings','Análise','Dashboard'].map((s, i) => (
          <div key={s} className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-center dark:border-sky-800/50 dark:bg-sky-950/30">
            <p className="text-lg">{['💧','📡','🧠','📱'][i]}</p>
            <p className="mt-1 text-xs font-semibold text-sky-800 dark:text-sky-300">{s}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Sensores</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {sensors.map((s) => (
            <div key={s.nome} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-bold dark:text-slate-100">{s.nome}</h3>
              <p className="mt-1 text-xs font-medium text-sky-700 dark:text-sky-300">{s.mede}</p>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{s.como}</p>
              <p className="mt-2 text-[11px] text-slate-500">ℹ️ {s.detalhe}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">O caminho de cada leitura</h2>
        <ol className="space-y-3">
          {[
            ['1. Medir','ESP32 lê sensores a cada 60s e POSTa via HTTP.'],
            ['2. Validar','Backend descarta absurdos e guarda com timestamp.'],
            ['3. Anomalia','Isolation Forest compara com histórico do dispositivo.'],
            ['4. IA','Random Forest classifica e informa confiança.'],
            ['5. Tempo real','WS atualiza gráficos; fallback polling.'],
          ].map(([t, d]) => (
            <li key={t} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-sm font-bold dark:text-slate-100">{t}</h3><p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/30 dark:bg-amber-950/30">
        <h2 className="text-sm font-bold text-amber-800 dark:text-amber-300">Limitações</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800 dark:text-amber-300/90">
          <li>Previsões não certificam potabilidade — use laboratório.</li>
          <li>Sensores educacionais precisam calibração.</li>
          <li>Modelo só vale para águas similares ao treino.</li>
        </ul>
      </section>

      <p className="text-xs text-slate-500 dark:text-slate-400">Explore <Link to="/historico" className="font-semibold text-sky-600 underline dark:text-sky-400">histórico</Link> · <Link to="/dispositivo" className="font-semibold text-sky-600 underline dark:text-sky-400">dispositivo</Link> · <Link to="/ia" className="font-semibold text-sky-600 underline dark:text-sky-400">IA</Link></p>
    </div>
  );
}
