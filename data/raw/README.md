# data/

Pasta para dados do projeto (não versionada — ver `.gitignore`).

## raw/

Dados brutos coletados pelos sensores (exportações do backend ou planilhas
de campo). Cada arquivo deve ter um README descrevendo origem, datas,
condições de coleta e calibração. **Nunca colocar dados MOCK aqui.**

Exceção versionada: `calibration_log.csv` (template em `docs/calibracao.md` §3)
— copie o template para cá ao calibrar (`data/raw/` é ignorado no git, então
anexe a planilha preenchida ao relatório/pôster da feira).

## processed/

Dados limpos e prontos para análise/treinamento, com a pipeline de
processamento descrita em `docs/methodology.md`.
