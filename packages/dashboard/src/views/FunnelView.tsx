import React, { useState } from 'react';
import { PageShell } from '../components/layout/PageShell';
import { FunnelChart } from '../components/charts/FunnelChart';
import { LoadingSpinner } from '../components/shared/LoadingSpinner';
import { EmptyState } from '../components/shared/EmptyState';
import { useFunnelQuery, useMetadata } from '../api/hooks';
import { useDateRange } from '../context/DateRangeContext';

export function FunnelView() {
  const { dateRange } = useDateRange();
  const metadata = useMetadata();
  const [steps, setSteps] = useState<string[]>([]);

  const eventNames = metadata.data?.eventNames ?? [];

  const funnel = useFunnelQuery(
    steps.length >= 2
      ? { steps: steps.map((event) => ({ event })), dateRange }
      : null,
  );

  const addStep = (event: string) => {
    if (!steps.includes(event)) setSteps([...steps, event]);
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  return (
    <PageShell title="Funnels">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--tp-text-secondary)', marginBottom: 8 }}>
          Funnel steps ({steps.length}/10) — click events to add
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {steps.map((step, i) => (
            <span key={i} style={{ padding: '4px 10px', background: 'var(--tp-accent-light)', color: 'var(--tp-accent)', borderRadius: 'var(--tp-radius, 8px)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              {i + 1}. {step}
              <button onClick={() => removeStep(i)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, lineHeight: 1 }}>&times;</button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {eventNames.filter((e) => !steps.includes(e)).map((name) => (
            <button key={name} onClick={() => addStep(name)} disabled={steps.length >= 10}
              style={{ padding: '5px 12px', borderRadius: 'var(--tp-radius, 8px)', fontSize: 13, cursor: 'pointer', border: '1px solid var(--tp-border, #e2e8f0)', background: 'var(--tp-surface, #fff)', color: 'var(--tp-text, #0f172a)' }}>
              + {name}
            </button>
          ))}
        </div>
      </div>

      <div style={{ background: 'var(--tp-surface, #fff)', borderRadius: 'var(--tp-radius, 8px)', border: '1px solid var(--tp-border, #e2e8f0)', padding: 20 }}>
        {steps.length < 2 ? <EmptyState message="Add at least 2 steps to build a funnel" /> :
         funnel.isLoading ? <LoadingSpinner /> :
         funnel.data ? <FunnelChart steps={funnel.data.steps} /> :
         <EmptyState message="No funnel data" />}
      </div>
    </PageShell>
  );
}
