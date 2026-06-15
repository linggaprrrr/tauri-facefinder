import { Undo2, Redo2, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

export default function EditorToolbar({
  canUndo, canRedo, onUndo, onRedo,
  onDelete, onBringForward, onSendBackward,
  hasSelection,
}) {
  const { t } = useLang();
  const base = 'px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95 min-h-10 inline-flex items-center gap-1.5';

  function toolBtn(enabled, danger = false) {
    if (!enabled) return `${base} cursor-not-allowed` ;
    if (danger) return `${base} cursor-pointer`;
    return `${base} cursor-pointer`;
  }

  return (
    <div
      className="flex gap-2 flex-wrap p-3 rounded-xl"
      style={{ background: '#fff', border: '1px solid var(--color-neutral-200)', boxShadow: 'var(--shadow-sm)' }}
    >
      {/* Undo / Redo */}
      <button
        className={toolBtn(canUndo)}
        onClick={onUndo}
        disabled={!canUndo}
        style={{
          background: canUndo ? 'var(--color-primary-50)' : 'var(--color-neutral-100)',
          color: canUndo ? 'var(--color-primary)' : 'var(--color-neutral-400)',
        }}
      >
        <Undo2 size={16} /> {t('toolbar.undo')}
      </button>
      <button
        className={toolBtn(canRedo)}
        onClick={onRedo}
        disabled={!canRedo}
        style={{
          background: canRedo ? 'var(--color-primary-50)' : 'var(--color-neutral-100)',
          color: canRedo ? 'var(--color-primary)' : 'var(--color-neutral-400)',
        }}
      >
        <Redo2 size={16} /> {t('toolbar.redo')}
      </button>

      {/* Divider */}
      <div className="w-px self-stretch" style={{ background: 'var(--color-neutral-200)' }} />

      {/* Layer controls */}
      <button
        className={toolBtn(hasSelection)}
        onClick={onBringForward}
        disabled={!hasSelection}
        style={{
          background: hasSelection ? 'var(--color-neutral-100)' : 'var(--color-neutral-50)',
          color: hasSelection ? 'var(--color-neutral-700)' : 'var(--color-neutral-300)',
        }}
      >
        <ChevronUp size={16} /> {t('toolbar.forward')}
      </button>
      <button
        className={toolBtn(hasSelection)}
        onClick={onSendBackward}
        disabled={!hasSelection}
        style={{
          background: hasSelection ? 'var(--color-neutral-100)' : 'var(--color-neutral-50)',
          color: hasSelection ? 'var(--color-neutral-700)' : 'var(--color-neutral-300)',
        }}
      >
        <ChevronDown size={16} /> {t('toolbar.backward')}
      </button>

      {/* Divider */}
      <div className="w-px self-stretch" style={{ background: 'var(--color-neutral-200)' }} />

      {/* Delete */}
      <button
        className={toolBtn(hasSelection, true)}
        onClick={onDelete}
        disabled={!hasSelection}
        style={{
          background: hasSelection ? 'var(--color-error-bg)' : 'var(--color-neutral-50)',
          color: hasSelection ? 'var(--color-error)' : 'var(--color-neutral-300)',
        }}
      >
        <Trash2 size={16} /> {t('toolbar.delete')}
      </button>
    </div>
  );
}
