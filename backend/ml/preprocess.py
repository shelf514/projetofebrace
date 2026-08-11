"""Carregamento e limpeza de datasets para o pipeline de ML."""

from pathlib import Path

import numpy as np
import pandas as pd

ALLOWED_EXTENSIONS = {".csv", ".xlsx", ".json"}

TARGET_ALIASES = ["status", "quality", "class", "label", "target", "target_y", "potable", "potability", "result", "value"]


def load_dataframe(path: str | Path) -> pd.DataFrame:
    path = Path(path)
    if path.suffix.lower() not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Extensao nao suportada: {path.suffix}. Use {sorted(ALLOWED_EXTENSIONS)}")
    if path.suffix.lower() == ".csv":
        return pd.read_csv(path)
    if path.suffix.lower() == ".xlsx":
        return pd.read_excel(path)
    return pd.read_json(path)


def infer_target(df: pd.DataFrame) -> str:
    for alias in TARGET_ALIASES:
        for col in df.columns:
            if col.strip().lower() == alias:
                return col
    raise ValueError(
        "Nenhuma variavel-alvo identificada. Informe --target ou use uma coluna "
        "chamada status/quality/class/label/target/value. NAO invente labels."
    )


def validate_and_clean(df: pd.DataFrame, target: str, features: list[str]) -> pd.DataFrame:
    missing = [f for f in features if f not in df.columns]
    if missing:
        raise ValueError(f"Features ausentes no dataset: {missing}")
    if target not in df.columns:
        raise ValueError(f"Variavel-alvo '{target}' ausente no dataset")

    df = df.copy()
    for col in features:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        if df[col].isna().any():
            raise ValueError(f"Coluna '{col}' contem valores nao numericos ou NaN")

    df = df[df[features].apply(np.isfinite).all(axis=1)].reset_index(drop=True)
    if len(df) < 50:
        raise ValueError(f"Dataset pequeno demais para treinamento: {len(df)} linhas")
    return df
