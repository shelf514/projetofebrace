# Metodologia científica — AquaSense AI

Este documento define os procedimentos para que os dados coletados possam ser
usados em pesquisa científica (FEBRACE) de forma íntegra e reproduzível.

## 1. Separação de dados

O sistema distingue explicitamente quatro categorias de dados:

| Categoria        | Origem                                | Uso permitido                     |
| ---------------- | ------------------------------------- | --------------------------------- |
| **Reais**        | ESP32 + sensores calibrados           | Pesquisa científica               |
| **Teste**        | Coletados durante desenvolvimento     | Validação do sistema              |
| **MOCK/demo**    | Gerados sinteticamente (`make_demo_dataset.py`, `seed_demo.py`) | Apenas testes de software — **nunca** apresentar como dados reais |
| **Resultados do modelo** | Saídas de inferência/treinamento | Comunicação com ressalvas (ver §5) |

- Dados MOCK são identificados no banco e no dashboard (`dataset_origin` =
  "MOCK/sintetico - apenas testes").
- O `data/raw/` e `data/processed/` devem conter somente dados reais, com
  metadados de coleta.

## 2. Coleta de dados reais

1. **Calibração prévia:** todos os sensores devem ser calibrados conforme
   `docs/hardware.md`, com padrões rastreáveis (soluções de formazina,
   condutividade, termômetro certificado). Registrar datas e valores.
2. **Protocolo de amostragem:** definir local, profundidade, horário,
   temperatura ambiente, condição climática e procedimento de coleta. Registrar
   em caderno/planilha (arquivo em `data/raw/`).
3. **Contaminação cruzada:** lavar as sondas com água deionizada e enxaguar
   com a própria amostra antes de cada medição.
4. **Repetições:** medir em triplicata quando possível; o firmware calcula
   média de `SAMPLE_COUNT` amostras por leitura.
5. **Registro de anomalias:** valores fora do esperado NÃO são descartados
   automaticamente; são marcados como anomalia pelo sistema para análise
   posterior (podem indicar evento real ou falha de sensor).

## 3. Origem e licença de datasets

- Todo dataset colocado em `backend/ml/datasets/` deve ter origem e licença
  registradas. Padrão mínimo:

  ```
  Dataset: <nome do arquivo>
  Origem: <instituição/coleta própria ou referência pública>
  Licença: <CC-BY, domínio público, uso próprio...>
  Coletado em: <datas>
  Variáveis: temperature, turbidity, tds, <target>
  Target: <como foi determinado (método laboratorial, critério técnico)>
  ```

- **Nunca inventar labels.** Se o dataset não tem variável-alvo, o sistema
  opera em modo de detecção de anomalias (Isolation Forest) — funcionalidade
  independente e já integrada.

## 4. Treinamento e avaliação

- `train_test_split` com `random_state=42` e estratificação (classificação).
- Métricas de classificação: accuracy, precision, recall, F1 (weighted) e
  matriz de confusão.
- Métricas de regressão: MAE, RMSE, R².
- **Overfitting:** sempre verificar o gap treino×teste (alerta > 0,15).
- O `metadata.json` registra versão, data, dataset, features, target, modelo,
  parâmetros e métricas — permitindo reprodução do experimento.

## 5. Limites de interpretação — IMPORTANTE

1. O modelo prevê **somente** a variável-alvo do dataset usado no
   treinamento. Não "determina potabilidade" por padrão.
2. Temperatura + turbidez + TDS **não são suficientes** para classificar
   potabilidade conforme a legislação brasileira (Portaria GM/MS nº 888/2021,
   que exige parâmetros microbiológicos, químicos, etc.).
3. Se um alvo como `status`/`potability` existir no dataset, ele deve vir de
   **análise laboratorial ou critério técnico documentado** — nunca gerado
   pelo sistema.
4. O dashboard exibe permanentemente: *"as previsões são saídas estatísticas
   do modelo e não constituem certificação sanitária"*.

## 6. Publicação

- Relatórios/artigos devem citar: datas de coleta, calibração, versão do
  modelo (`metadata.json`), dataset e código (commit) usados.
- Resultados de MOCK não podem aparecer em publicações.
- Se usar dados públicos, citar a fonte e a licença.
