import { Copy, FlipHorizontal, ChevronUp, ChevronDown, Trash2, Lock, LockOpen } from 'lucide-react';
import IconButton from '../common/IconButton';
import { useLang } from '../../i18n/LanguageContext';

/**
 * Actions scoped to the selected element.
 *
 * Absent entirely when nothing is selected, so its presence *is* the
 * affordance — the previous design left these controls permanently on screen
 * and greyed out, which is a weaker signal and a noisier canvas.
 *
 * Lock stays enabled while everything else disables: a locked element can
 * still be selected, and unlocking it is the only way back. That asymmetry is
 * the whole reason `canEdit` and `hasSelection` are different conditions.
 */
export default function ElementToolbar({
  label,
  isLocked,
  onDuplicate,
  onFlip,
  canFlip,
  onBringForward,
  onSendBackward,
  onToggleLock,
  onDelete,
}) {
  const { t } = useLang();
  const canEdit = !isLocked;

  return (
    <div
      className="pop-in flex items-center gap-1.5 flex-wrap p-2 rounded-xl"
      style={{
        background: '#fff',
        border: '1.5px solid var(--color-primary-100)',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <span
        className="text-sm font-bold truncate max-w-[8rem] px-1.5"
        style={{ color: 'var(--color-neutral-800)' }}
      >
        {label}
      </span>

      <IconButton
        icon={isLocked ? Lock : LockOpen}
        label={t(isLocked ? 'toolbar.unlockHint' : 'toolbar.lockHint')}
        variant={isLocked ? 'warning' : 'ghost'}
        size="sm"
        aria-pressed={isLocked}
        onClick={onToggleLock}
      />

      <div className="w-px self-stretch mx-0.5" style={{ background: 'var(--color-neutral-200)' }} />

      <IconButton
        icon={Copy} label={t('toolbar.duplicate')} variant="subtle" size="sm"
        disabled={!canEdit} onClick={onDuplicate}
      />
      {/* Only rendered where mirroring means something — text and an un-filled
          upload placeholder are excluded at the source (canFlip in PhotoEditor),
          so this is absent rather than present-but-dead. */}
      {canFlip && (
        <IconButton
          icon={FlipHorizontal} label={t('toolbar.flip')} variant="subtle" size="sm"
          disabled={!canEdit} onClick={onFlip}
        />
      )}
      <IconButton
        icon={ChevronUp} label={t('toolbar.forward')} variant="subtle" size="sm"
        disabled={!canEdit} onClick={onBringForward}
      />
      <IconButton
        icon={ChevronDown} label={t('toolbar.backward')} variant="subtle" size="sm"
        disabled={!canEdit} onClick={onSendBackward}
      />
      <IconButton
        icon={Trash2} label={t('toolbar.delete')} variant="danger" size="sm"
        disabled={!canEdit} onClick={onDelete}
      />

      {isLocked && (
        <span
          className="text-xs font-medium flex items-center gap-1 ml-auto pr-1"
          style={{ color: 'var(--color-warning)' }}
        >
          <Lock size={12} /> {t('editor.hintLocked')}
        </span>
      )}
    </div>
  );
}
