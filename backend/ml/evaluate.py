"""Avaliacao de modelos de ML para classificacao e regressao."""

import json
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    recall_score,
    r2_score,
)


def evaluate_classifier(model, x_test, y_test) -> dict:
    y_pred = model.predict(x_test)
    metrics = {
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred, average="weighted", zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, y_pred, average="weighted", zero_division=0)), 4),
        "f1_score": round(float(f1_score(y_test, y_pred, average="weighted", zero_division=0)), 4),
    }
    cm = confusion_matrix(y_test, y_pred, labels=list(model.classes_))
    metrics["confusion_matrix"] = {
        "labels": [str(c) for c in model.classes_],
        "matrix": cm.tolist(),
    }
    return metrics


def evaluate_regressor(model, x_test, y_test) -> dict:
    y_pred = model.predict(x_test)
    return {
        "mae": round(float(mean_absolute_error(y_test, y_pred)), 4),
        "rmse": round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 4),
        "r2": round(float(r2_score(y_test, y_pred)), 4),
    }


def check_overfitting(model, x_train, y_train, x_test, y_test, is_classifier: bool) -> dict:
    if is_classifier:
        train_score = float(accuracy_score(y_train, model.predict(x_train)))
        test_score = float(accuracy_score(y_test, model.predict(x_test)))
    else:
        train_score = float(r2_score(y_train, model.predict(x_train)))
        test_score = float(r2_score(y_test, model.predict(x_test)))
    gap = round(train_score - test_score, 4)
    return {
        "train_score": round(train_score, 4),
        "test_score": round(test_score, 4),
        "overfit_gap": gap,
        "warning": gap > 0.15,
    }


def feature_importance(model, feature_names: list[str] | None = None) -> list[dict] | None:
    if not hasattr(model, "feature_importances_"):
        return None
    names = getattr(model, "feature_names_in_", None)
    if names is None:
        names = feature_names or []
    return [
        {"feature": name, "importance": round(float(v), 4)}
        for name, v in sorted(
            zip(names, model.feature_importances_),
            key=lambda pair: pair[1],
            reverse=True,
        )
    ]
