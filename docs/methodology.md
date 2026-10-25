# Scientific methodology

## Question and hypotheses

ContextShift asks how the labeled context affects a pretrained tabular foundation model. The five study families are size, quality, relevance, class imbalance, and concept drift. Quality has four independent interventions: missing values, label flips, numerical noise, and outliers. We hypothesize that context changes can alter predictions, not that any intervention always helps or hurts.

## Synthetic process

`experiments/generate_dataset.py` defines eight numeric features: age, annual premium, prior claims, policy duration, insured amount, risk tier, geographic risk indicator, and late payment count. Population B has higher premiums, longer duration, and more prior claims on average. Claims are sampled from a Bernoulli distribution with probability `sigmoid(logit)`. Period A's logit is:

`-3.1 + .35*priorClaims + .32*(risk-1) + .33*geo + .23*payment + .0002*(premium-1200) + .0017*(age-45)^2 - .048*duration + .16*populationB`

Period B adds `.55 - .55*priorClaims + .14*duration`, a controlled relationship change. Feature distributions also differ. This is a teaching construct; it does not describe real insurance customers or establish causal relationships.

## Splitting and controls

Training candidates and held-out tests use separate RNG streams (`seed`, `seed+10000`). Recent Period B candidates and tests use `seed+20000` and `seed+30000`. Context selection, noise, and label flips never inspect held-out labels. Within each study, each model sees the same context and test features. Size contexts are nested for a fixed seed. Quality interventions modify only context rows. Relevance uses a fixed Population B test subset. Drift uses an unchanged Period B test set. Context size is 100 except for the size study. Full mode uses seeds 7, 17, and 27; quick mode uses seed 7.

Missing values are represented as NaN in the model inputs. TabPFN and XGBoost perform their own missing-value handling. No imputer is fitted on held-out data. Both models receive the same numeric feature encoding, with risk tier encoded as an integer. XGBoost fits a new 100-tree model per run. TabPFN receives context during its `.fit()` / `.predict_proba()` protocol with pretrained weights; the exported timing is an API call duration, not a comparable amount of task-specific training.

## Metrics and export

Predictions use a 0.5 decision threshold. Accuracy, precision, recall, F1, ROC AUC, PR AUC, log loss, Brier score, predicted positive share, and the 2×2 confusion matrix are computed on held-out truth. Zero division yields zero precision or recall. ROC and PR AUC are `null` if only one test class is present. Each run records model and dataset versions, seed, configuration, the first ten individual prediction probabilities and five calibration bins computed over the full test set, timing, UTC timestamp, hardware, and a ten-row context preview. The JSON bundle has `schema_version: "1.0"`. No interpolation is used for unrun combinations.

## Browser simulator

The Playground demonstrates the input structure described by Hollmann et al.: labeled context rows and an unlabeled query produce a prediction without changing pretrained weights. Its browser calculation is a separate, explicit similarity-weighted average, not the TabPFN algorithm. Quick actions change one visible example or feature at a time. The add-example action creates a nearby hypothetical labeled row; it does not reveal or reuse the query’s hidden label. The influence shares are normalized weights from this educational calculation; they are not TabPFN attention weights or causal feature attributions. The original ten rows stay fixed as the comparison reference.

The **My CSV** workspace applies the same educational rule to a local file. It accepts up to 500 rows, numeric features, blank feature values, and a binary 0/1 target. It holds one selected row out of the context, computes feature scales from the other rows, and uses those fixed scales while the context changes. The displayed percentage is a weighted label average, not a calibrated risk estimate or measured foundation-model result. User CSV bytes stay in browser memory; the sample is fetched from the public site.

## Limits

The generated data is small and designed for explanation. The conclusions cannot be generalized to live insurance portfolios. Population similarity and recent context are not guaranteed to improve predictions. Covariate shift changes the feature distribution; prior shift changes class prevalence; concept drift changes the feature–outcome relationship. These can co-occur in the generator. Model weights are downloaded separately and are not committed.

## Reproduce

Use Python 3.11 or 3.12. Create a virtual environment, install `experiments/requirements.txt`, then run `python -m experiments.run_experiments --mode quick` or `--mode full` from the repository root. On the validation Mac, set `OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1` for the command to avoid an OpenMP initialization crash. The first TabPFN run downloads pretrained weights. The bundled full grid contains 132 matched configurations for each model across seeds 7, 17, and 27. Rebuild the frontend after export. The browser simulator is independent of this pipeline.

## References

- Christoph Molnar, [*Tabular Foundation Models: A Short and Opinionated Guide*](https://tabularfoundationmodels.com/), especially Chapters 3–5 on PFNs, in-context learning, and pretraining.
- Hollmann et al., [TabPFN: A Transformer That Solves Small Tabular Classification Problems in a Second](https://arxiv.org/abs/2207.01848).
- [Prior Labs TabPFN documentation and source](https://github.com/PriorLabs/TabPFN).
