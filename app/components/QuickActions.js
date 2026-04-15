'use client';

export default function QuickActions({ title, actions, onSelect }) {
  if (!actions || actions.length === 0) return null;

  return (
    <section className="px-quick-actions">
      {title && <h3 className="px-care-card-title">{title}</h3>}
      <div className="px-quick-actions-grid">
        {actions.map(function (action) {
          return (
            <button
              key={action}
              type="button"
              className="px-quick-action"
              onClick={function () { onSelect(action); }}
            >
              {action}
            </button>
          );
        })}
      </div>
    </section>
  );
}
