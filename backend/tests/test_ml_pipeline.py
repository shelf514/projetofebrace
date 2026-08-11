import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ml import evaluate, preprocess, train  # noqa: E402
from app.services.ml_service import MLService  # noqa: E402


@pytest.fixture()
def sample_df() -> pd.DataFrame:
    rng = np.random.default_rng(1)
    n = 120
    df = pd.DataFrame(
        {
            "temperature": 24.0 + rng.normal(0, 1.5, n),
            "turbidity": np.abs(12.0 + rng.normal(0, 3, n)),
            "tds": 260.0 + rng.normal(0, 25, n),
        }
    ).round(2)
    df["status"] = ["boa" if i % 3 else "ruim" for i in range(n)]
    return df


@pytest.fixture()
def csv_path(tmp_path, sample_df):
    path = tmp_path / "dataset_test.csv"
    sample_df.to_csv(path, index=False)
    return path


@pytest.fixture()
def json_path(tmp_path, sample_df):
    path = tmp_path / "dataset_test.json"
    sample_df.to_json(path, orient="records")
    return path


def test_load_dataframe_csv(csv_path):
    df = preprocess.load_dataframe(csv_path)
    assert len(df) == 120
    assert {"temperature", "turbidity", "tds", "status"}.issubset(df.columns)


def test_load_dataframe_json(json_path):
    df = preprocess.load_dataframe(json_path)
    assert len(df) == 120


def test_load_dataframe_invalid_extension(tmp_path):
    path = tmp_path / "data.txt"
    path.write_text("x")
    with pytest.raises(ValueError, match="nao suportada"):
        preprocess.load_dataframe(path)


def test_infer_target(sample_df):
    assert preprocess.infer_target(sample_df) == "status"


def test_infer_target_missing(tmp_path):
    df = pd.DataFrame({"temperature": [1.0], "turbidity": [2.0], "tds": [3.0]})
    path = tmp_path / "no_target.csv"
    df.to_csv(path, index=False)
    with pytest.raises(ValueError, match="variavel-alvo"):
        preprocess.infer_target(df)


def test_validate_and_clean_ok(sample_df):
    cleaned = preprocess.validate_and_clean(sample_df, "status", ["temperature", "turbidity", "tds"])
    assert len(cleaned) == 120


def test_validate_and_clean_missing_feature(sample_df):
    with pytest.raises(ValueError, match="ausentes"):
        preprocess.validate_and_clean(sample_df, "status", ["temperature", "ph"])


def test_validate_and_clean_nan_rejected():
    df = pd.DataFrame(
        {
            "temperature": [25.0, np.nan],
            "turbidity": [10.0, 12.0],
            "tds": [200.0, 210.0],
            "status": ["boa", "boa"],
        }
    )
    with pytest.raises(ValueError, match="NaN"):
        preprocess.validate_and_clean(df, "status", ["temperature", "turbidity", "tds"])


def test_validate_and_clean_too_small():
    df = pd.DataFrame(
        {
            "temperature": [25.0] * 5,
            "turbidity": [10.0] * 5,
            "tds": [200.0] * 5,
            "status": ["boa"] * 5,
        }
    )
    with pytest.raises(ValueError, match="pequeno"):
        preprocess.validate_and_clean(df, "status", ["temperature", "turbidity", "tds"])


def test_evaluate_classifier(sample_df):
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import LabelEncoder

    encoder = LabelEncoder()
    y = encoder.fit_transform(sample_df["status"])
    x_train, x_test, y_train, y_test = train_test_split(
        sample_df[["temperature", "turbidity", "tds"]], y, test_size=0.2, random_state=42
    )
    model = RandomForestClassifier(n_estimators=10, random_state=42)
    model.fit(x_train, y_train)
    metrics = evaluate.evaluate_classifier(model, x_test, y_test)
    assert set(metrics) == {"accuracy", "precision", "recall", "f1_score", "confusion_matrix"}
    assert "labels" in metrics["confusion_matrix"]
    assert isinstance(metrics["confusion_matrix"]["matrix"], list)


def test_evaluate_regressor(sample_df):
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.model_selection import train_test_split

    y = sample_df["tds"].copy()
    x_train, x_test, y_train, y_test = train_test_split(
        sample_df[["temperature", "turbidity"]], y, test_size=0.2, random_state=42
    )
    model = RandomForestRegressor(n_estimators=10, random_state=42)
    model.fit(x_train, y_train)
    metrics = evaluate.evaluate_regressor(model, x_test, y_test)
    assert set(metrics) == {"mae", "rmse", "r2"}


