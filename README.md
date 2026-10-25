# ContextShift

**The Tabular Foundation Model Lab** — Same model. Different context. Different predictions.

ContextShift is a static research dashboard for studying how context size, quality, relevance, class balance, and drift affect tabular predictions. It includes an editable browser demonstration, a local CSV workspace, and a separate offline pipeline for measured TabPFN, XGBoost, and CatBoost experiments. The bundled study data is synthetic. No browser action calls a pretrained model.

## Architecture

- `src/pages/Playground.tsx`: editable three-panel workspace; a similarity-weighted educational simulator, and a read-only view of recorded runs.
- `src/pages/CsvExperiment.tsx`: browser-only CSV workspace for numeric features and a binary or continuous numeric target; selected rows are held out as queries.
- `src/pages/Experiments.tsx` and `Comparison.tsx`: charts built only from exported measured JSON.
- `src/pages/Learn.tsx` and `Methodology.tsx`: conceptual teaching and scientific protocol.
- `src/simulation/model.ts`: documented browser similarity predictor.
- `experiments/`: synthetic data, controlled interventions, model adapters, metrics, and JSON export.
- `public/experiments/results.json`: 396 matched, measured full-grid runs (132 each for TabPFN, XGBoost, and CatBoost) generated with Python 3.12.
- `docs/methodology.md`: equations, controls, and limitations. `docs/result.schema.json` defines the measured-result bundle.

Start with the Playground’s quick context experiments: flip the closest label, add a nearby hypothetical claim example, or hide a feature. The prediction and row influence display update immediately, and Reset returns to the original ten rows. More interventions and direct cell edits remain available. The simulator gives each context row a weight `exp(-2 × mean squared scaled feature distance)` multiplied by the share of observed features. The probability is the weighted mean of known labels. This is an educational calculation, not TabPFN inference. Missing features contribute no distance and reduce a row's weight.

## Try your own CSV

Open **My CSV** and load a file or use the [sample CSV](public/samples/contextshift-shifts-sample.csv). Files need a header, 4–500 rows, at most 50 feature columns, at least one numeric feature, and a numeric target column with at least two different known values. Targets containing only `0` and `1` use binary classification; other numeric targets, such as `premium`, use a weighted-average regression demonstration. Mark cells to predict with `[PREDICT]` or leave them blank. Blank numeric feature cells are allowed; text columns are skipped as numeric features. The sample includes `population` and `period` text columns for context selection, plus two prediction rows. You can vary context size; introduce missing features, corrupted targets, noise, or outliers; change group relevance, class balance, or recent-data share; or edit context cells in clean mode. The app scores each setting on the same fixed held-out known rows and compares it with clean context of the same size. Binary targets use accuracy; numeric targets use mean absolute error. With few rows, these scores are unstable and are for exploration, not model selection. Prediction rows and validation rows are excluded from context; their target values are never used to form their own predictions. Your file stays in the browser tab; no CSV content is sent to the site or stored remotely. This workspace uses the transparent educational similarity model, not a live TabPFN, XGBoost, CatBoost, or RPT run. The marker follows the [RPT Playground's example convention](https://developers.sap.com/tutorials/ai-core-genaihub-sap-rpt-model-usage).

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
OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 python -m experiments.run_experiments --mode quick
# For the full grid (multiple seeds and all configured levels):
OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1 python -m experiments.run_experiments --mode full
```

The thread limits avoid an OpenMP initialization crash observed on the validation Mac; they also make the CPU run reproducible there. Use `--models CatBoost --mode full --append` to add CatBoost measurements to an existing compatible export, or `--output /path/to/results.json` to avoid replacing the site bundle. The runner never silently substitutes a simulation for TabPFN. If weights, dependencies, or hardware are unavailable, the app keeps the empty state and reports no measured result. The included results use TabPFN 2.2.1, XGBoost 2.1.3, and CatBoost 1.2.10; exact model versions and hardware are recorded per run.

## Interpreting the model comparison

The [TabPFN benchmark paper](https://www.nature.com/articles/s41586-024-08328-6) reports strong average TabPFN performance against XGBoost and CatBoost on curated datasets with up to 10,000 rows; its aggregate scores are normalized across datasets. The [TabArena benchmark](https://papers.neurips.cc/paper_files/paper/2025/file/1697e3fb412da11dc9488249f9e7bbc9-Paper-Datasets_and_Benchmarks_Track.pdf) finds foundation models especially strong on compatible small datasets, while boosted trees remain competitive and tuning and validation design affect rankings. Neither establishes a winner for every dataset.

On this project's synthetic clean context with 100 training rows, mean ROC AUC ± SD across three seeds is **0.664 ± 0.045 for CatBoost, 0.613 ± 0.107 for TabPFN, and 0.582 ± 0.118 for XGBoost**. This is one synthetic task with fixed model settings, and three context seeds do not establish statistical superiority across datasets. The held-out positive share is 9.7%; high accuracy can result from predicting mostly negative cases. The dashboard defaults to ROC AUC and allows inspection of PR AUC, F1, log loss, and individual predictions. It does not claim these local measurements are a real-world benchmark.

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
- [TabPFN v2 classifier license](https://huggingface.co/Prior-Labs/TabPFN-v2-clf/blob/main/LICENSE.txt). Built with PriorLabs-TabPFN.
- [Hollmann et al., TabPFN paper](https://arxiv.org/abs/2207.01848)

## License

MIT. See [LICENSE](LICENSE).
