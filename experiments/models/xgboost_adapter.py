"""Task-specific gradient-boosted tree baseline."""
import numpy as np
from xgboost import XGBClassifier

class XGBoostAdapter:
    name = 'XGBoost'
    def __init__(self, seed: int):
        self.model = XGBClassifier(n_estimators=100, max_depth=3, learning_rate=.06,
            subsample=1, colsample_bytree=1, random_state=seed, n_jobs=1,
            eval_metric='logloss')

    def fit(self, x: np.ndarray, y: np.ndarray):
        self.model.fit(x, y)
        return self

    def predict_proba(self, x: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(x)[:, 1]
