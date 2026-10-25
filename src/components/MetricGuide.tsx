const groups = [
  {
    title: 'Decisions at the 0.5 cutoff',
    intro: 'These turn each claim probability into Yes or No. Moving the cutoff would change these scores.',
    metrics: [
      { name: 'Accuracy', direction: 'Higher is better', question: 'How many decisions were correct?', use: 'Useful when classes are similarly common and errors similarly costly.', caution: 'Can look strong when claims are rare: always saying No claim scores 90.3% on the clean test set.' },
      { name: 'Precision', direction: 'Higher is better', question: 'Of the customers flagged for a claim, how many actually claimed?', use: 'Useful when false alarms are costly.', caution: 'If nothing is flagged, this app records precision as 0.' },
      { name: 'Recall', direction: 'Higher is better', question: 'Of customers who actually claimed, how many were found?', use: 'Useful when missed claims are costly.', caution: 'A model that flags nobody has 0 recall.' },
      { name: 'F1 score', direction: 'Higher is better', question: 'How well are precision and recall balanced?', use: 'Their harmonic mean; useful when both false alarms and missed claims matter.', caution: 'Ignores correct No-claim decisions and the quality of the probability estimates.' },
      { name: 'Predicted positive rate', direction: 'Descriptive', question: 'What share of customers were flagged?', use: 'Shows the volume of alerts at this cutoff.', caution: 'A higher or lower rate is not automatically better.' },
    ],
  },
  {
    title: 'Ranking across cutoffs',
    intro: 'These use the order of predicted risks instead of a single Yes/No cutoff.',
    metrics: [
      { name: 'ROC AUC', direction: 'Higher is better', question: 'Does a customer who claimed usually rank above one who did not?', use: 'Area under the ROC curve; useful for overall risk ranking. 0.5 is a no-skill reference.', caution: 'Can look reasonable even when the 0.5 cutoff finds no claims.' },
      { name: 'Average precision (AP)', direction: 'Higher is better', question: 'How precise is the ranking as more real claims are retrieved?', use: 'Especially useful when claims are rare; the clean test set has a 9.7% random-ranking reference.', caution: 'This is scikit-learn average precision, not trapezoidal area under the precision–recall curve.' },
    ],
  },
  {
    title: 'Quality of the probabilities',
    intro: 'These score the predicted percentages directly. Lower is better.',
    metrics: [
      { name: 'Log loss', direction: 'Lower is better', question: 'How much probability did the model assign to what actually happened?', use: 'Useful when reliable probabilities matter; confident wrong predictions receive a large penalty.', caution: 'A low value does not guarantee that the 0.5 cutoff finds claims.' },
      { name: 'Brier score', direction: 'Lower is better', question: 'How far were the predicted probabilities from the actual 0 or 1 outcomes?', use: 'Useful for judging probability accuracy with squared error.', caution: 'With rare claims, the many No-claim rows can dominate the average.' },
    ],
  },
]

export function MetricGuide() {
  return <details className="panel metric-guide" id="metric-guide">
    <summary><span><span className="eyebrow">READ THE SCORES</span><strong>What does each measure mean?</strong><small>Accuracy, F1, ROC AUC, average precision, probability errors, and more</small></span></summary>
    <p className="metric-guide-example">In the clean test set, 31 of 320 customers claimed. Always predicting No claim gives 90.3% accuracy but 0 recall and 0 F1. Read several measures together.</p>
    <div className="metric-guide-groups">{groups.map(group => <section key={group.title}><h3>{group.title}</h3><p>{group.intro}</p><dl>{group.metrics.map(metric => <div key={metric.name}><dt>{metric.name}<small>{metric.direction}</small></dt><dd><strong>{metric.question}</strong><span><b>Use:</b> {metric.use}</span><span><b>Watch out:</b> {metric.caution}</span></dd></div>)}</dl></section>)}</div>
    <p className="fineprint">Definitions follow <a href="https://scikit-learn.org/stable/modules/model_evaluation.html" target="_blank" rel="noreferrer">scikit-learn's classification metrics guide ↗</a>. The values shown elsewhere in this app come from its saved synthetic experiment.</p>
  </details>
}
