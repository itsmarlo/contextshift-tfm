"""Run actual offline TabPFN, XGBoost, and CatBoost experiments, then export static JSON."""
import argparse
import json
from datetime import datetime, timezone
from importlib.metadata import version
from pathlib import Path
import platform
from time import perf_counter
import numpy as np
import pandas as pd
from .evaluate import evaluate
from .export_results import export
from .generate_dataset import DATASET_VERSION, FEATURES, make_dataset
from .interventions import corrupt_context, drift_context, nested_context, stratified_context
from .models.tfm_adapter import TabPFNAdapter
from .models.xgboost_adapter import XGBoostAdapter
from .models.catboost_adapter import CatBoostAdapter

ROOT = Path(__file__).resolve().parents[1]


def configurations(mode: str):
    if mode == 'quick':
        return [('size', x) for x in [10, 100]] + [(name, level) for name, levels in [('missing', [0, 20]), ('labels', [0, 20]), ('noise', [0, 20]), ('outliers', [0, 20]), ('relevance', [50, 75]), ('imbalance', [20, 10]), ('drift', [0, 100])] for level in levels]
    return [('size', x) for x in [10, 25, 50, 100, 250, 500, 1000]] + [
        (kind, level) for kind in ['missing', 'labels', 'noise', 'outliers'] for level in [0, 5, 10, 20, 30, 40]] + [
        ('relevance', level) for level in [0, 25, 50, 75, 100]] + [
        ('imbalance', level) for level in [5, 10, 20, 35, 50]] + [
        ('drift', level) for level in [0, 50, 100]]


def context_for(data, kind: str, level: int, seed: int, size: int = 100):
    if kind == 'size':
        return nested_context(data.pool, level, seed), data.test
    if kind in ['missing', 'labels', 'noise', 'outliers']:
        clean = nested_context(data.pool, size, seed)
        return corrupt_context(clean, kind, level / 100, seed + 900), data.test
    if kind == 'relevance':
        return stratified_context(data.pool, size, level / 100, 'population', seed), data.test[data.test.population == 1].reset_index(drop=True)
    if kind == 'imbalance':
        return stratified_context(data.pool, size, level / 100, 'label', seed), data.test
    if kind == 'drift':
        return drift_context(data.pool, data.recent_pool, size, level / 100, seed), data.recent_test
    raise ValueError(f'unknown experiment type: {kind}')


ADAPTERS = {'TabPFN': TabPFNAdapter, 'XGBoost': XGBoostAdapter, 'CatBoost': CatBoostAdapter}


def run(mode: str, models: list[str], output: Path, append: bool = False):
    data = make_dataset()
    results = []
    seeds = [7] if mode == 'quick' else [7, 17, 27]
    for seed in seeds:
        for kind, level in configurations(mode):
            context, test = context_for(data, kind, level, seed)
            if context.label.nunique() < 2:
                print(f'Skip {kind}/{level}/seed {seed}: context contains one class')
                continue
            x_train = context[FEATURES].to_numpy(dtype=np.float32)
            x_test = test[FEATURES].to_numpy(dtype=np.float32)
            truth = test.label.to_numpy(dtype=int)
            for name in models:
                adapter = ADAPTERS[name](seed)
                started = perf_counter()
                adapter.fit(x_train, context.label.to_numpy(dtype=int))
                fit_seconds = perf_counter() - started
                started = perf_counter()
                probability = adapter.predict_proba(x_test)
                predict_seconds = perf_counter() - started
                calibration = []
                for bin_index in range(5):
                    mask = np.minimum(4, (probability * 5).astype(int)) == bin_index
                    if mask.any():
                        calibration.append({'confidence': float(probability[mask].mean()), 'observed': float(truth[mask].mean()), 'count': int(mask.sum())})
                context_preview = context[FEATURES + ['label']].head(10).where(pd.notna(context), None).to_dict(orient='records')
                # Pandas may retain numpy scalars; normalize through a small conversion.
                context_preview = [{key: (None if pd.isna(value) else float(value)) for key, value in row.items()} for row in context_preview]
                results.append(dict(experiment_id=f'{kind}-{level}-{seed}-{name.lower()}', experiment_type=kind,
                    dataset_version=DATASET_VERSION, model_name=name,
                    model_version=version({'TabPFN': 'tabpfn', 'XGBoost': 'xgboost', 'CatBoost': 'catboost'}[name]), seed=seed,
                    context_size=len(context), configuration={'level': level, 'context_size': len(context)},
                    metrics=evaluate(truth, probability),
                    predictions=[{'id': int(i), 'truth': int(y), 'probability': float(p), 'predicted': int(p >= .5)}
                                 for i, y, p in zip(range(1, len(test) + 1), truth, probability)][:10],
                    calibration=calibration,
                    fit_seconds=fit_seconds, predict_seconds=predict_seconds,
                    executed_at=datetime.now(timezone.utc).isoformat(),
                    hardware=f'{platform.system()} {platform.machine()} · CPU {platform.processor() or "unknown"}',
                    context_preview=context_preview,
                    test_preview=[{key: float(value) for key, value in row.items()} for row in test[FEATURES].head(10).to_dict(orient='records')],
                    context_summary={'premium_mean': float(context.premium.mean()), 'positive_rate': float(context.label.mean()), 'population_b_share': float(context.population.mean())},
                    test_summary={'premium_mean': float(test.premium.mean()), 'positive_rate': float(test.label.mean()), 'population_b_share': float(test.population.mean())}))
                print(f'{kind:10s} {level:4d}% seed={seed} {name:8s} accuracy={results[-1]["metrics"]["accuracy"]:.3f}', flush=True)
    if append and output.exists():
        previous = json.loads(output.read_text(encoding='utf-8'))
        if previous.get('schema_version') != '1.0':
            raise ValueError('Existing results use an incompatible schema')
        old = previous['results']
        if any(record['dataset_version'] != DATASET_VERSION for record in old):
            raise ValueError('Existing results use a different dataset version')
        results = old + results
    export(results, output)
    print(f'Wrote {len(results)} measured runs to {output}')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--mode', choices=['quick', 'full'], default='quick')
    parser.add_argument('--models', nargs='+', choices=list(ADAPTERS), default=list(ADAPTERS))
    parser.add_argument('--output', type=Path, default=ROOT / 'public/experiments/results.json')
    parser.add_argument('--append', action='store_true', help='Preserve existing measured runs and add new model runs')
    args = parser.parse_args()
    run(args.mode, args.models, args.output, args.append)

if __name__ == '__main__':
    main()
