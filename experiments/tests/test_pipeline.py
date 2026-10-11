import json
import numpy as np
import pytest
from experiments.evaluate import evaluate
from experiments.export_results import export
from experiments.generate_dataset import FEATURES, generate_population, make_dataset
from experiments.interventions import corrupt_context, drift_context, nested_context, stratified_context
from experiments.run_experiments import context_for


def test_generation_is_reproducible_and_period_changes_relation():
    a = generate_population(100, 11)
    assert a.equals(generate_population(100, 11))
    assert list(a[FEATURES].columns) == FEATURES
    assert set(a.label.unique()) <= {0, 1}
    assert not a.equals(generate_population(100, 11, period='B'))


def test_holdout_remains_unchanged_across_contexts():
    data = make_dataset(pool_size=1200, test_size=90)
    original = data.test.copy(deep=True)
    for kind, level in [('size', 10), ('missing', 20), ('labels', 20), ('relevance', 75), ('imbalance', 20)]:
        context, _ = context_for(data, kind, level, 7)
        assert len(context) > 0
    assert data.test.equals(original)
    assert 'label' not in FEATURES
    assert data.pool[FEATURES].merge(data.test[FEATURES], on=FEATURES).empty


def test_nested_context_and_invalid_size():
    data = make_dataset(pool_size=200, test_size=20)
    assert nested_context(data.pool, 10, 7).equals(nested_context(data.pool, 50, 7).iloc[:10])
    with pytest.raises(ValueError): nested_context(data.pool, 201, 7)


def test_corruptions_are_independent_and_preserve_source():
    context = nested_context(make_dataset(pool_size=500).pool, 200, 7)
    original = context.copy(deep=True)
    assert (corrupt_context(context, 'labels', 1, 3).label == 1 - context.label).all()
    assert corrupt_context(context, 'missing', 1, 3)[FEATURES].isna().all().all()
    assert not corrupt_context(context, 'noise', .3, 3).premium.equals(context.premium)
    assert not corrupt_context(context, 'outliers', 1, 3).premium.equals(context.premium)
    assert context.equals(original)
    with pytest.raises(ValueError): corrupt_context(context, 'missing', 1.5, 3)


def test_relevance_imbalance_and_drift():
    data = make_dataset(pool_size=800, test_size=100)
    relevant = stratified_context(data.pool, 100, .75, 'population', 7)
    assert relevant.population.sum() == 75
    imbalanced = stratified_context(data.pool, 100, .1, 'label', 7)
    assert imbalanced.label.sum() == 10
    drift = drift_context(data.pool, data.recent_pool, 100, .5, 7)
    assert (drift.period == 'B').sum() == 50
    with pytest.raises(ValueError): stratified_context(data.pool, 100, 2, 'label', 7)


def test_metrics_and_serialization(tmp_path):
    metrics = evaluate([0, 0, 1, 1], [.1, .2, .8, .9])
    assert metrics['accuracy'] == metrics['f1'] == metrics['roc_auc'] == 1
    assert metrics['confusion'] == [[2, 0], [0, 2]]
    assert evaluate([0, 0], [.1, .2])['roc_auc'] is None
    with pytest.raises(ValueError): evaluate([], [])
    output = tmp_path / 'results.json'
    record = dict(experiment_id='one', experiment_type='size', dataset_version='test',
                  model_name='XGBoost', model_version='test', seed=7, context_size=2,
                  configuration={'level': 2}, metrics=metrics, predictions=[],
                  fit_seconds=0.01, predict_seconds=0.01, executed_at='2026-01-01T00:00:00Z',
                  hardware='test', context_preview=[], test_preview=[], calibration=[],
                  context_summary={}, test_summary={})
    export([record], output)
    assert json.loads(output.read_text())['schema_version'] == '1.0'
    with pytest.raises(ValueError): export([{'experiment_id': 'same'}, {'experiment_id': 'same'}], output)


def test_exported_bundle_matches_schema():
    from pathlib import Path
    import jsonschema
    root = Path(__file__).resolve().parents[2]
    schema = json.loads((root / 'docs/result.schema.json').read_text())
    bundle = json.loads((root / 'public/experiments/results.json').read_text())
    jsonschema.Draft202012Validator(schema).validate(bundle)
