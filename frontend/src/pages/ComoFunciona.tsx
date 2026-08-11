import { Link } from 'react-router-dom';

const sensors = [
  {
    nome: 'Temperatura (DS18B20)',
    mede: 'Temperatura da água em °C',
    como: 'Sensor digital de precisão. Um cristal de quartzo ressoa em frequências que variam com a temperatura; o ESP32 lê essa frequência e converte em graus.',
    detalhe: 'Influencia a condutividade elétrica (e por isso a medição de TDS) e a velocidade de reações químicas. Variações bruscas podem indicar descarga de água quente (ex.: efluente industrial).',
  },
  {
    nome: 'Turbidez (sensor óptico)',
    mede: 'Quantidade de partículas suspensas em NTU',
    como: 'Um LED acende de um lado da amostra e um fotodiodo mede a luz do outro. Quanto mais partículas (argila, areia, micro-organismos), menos luz atravessa — e maior a turbidez.',
    detalhe: 'Padrão brasileiro (Portaria GM/MS 888/2021): água potável deve ter até 5 NTU. Acima disso, a água pode estar turva e abrigar patógenos que a desinfecção não alcança.',
  },
  {
    nome: 'TDS (sonda de condutividade)',
    mede: 'Sólidos dissolvidos totais em ppm (mg/L)',
    como: 'Duas hastes metálicas imersas na água medem a corrente que passa entre elas. Sais dissolvidos conduzem eletricidade: mais corrente = mais sólidos dissolvidos.',
    detalhe: 'Padrão brasileiro: até 1000 mg/L. Água de poço costuma ter TDS mais alto que água tratada. Valores muito altos podem indicar contaminação por esgoto ou salinização.',
  },
];

const steps = [
  {
    titulo: '1. Medir',
    texto: 'O ESP32 lê os três sensores a cada intervalo configurado e envia os dados ao servidor via HTTP (POST /api/readings) ou, no modo calibração, apenas exibe os valores no Monitor Serial.',
  },
  {
    titulo: '2. Validar e salvar',
    texto: 'O backend descarta valores fisicamente impossíveis (ex.: temperatura negativa absurda) e guarda cada leitura com data/hora, dispositivo e resultado das análises.',
  },
  {
    titulo: '3. Detectar anomalias',
    texto: 'Um algoritmo Isolation Forest compara cada leitura com o histórico recente do dispositivo. Leituras isoladas demais das anteriores são marcadas como possíveis anomalias (eventos reais ou falha de sensor).',
  },
  {
    titulo: '4. Prever com IA',
    texto: 'Um modelo de machine learning (Random Forest, treinado com dados coletados) classifica o estado da água em uma das classes do dataset de treinamento e informa o nível de confiança da previsão.',
  },
  {
    titulo: '5. Exibir em tempo real',
    texto: 'O dashboard recebe cada nova leitura na hora por WebSocket e atualiza gráficos, alertas e previsões. Quando a conexão de tempo real cai, o sistema volta automaticamente para atualização periódica (polling).',
  },
];

const limitations = [
  'As previsões são estatísticas baseadas no dataset de treinamento — não substituem análises laboratoriais nem certificam potabilidade.',
  'Os sensores de turbidez e TDS usados são módulos educacionais: precisam de calibração periódica e têm precisão menor que equipamentos profissionais.',
  'O modelo só é confiável para águas semelhantes às do treinamento (mesma faixa de temperatura, turbidez e TDS).',
  'Este projeto é didático: serve para aprender a monitorar qualidade de água, não para controle de qualidade sanitário oficial.',
];

export function ComoFunciona() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Como o AquaSense funciona</h1>
        <p className="mt-1 text-sm text-slate-500">
          Da captação da água ao gráfico no seu celular: o caminho de cada leitura, sem mistério.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {['SENSOR', 'ESP32 + FIRMWARE', 'BACKEND + IA'].map((stage, i) => (
          <div key={stage} className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-3xl font-black text-sky-600">{i + 1}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-slate-500">{stage}</p>
            <p className="mt-1 text-xs text-slate-400">{['Medição física da água', 'Coleta, envio e retry', 'Validação, anomalia, previsão e API'][i]}</p>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-slate-400">▼ FLUXO ▼</p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {['Leitura analógica/digital', 'POST /api/readings', 'Análise + gravação', 'Dashboard / APK'].map((stage, i) => (
          <div key={stage} className="rounded-xl border border-sky-200 bg-sky-50 p-4 text-center shadow-sm">
            <p className="text-lg">{['💧', '📡', '🧠', '📱'][i]}</p>
            <p className="mt-1 text-xs font-semibold text-sky-800">{stage}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600">Os sensores</h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {sensors.map((s) => (
            <div key={s.nome} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800">{s.nome}</h3>
              <p className="mt-1 text-xs font-medium text-sky-700">{s.mede}</p>
              <p className="mt-2 text-xs text-slate-600">{s.como}</p>
              <p className="mt-2 text-[11px] text-slate-500">ℹ️ {s.detalhe}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-600">O caminho de cada leitura</h2>
        <ol className="space-y-3">
          {steps.map((step) => (
            <li key={step.titulo} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800">{step.titulo}</h3>
              <p className="mt-1 text-xs text-slate-600">{step.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h2 className="text-sm font-bold text-amber-800">Limitações (leia antes de usar)</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-800">
          {limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <p className="text-xs text-slate-500">
        Quer ver os dados de perto? Visite o <Link to="/historico" className="font-semibold text-sky-700 underline">histórico</Link>, o{' '}
        <Link to="/dispositivo" className="font-semibold text-sky-700 underline">painel do dispositivo</Link> ou a página de{' '}
        <Link to="/ia" className="font-semibold text-sky-700 underline">IA</Link>.
      </p>
    </div>
  );
}
