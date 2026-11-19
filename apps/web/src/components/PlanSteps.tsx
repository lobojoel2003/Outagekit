import type { PlanStep } from '../lib/plan';

export function PlanSteps({ steps, compact }: { steps: PlanStep[]; compact?: boolean }) {
  return (
    <ol className={`plan ${compact ? 'plan-compact' : ''}`} data-testid="plan">
      {steps.map((step, index) => (
        <li key={step.id} className={`plan-step plan-${step.tone}`} data-step={step.id}>
          <span className="plan-number" aria-hidden="true">
            {index + 1}
          </span>
          <div className="plan-body">
            <h3>{step.title}</h3>
            {step.headline && <p className="plan-headline">{step.headline}</p>}
            {step.lines.length > 0 && (
              <ul>
                {step.lines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
