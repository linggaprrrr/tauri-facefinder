import { Undo2, Redo2, ChevronUp, ChevronDown, Trash2, Lock, LockOpen } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

export default function EditorToolbar({
  canUndo, canRedo, onUndo, onRedo,
  onDelete, onBringForward, onSendBackward, onToggleLock,
  hasSelection, isLocked,
}) {
  const { t } = useLang();
  // A locked element can still be selected (that's how you unlock it), so the
  // mutating controls key off "editable", not "selected".
  const canEdit = hasSelection && !isLocked;
  // Compact on mobile (xs), full kiosk size on desktop (sm:+).
  const base = 'px-2 sm:px-4 py-1 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold transition-all active:scale-95 min-h-7 sm:min-h-10 inline-flex items-center gap-1 sm:gap-1.5';

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
        <Undo2 size={14} /> {t('toolbar.undo')}
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
        <Redo2 size={14} /> {t('toolbar.redo')}
      </button>

      {/* Divider */}
      <div className="w-px self-stretch" style={{ background: 'var(--color-neutral-200)' }} />

      {/* Layer controls */}
      <button
        className={toolBtn(canEdit)}
        onClick={onBringForward}
        disabled={!canEdit}
        style={{
          background: canEdit ? 'var(--color-neutral-100)' : 'var(--color-neutral-50)',
          color: canEdit ? 'var(--color-neutral-700)' : 'var(--color-neutral-300)',
        }}
      >
        <ChevronUp size={14} /> {t('toolbar.forward')}
      </button>
      <button
        className={toolBtn(canEdit)}
        onClick={onSendBackward}
        disabled={!canEdit}
        style={{
          background: canEdit ? 'var(--color-neutral-100)' : 'var(--color-neutral-50)',
          color: canEdit ? 'var(--color-neutral-700)' : 'var(--color-neutral-300)',
        }}
      >
        <ChevronDown size={14} /> {t('toolbar.backward')}
      </button>

      {/* Divider */}
      <div className="w-px self-stretch" style={{ background: 'var(--color-neutral-200)' }} />

      {/* Editable on/off */}
      <button
        className={toolBtn(hasSelection)}
        onClick={onToggleLock}
        disabled={!hasSelection}
        aria-pressed={isLocked}
        title={t(isLocked ? 'toolbar.unlockHint' : 'toolbar.lockHint')}
        style={{
          background: !hasSelection ? 'var(--color-neutral-50)'
            : isLocked ? 'var(--color-warning-bg)' : 'var(--color-neutral-100)',
          color: !hasSelection ? 'var(--color-neutral-300)'
            : isLocked ? 'var(--color-warning)' : 'var(--color-neutral-700)',
        }}
      >
        {isLocked ? <Lock size={14} /> : <LockOpen size={14} />}
        {t(isLocked ? 'toolbar.locked' : 'toolbar.unlocked')}
      </button>

      {/* Delete */}
      <button
        className={toolBtn(canEdit, true)}
        onClick={onDelete}
        disabled={!canEdit}
        style={{
          background: canEdit ? 'var(--color-error-bg)' : 'var(--color-neutral-50)',
          color: canEdit ? 'var(--color-error)' : 'var(--color-neutral-300)',
        }}
      >
        <Trash2 size={14} /> {t('toolbar.delete')}
      </button>
    </div>
  );
}
