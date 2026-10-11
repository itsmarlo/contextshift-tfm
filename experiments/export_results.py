"""Atomic serialization of measured results."""
import json
from jsonschema import Draft202012Validator
from pathlib import Path


def export(results: list[dict], destination: Path):
    ids = [r['experiment_id'] for r in results]
    if len(ids) != len(set(ids)):
        raise ValueError('duplicate experiment IDs')
    bundle = {'schema_version': '1.0', 'results': results}
    schema_path = Path(__file__).resolve().parents[1] / 'docs/result.schema.json'
    schema = json.loads(schema_path.read_text(encoding='utf-8'))
    Draft202012Validator(schema).validate(bundle)
    payload = json.dumps(bundle, allow_nan=False, separators=(',', ':'))
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + '.tmp')
    temporary.write_text(payload + '\n', encoding='utf-8')
    temporary.replace(destination)
