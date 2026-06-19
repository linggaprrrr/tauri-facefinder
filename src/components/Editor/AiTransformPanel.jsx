import { useState } from 'react';
import { Sparkles, Wand2, Loader2 } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

export default function AiTransformPanel({ templates, loading, onGenerate, aiTransformUsed, generating, currentIsAi }) {
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
        <div className="flex flex-col gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl animate-pulse" style={{ background: 'var(--color-neutral-100)', height: 56 }} />
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

  const disabled = !selected || aiTransformUsed || generating || currentIsAi;

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-3" style={panelStyle}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
        <h3 className="font-bold flex-1" style={{ color: 'var(--color-neutral-700)' }}>
          {t('ai.title')}
        </h3>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{
          background: aiTransformUsed ? 'var(--color-neutral-100)' : 'var(--color-primary-50)',
          color: aiTransformUsed ? 'var(--color-neutral-400)' : 'var(--color-primary)',
        }}>
          {aiTransformUsed ? t('ai.used') : t('ai.free')}
        </span>
      </div>

      {/* Template list — after thumbnail + label */}
      <div className="flex flex-col gap-1.5">
        {templates.map((tpl) => {
          const isActive = selected === tpl.id;
          return (
            <button
              key={tpl.id}
              disabled={aiTransformUsed || generating || currentIsAi}
              onClick={() => setSelected(isActive ? null : tpl.id)}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: isActive ? 'var(--color-primary-50)' : 'var(--color-neutral-50)',
                border: `2px solid ${isActive ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              {/* Result (after) thumbnail */}
              <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--color-neutral-100)' }}>
                {tpl.after_url
                  ? <img src={tpl.after_url} alt={tpl.label} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', background: 'var(--color-neutral-200)' }} />}
              </div>

              {/* Label */}
              <span
                className="text-xs font-semibold leading-tight flex-1 truncate"
                style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-neutral-700)' }}
              >
                {tpl.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Hint */}
      {currentIsAi ? (
        <p className="text-xs leading-snug" style={{ color: 'var(--color-neutral-400)' }}>
          {t('ai.aiPhotoHint')}
        </p>
      ) : !aiTransformUsed && (
        <p className="text-xs leading-snug" style={{ color: 'var(--color-neutral-400)' }}>
          {t('ai.generateNote')}
        </p>
      )}

      {/* Generate button — fires background job, panel stays usable */}
      <button
        disabled={disabled}
        onClick={() => {
          const tpl = templates.find((t) => t.id === selected);
          if (tpl) onGenerate(tpl);
        }}
        className="py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: !disabled ? 'var(--color-primary)' : 'var(--color-neutral-200)',
          color: !disabled ? '#fff' : 'var(--color-neutral-400)',
        }}
      >
        {generating ? (
          <><Loader2 size={16} className="animate-spin" /> {t('ai.generating')}</>
        ) : (
          <><Wand2 size={16} /> {t('ai.generateBtn')}</>
        )}
      </button>
    </div>
  );
}
