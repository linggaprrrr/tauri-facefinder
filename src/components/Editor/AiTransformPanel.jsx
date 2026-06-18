import { useState } from 'react';
import { Sparkles, Wand2 } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

export default function AiTransformPanel({ templates, loading, onTransform }) {
  const { t } = useLang();
  const [selected, setSelected] = useState(null);

  const panelStyle = {
    background: '#fff',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--color-neutral-100)',
  };

  if (loading) {
    return (
      <div className="rounded-2xl p-4 flex flex-col gap-3" style={panelStyle}>
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
          <h3 className="font-bold" style={{ color: 'var(--color-neutral-700)' }}>
            {t('ai.title')}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-3 animate-pulse"
              style={{ background: 'var(--color-neutral-100)', height: 80 }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!templates.length) {
    return (
      <div className="rounded-2xl p-4 flex flex-col gap-3" style={panelStyle}>
        <div className="flex items-center gap-2">
          <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
          <h3 className="font-bold" style={{ color: 'var(--color-neutral-700)' }}>
            {t('ai.title')}
          </h3>
        </div>
        <p className="text-xs text-center py-6" style={{ color: 'var(--color-neutral-400)' }}>
          {t('ai.noTemplates')}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-4" style={panelStyle}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
        <h3 className="font-bold flex-1" style={{ color: 'var(--color-neutral-700)' }}>
          {t('ai.title')}
        </h3>
      </div>

      <p className="text-xs" style={{ color: 'var(--color-neutral-500)' }}>
        {t('ai.subtitle')}
      </p>

      {/* Template grid */}
      <div className="grid grid-cols-2 gap-2">
        {templates.map((tpl) => {
          const isActive = selected === tpl.id;
          return (
            <button
              key={tpl.id}
              onClick={() => setSelected(isActive ? null : tpl.id)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all active:scale-95"
              style={{
                background: isActive ? 'var(--color-primary-50)' : 'var(--color-neutral-50)',
                border: `2px solid ${isActive ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
                cursor: 'pointer',
              }}
            >
              {tpl.emoji && (
                <span style={{ fontSize: 26, lineHeight: 1 }}>{tpl.emoji}</span>
              )}
              {!tpl.emoji && tpl.after_url && (
                <img
                  src={tpl.after_url}
                  alt={tpl.label}
                  style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 6 }}
                />
              )}
              <span
                className="text-xs font-semibold text-center leading-tight"
                style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-neutral-700)' }}
              >
                {tpl.label}
              </span>
              {tpl.tag && (
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                  style={
                    tpl.tag_color
                      ? { background: tpl.tag_color.bg, color: tpl.tag_color.color }
                      : { background: 'var(--color-neutral-100)', color: 'var(--color-neutral-500)' }
                  }
                >
                  {tpl.tag}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Preview button */}
      <button
        disabled={!selected}
        onClick={() => {
          const tpl = templates.find((t) => t.id === selected);
          if (tpl) onTransform(tpl);
        }}
        className="py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: selected ? 'var(--color-primary)' : 'var(--color-neutral-200)',
          color: selected ? '#fff' : 'var(--color-neutral-400)',
        }}
      >
        <Wand2 size={16} />
        {t('ai.previewBtn')}
      </button>
    </div>
  );
}
