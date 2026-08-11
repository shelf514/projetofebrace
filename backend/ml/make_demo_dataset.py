"""Gera um dataset SINTETICO (MOCK) para testar o pipeline de ML.

AVISO: dados gerados artificialmente, apenas para desenvolvimento e testes.
NAO use em publicacoes cientificas.
"""

import argparse
from pathlib import Path

import numpy as np
import pandas as pd

rng = np.random.default_rng(42)


def make_classification_target(row: pd.Series) -> str:
    score = 0.0
    score += max(0.0, (25.0 - abs(row["temperature"] - 25.0)) / 25.0)
    score += max(0.0, (300.0 - row["turbidity"]) / 300.0)
    score += max(0.0, (500.0 - row["tds"]) / 500.0)
    score += rng.normal(0, 0.12)
    if score > 1.7:
        return "boa"
    if score > 1.2:
        return "regular"
    return "ruim"


def generate(n_rows: int = 1200) -> pd.DataFrame:
    t = np.linspace(0, 6.28 * 12, n_rows)
    temperature = 24.0 + 2.5 * np.sin(t / 8) + rng.normal(0, 0.6, n_rows)
    turbidity = np.abs(12.0 + 6.0 * np.sin(t / 5) + rng.normal(0, 4, n_rows))
    tds = 260.0 + 40.0 * np.sin(t / 3.5) + rng.normal(0, 30, n_rows)

    outlier = rng.random(n_rows) < 0.02
    turbidity = np.where(outlier, turbidity + rng.uniform(400, 900, n_rows), turbidity)
    tds = np.where(outlier, tds + rng.uniform(900, 2000, n_rows), tds)

    df = pd.DataFrame(
        {"temperature": temperature, "turbidity": turbidity, "tds": tds}
    ).round(2)
    df["status"] = df.apply(make_classification_target, axis=1)
    return df


def main() -> None:
    parser = argparse.ArgumentParser(description="Gera dataset sintetico MOCK")
    parser.add_argument("--rows", type=int, default=1200)
    parser.add_argument("--out", type=str, default=None)
    args = parser.parse_args()

    df = generate(args.rows)
    out = Path(args.out) if args.out else Path(__file__).parent / "datasets" / "demo_mock.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out, index=False)
    print(f"MOCK dataset gerado: {out} ({len(df)} linhas)")
    print("ATENCAO: dados sinteticos, apenas para testes.")


if __name__ == "__main__":
    main()
