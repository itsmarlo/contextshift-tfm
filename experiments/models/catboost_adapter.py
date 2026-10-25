"""Task-specific CatBoost baseline on the shared numeric feature matrix."""
import numpy as np


class CatBoostAdapter:
    name = 'CatBoost'

    def __init__(self, seed: int):
        from catboost import CatBoostClassifier
        # CatBoost Python API: https://catboost.ai/docs/en/concepts/python-reference_catboostclassifier
        self.model = CatBoostClassifier(iterations=100, depth=3, learning_rate=.06,
            loss_function='Logloss', random_seed=seed, thread_count=1,
            verbose=False, allow_writing_files=False)

    def fit(self, x: np.ndarray, y: np.ndarray):
        self.model.fit(x, y)
        return self

    def predict_proba(self, x: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(x)[:, 1]
