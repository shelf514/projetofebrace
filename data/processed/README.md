# data/

Pasta para dados do projeto (não versionada — ver `.gitignore`).

## raw/

Dados brutos coletados pelos sensores (exportações do backend ou planilhas
de campo). Cada arquivo deve ter um README descrevendo origem, datas,
condições de coleta e calibração. **Nunca colocar dados MOCK aqui.**

## processed/

Dados limpos e prontos para análise/treinamento, com a pipeline de
processamento descrita em `docs/methodology.md`.
