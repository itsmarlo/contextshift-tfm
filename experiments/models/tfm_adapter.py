"""Local pretrained TabPFN adapter; never falls back to a simulated model."""
import numpy as np

class TabPFNAdapter:
    name = 'TabPFN'
    def __init__(self, seed: int):
        from tabpfn import TabPFNClassifier
        self.model = TabPFNClassifier(device='cpu', random_state=seed)

    def fit(self, x: np.ndarray, y: np.ndarray):
        self.model.fit(x, y)
        return self

    def predict_proba(self, x: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(x)[:, 1]
