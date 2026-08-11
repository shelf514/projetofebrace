"""Pipeline de treinamento do modelo de ML do AquaSense AI.

Uso:
    python -m ml.train --dataset ml/datasets/demo_mock.csv --target status

Salva em ml/outputs/: model.pkl, metadata.json e (se necessario) scaler.pkl.
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml import evaluate, preprocess  # noqa: E402

FEATURES = ["temperature", "turbidity", "tds"]
OUTPUTS_DIR = Path(__file__).resolve().parent / "outputs"


def _detect_task(y) -> tuple[str, object]:
    unique = set(y)
    if all(isinstance(v, str) for v in unique):
        return "classification", LabelEncoder()
    try:
        if max(unique) - min(unique) <= 20 and len(unique) <= 20:
            return "classification", None
    except TypeError:
        return "classification", None
    return "regression", None


def run(dataset_path: str, target: str | None = None, test_size: float = 0.2) -> dict:
    df = preprocess.load_dataframe(dataset_path)
    resolved_target = target or preprocess.infer_target(df)
    df = preprocess.validate_and_clean(df, resolved_target, FEATURES)

    x = df[FEATURES]
    y = df[resolved_target]

    task, encoder = _detect_task(y)
    if encoder is not None:
        y_encoded = encoder.fit_transform(y)
    else:
        y_encoded = y

    x_train, x_test, y_train, y_test = train_test_split(
        x, y_encoded, test_size=test_size, random_state=42, stratify=(y_encoded if task == "classification" else None)
    )

    scaler = None
    if task == "classification":
        model = RandomForestClassifier(n_estimators=200, random_state=42, class_weight="balanced")
    else:
        model = RandomForestRegressor(n_estimators=200, random_state=42)
        scaler = StandardScaler()
        x_train = scaler.fit_transform(x_train)
        x_test = scaler.transform(x_test)

    model.fit(x_train, y_train)

    if task == "classification":
        metrics = evaluate.evaluate_classifier(model, x_test, y_test)
        overfit = evaluate.check_overfitting(model, x_train, y_train, x_test, y_test, is_classifier=True)
        classes = encoder.classes_ if encoder is not None else model.classes_
        labels = [str(c) for c in classes]
    else:
        metrics = evaluate.evaluate_regressor(model, x_test, y_test)
        overfit = evaluate.check_overfitting(model, x_train, y_train, x_test, y_test, is_classifier=False)
        labels = None

    importance = evaluate.feature_importance(model, FEATURES)

    OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, OUTPUTS_DIR / "model.pkl")
    if scaler is not None:
        joblib.dump(scaler, OUTPUTS_DIR / "scaler.pkl")
    else:
        (OUTPUTS_DIR / "scaler.pkl").unlink(missing_ok=True)

    metadata = {
        "version": "1.0.0",
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset": Path(dataset_path).name,
        "dataset_origin": "MOCK/sintetico - apenas testes" if "mock" in Path(dataset_path).name.lower() else "a registrar em docs/methodology.md",
        "features": FEATURES,
        "target": resolved_target,
        "task": task,
        "model": model.__class__.__name__,
        "model_params": model.get_params(deep=False),
        "n_samples": len(df),
        "labels": labels,
        "metrics": metrics,
        "overfitting": overfit,
        "feature_importance": importance,
    }
    with open(OUTPUTS_DIR / "metadata.json", "w", encoding="utf-8") as fh:
        json.dump(metadata, fh, indent=2, ensure_ascii=False)

    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(description="Treina o modelo de ML do AquaSense AI")
    parser.add_argument("--dataset", required=True, help="Caminho do dataset em ml/datasets/")
    parser.add_argument("--target", default=None, help="Nome da variavel-alvo (auto se omitido)")
    parser.add_argument("--test-size", type=float, default=0.2)
    args = parser.parse_args()

    result = run(args.dataset, args.target, args.test_size)
    print(json.dumps({k: result[k] for k in ["dataset", "task", "model", "metrics", "overfitting"]}, indent=2, ensure_ascii=False))
    print(f"Modelo salvo em: {OUTPUTS_DIR}")


if __name__ == "__main__":
    main()
