"""Binary classification metrics with explicit one-class handling."""
import numpy as np
from sklearn.metrics import (accuracy_score, average_precision_score, brier_score_loss,
    confusion_matrix, f1_score, log_loss, precision_score, recall_score, roc_auc_score)


def evaluate(y_true, probability):
    truth = np.asarray(y_true, dtype=int)
    prob = np.asarray(probability, dtype=float)
    if len(truth) == 0 or len(truth) != len(prob) or not np.isfinite(prob).all() or ((prob < 0) | (prob > 1)).any():
        raise ValueError('invalid truth or probability arrays')
    predicted = (prob >= .5).astype(int)
    both = len(np.unique(truth)) == 2
    return dict(accuracy=float(accuracy_score(truth, predicted)),
        precision=float(precision_score(truth, predicted, zero_division=0)),
        recall=float(recall_score(truth, predicted, zero_division=0)),
        f1=float(f1_score(truth, predicted, zero_division=0)),
        roc_auc=float(roc_auc_score(truth, prob)) if both else None,
        pr_auc=float(average_precision_score(truth, prob)) if both else None,
        log_loss=float(log_loss(truth, np.clip(prob, 1e-7, 1 - 1e-7), labels=[0, 1])),
        brier=float(brier_score_loss(truth, prob)),
        positive_rate=float(predicted.mean()),
        confusion=confusion_matrix(truth, predicted, labels=[0, 1]).tolist())
