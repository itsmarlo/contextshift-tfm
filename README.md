# ContextShift

**The Tabular Foundation Model Lab** — Same model. Different context. Different predictions.

ContextShift is a static research dashboard for studying how context size, quality, relevance, class balance, and drift affect tabular predictions. It includes an editable browser demonstration and a separate offline pipeline for measured TabPFN and XGBoost experiments. All data is synthetic. No browser action calls a pretrained model.

## Architecture

- `src/pages/Playground.tsx`: editable three-panel workspace; a similarity-weighted educational simulator, and a read-only view of recorded runs.
- `src/pages/Experiments.tsx` and `Comparison.tsx`: charts built only from exported measured JSON.
- `src/pages/Learn.tsx` and `Methodology.tsx`: conceptual teaching and scientific protocol.
- `src/simulation/model.ts`: documented browser similarity predictor.
- `experiments/`: synthetic data, controlled interventions, model adapters, metrics, and JSON export.
- `public/experiments/results.json`: 132 measured full-grid XGBoost runs generated on the validation host; TabPFN runs remain unavailable until local weights and dependencies are installed.
- `docs/methodology.md`: equations, controls, and limitations. `docs/result.schema.json` defines the measured-result bundle.

The simulator gives each context row a weight `exp(-2 × mean squared scaled feature distance)` multiplied by the share of observed features. The probability is the weighted mean of known labels. This is an educational calculation, not TabPFN inference. Missing features contribute no distance and reduce a row's weight.

## Run locally on macOS

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For a root-hosted preview, use `VITE_BASE=/ npm run dev`. The production base path defaults to `/contextshift-tfm/`.

## Generate measured experiments

Use Python 3.11 or 3.12. TabPFN's first run downloads model weights under Prior Labs' separate license; CPU runs can be slow.

```bash
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r experiments/requirements.txt
python -m experiments.run_experiments --mode quick
# For the full grid (multiple seeds and all configured levels):
python -m experiments.run_experiments --mode full
```

Use `--models XGBoost` for a baseline-only diagnostic run, or `--output /path/to/results.json` to avoid replacing the site bundle. A dashboard comparison needs both models' measured runs. The runner never silently substitutes a simulation for TabPFN. If weights, dependencies, or hardware are unavailable, the app keeps the empty state and reports no measured result. The included 132-run XGBoost baseline was measured with XGBoost 3.3.0 and Python 3.14 on the validation host; its exact model version and hardware are recorded per result. Regenerate with the pinned Python 3.11/3.12 environment for a fully pinned run. No TabPFN result is bundled yet.

## Quality checks and build

```bash
npm run typecheck
npm run lint
npm test
npm run build
python -m pytest experiments/tests
```

The frontend reads static JSON from `public/experiments/results.json`. Build again after generating it.

## GitHub Pages

1. Create a repository named `contextshift-tfm` and push this project to its `main` branch.
2. In repository Settings → Pages, choose **GitHub Actions** as the source.
3. The workflow installs dependencies, typechecks, lints, tests, builds, uploads `dist`, and deploys to `https://USERNAME.github.io/contextshift-tfm/`.
4. For another repository name, set `VITE_BASE=/YOUR-REPO/` in the build environment.

The GitHub Actions workflow deploys committed JSON. Run the Python experiments locally and commit the resulting reasonably sized JSON file if you want measured results on Pages. Do not commit weights, secrets, or large temporary files.

## Experiments and interpretation

- **Size:** nested contexts from 10 to 1,000 rows; fixed test set.
- **Quality:** missing features, flipped labels, numeric feature noise, and outlier contamination are separate interventions.
- **Relevance:** composition of populations A and B on a fixed B test subset.
- **Imbalance:** context positive share from 5% to 50%, fixed test population.
- **Drift:** historical versus recent Period B context on a fixed Period B test set.

Extra context may add useful information or noise. Similar-looking examples need not be more predictive. Updated context may help with drift but cannot guarantee recovery. Accuracy alone may obscure minority-class errors. See [methodology](docs/methodology.md) for the generator, metrics, and limitations.

## Glossary

| Term | Meaning |
| --- | --- |
| In-context learning | Predicting from examples supplied alongside a query without task-specific weight updates. |
| Context window | Examples the model can condition on in a prediction call. |
| Training examples | Labeled rows available to the model. |
| Features | Input columns describing an observation. |
| Labels | Known target values for context examples. |
| Foundation model | A broadly pretrained model adapted to a task through a specified interface. |
| Pretraining | Earlier optimization of model weights across many tasks or datasets. |
| Covariate shift | Change in feature distribution. |
| Concept drift | Change in the feature–outcome relationship. |
| Label noise | Incorrect target values in context. |
| Class imbalance | Unequal class frequencies. |
| Calibration | Agreement between predicted probabilities and observed event frequencies. |

## References

- [Christoph Molnar, *Tabular Foundation Models*](https://tabularfoundationmodels.com/)
- [TabPFN source and installation](https://github.com/PriorLabs/TabPFN)
- [Hollmann et al., TabPFN paper](https://arxiv.org/abs/2207.01848)

## License

MIT. See [LICENSE](LICENSE).
