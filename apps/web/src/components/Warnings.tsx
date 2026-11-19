import type { RuntimeWarning } from '@outagekit/runtime';
import { Icon } from './Icon';

export function Warnings({
  warnings,
  extra = [],
}: {
  warnings: RuntimeWarning[];
  extra?: RuntimeWarning[];
}) {
  const all = [...extra, ...warnings];
  if (all.length === 0) return null;
  const order = { danger: 0, warning: 1, info: 2 } as const;
  const sorted = [...all].sort((a, b) => order[a.severity] - order[b.severity]);
  return (
    <ul className="warnings" aria-label="Things to know">
      {sorted.map((warning, index) => (
        <li
          key={`${warning.code}-${warning.sourceId ?? ''}-${index}`}
          className={`warning warning-${warning.severity}`}
        >
          <Icon name={warning.severity === 'info' ? 'info' : 'alert'} size={18} />
          <span>{warning.message}</span>
        </li>
      ))}
    </ul>
  );
}