def test_check_overfitting_no_warning():
    import numpy as np
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import LabelEncoder

    rng = np.random.default_rng(0)
    n = 200
    df = pd.DataFrame(
        {
            "temperature": 24.0 + rng.normal(0, 1, n),
            "turbidity": 12.0 + rng.normal(0, 1, n),
            "tds": 260.0 + rng.normal(0, 10, n),
            "status": ["boa" if i % 2 else "ruim" for i in range(n)],
        }
    )
    encoder = LabelEncoder()
    y = encoder.fit_transform(df["status"])
    x_train, x_test, y_train, y_test = train_test_split(
        df[["temperature", "turbidity", "tds"]], y, test_size=0.2, random_state=42
    )
    model = RandomForestClassifier(n_estimators=10, max_depth=3, random_state=42)
    model.fit(x_train, y_train)
    result = evaluate.check_overfitting(model, x_train, y_train, x_test, y_test, is_classifier=True)
    assert {"train_score", "test_score", "overfit_gap", "warning"} == set(result)


def test_feature_importance():
    class FakeModel:
        feature_importances_ = np.array([0.7, 0.2, 0.1])
        feature_names_in_ = np.array(["temperature", "turbidity", "tds"])

    result = evaluate.feature_importance(FakeModel())
    assert result == [
        {"feature": "temperature", "importance": 0.7},
        {"feature": "turbidity", "importance": 0.2},
        {"feature": "tds", "importance": 0.1},
    ]


def test_feature_importance_falls_back_to_names_without_feature_names_in():
    class FakeModel:
        feature_importances_ = np.array([0.5, 0.3, 0.2])

    result = evaluate.feature_importance(FakeModel(), ["temperature", "turbidity", "tds"])
    assert result[0]["feature"] == "temperature"
    assert result[-1]["feature"] == "tds"


def test_train_pipeline_classification(csv_path, tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(train, "OUTPUTS_DIR", tmp_path)
    result = train.run(str(csv_path), target="status", test_size=0.3)
    assert result["task"] == "classification"
    assert result["model"] == "RandomForestClassifier"
    assert result["dataset"] == "dataset_test.csv"
    assert "accuracy" in result["metrics"]
    assert (tmp_path / "model.pkl").exists()
    assert (tmp_path / "metadata.json").exists()
    metadata = json.loads((tmp_path / "metadata.json").read_text(encoding="utf-8"))
    assert metadata["features"] == ["temperature", "turbidity", "tds"]
    assert metadata["target"] == "status"
    assert "trained_at" in metadata


def test_ml_service_predict_returns_label(tmp_path, csv_path, monkeypatch):
    monkeypatch.setattr(train, "OUTPUTS_DIR", tmp_path)
    train.run(str(csv_path), target="status", test_size=0.3)
    model = joblib.load(str(tmp_path / "model.pkl"))
    metadata_path = tmp_path / "metadata.json"

    service = MLService.__new__(MLService)
    service.metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    service.model = model
    service.scaler = None

    prediction, probability = service.predict(25.0, 10.0, 200.0)
    assert prediction in {"boa", "ruim"}
    assert 0.0 <= probability <= 1.0


def test_ml_service_predict_without_model():
    service = MLService.__new__(MLService)
    service.model = None
    service.scaler = None
    service.metadata = None
    prediction, probability = service.predict(25.0, 10.0, 200.0)
    assert prediction is None
    assert probability is None


def test_ml_service_predict_regression_applies_scaler(tmp_path, monkeypatch):
    """Modelo de regressao e treinado com dados escalados: predict() deve escalar."""
    rng = np.random.default_rng(3)
    n = 150
    df = pd.DataFrame(
        {
            "temperature": 24.0 + rng.normal(0, 2, n),
            "turbidity": np.abs(12.0 + rng.normal(0, 4, n)),
            "tds": 260.0 + rng.normal(0, 30, n),
        }
    ).round(2)
    df["value"] = (df["tds"] * 0.7 + rng.normal(0, 5, n)).round(2)
    path = tmp_path / "regression_test.csv"
    df.to_csv(path, index=False)

    monkeypatch.setattr(train, "OUTPUTS_DIR", tmp_path)
    result = train.run(str(path), target="value", test_size=0.3)
    assert result["task"] == "regression"
    assert (tmp_path / "scaler.pkl").exists()

    scaler = joblib.load(str(tmp_path / "scaler.pkl"))
    model = joblib.load(str(tmp_path / "model.pkl"))

    service = MLService.__new__(MLService)
    service.metadata = json.loads((tmp_path / "metadata.json").read_text(encoding="utf-8"))
    service.model = model
    service.scaler = scaler

    prediction, probability = service.predict(25.0, 10.0, 200.0)
    direct = model.predict(scaler.transform(np.asarray([[25.0, 10.0, 200.0]], dtype=float)))[0]
    assert prediction is not None
    assert probability is None
    assert float(prediction) == pytest.approx(float(direct), rel=1e-9)
