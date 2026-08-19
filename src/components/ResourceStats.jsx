import React, { useMemo } from 'react';
import StatCard from './StatCard';
import './ResourceStats.css';

/**
 * ResourceStats — the 4 summary number cards at the top of the Library page.
 *
 * Props:
 *   resources — full resources array (from Firestore or demo data)
 *
 * All values are computed dynamically from the resources prop.
 * No hardcoded numbers.
 */
function ResourceStats({ resources = [] }) {
  const stats = useMemo(() => {
    const total     = resources.length;
    const pdfs      = resources.filter(r => r.type === 'PDF').length;
    const notes     = resources.filter(r => r.type === 'Note' || r.type === 'Document').length;
    const links     = resources.filter(r => r.type === 'URL').length;
    const images    = resources.filter(r => r.type === 'Image').length;

    const pctOf = (n) => total > 0 ? `${Math.round((n / total) * 100)}% of total` : '—';

    return [
      {
        id: 'total',
        icon: '📂',
        iconBg: '#e8f0e8',
        label: 'Total Resources',
        value: total,
        sub: total === 0 ? 'No resources yet' : total === 1 ? '1 resource saved' : `${total} resources saved`,
        subColor: '#4a6741',
      },
      {
        id: 'pdfs',
        icon: '📄',
        iconBg: '#fde8e0',
        label: 'PDFs',
        value: pdfs,
        sub: pctOf(pdfs),
      },
      {
        id: 'notes',
        icon: '📝',
        iconBg: '#e3f0e3',
        label: 'Notes & Docs',
        value: notes,
        sub: pctOf(notes),
      },
      {
        id: 'links',
        icon: '🔗',
        iconBg: '#fef4e0',
        label: 'Links',
        value: links,
        sub: pctOf(links),
      },
    ];
  }, [resources]);

  return (
    <section className="resource-stats" aria-label="Library statistics">
      {stats.map((stat) => (
        <StatCard
          key={stat.id}
          icon={stat.icon}
          iconBg={stat.iconBg}
          label={stat.label}
          value={stat.value}
          sub={stat.sub}
          subColor={stat.subColor}
        />
      ))}
    </section>
  );
}

export default ResourceStats;
