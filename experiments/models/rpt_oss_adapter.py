"""Optional research-only SAP RPT OSS inference on the shared experiment matrix."""
import numpy as np
import pandas as pd

from ..generate_dataset import FEATURES


class RPTOssAdapter:
    name = 'SAP-RPT-OSS'
    checkpoint = '2025-11-04_sap-rpt-one-oss.pt'
    version = f'{checkpoint} · context 2048 · bagging 1'

    def __init__(self, seed: int):
        try:
            import torch
            from sap_rpt_oss import SAP_RPT_OSS_Classifier
        except ImportError as error:
            raise RuntimeError(
                'SAP-RPT-OSS is optional. Install SAP-samples/sap-rpt-1-oss, '
                'accept the checkpoint conditions on Hugging Face, and use suitable hardware.'
            ) from error
        torch.manual_seed(seed)
        self.device_description = (
            f'GPU {torch.cuda.get_device_name()}' if torch.cuda.is_available() else 'CPU'
        )
        self.model = SAP_RPT_OSS_Classifier(
            checkpoint=self.checkpoint, max_context_size=2048, bagging=1
        )

    def fit(self, x: np.ndarray, y: np.ndarray):
        self.model.fit(pd.DataFrame(x, columns=FEATURES), pd.Series(y, name='claim'))
        return self

    def predict_proba(self, x: np.ndarray) -> np.ndarray:
        probabilities = np.asarray(self.model.predict_proba(pd.DataFrame(x, columns=FEATURES)))
        positive = np.flatnonzero(np.asarray(self.model.classes_) == 1)
        if probabilities.ndim != 2 or len(positive) != 1:
            raise ValueError('SAP-RPT-OSS did not return binary class probabilities')
        return probabilities[:, positive[0]]
