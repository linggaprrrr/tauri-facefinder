import { Undo2, Redo2, Plus, Minus, RotateCcw, Eraser } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

/**
 * Document-scope actions: history and view zoom.
 *
 * Everything that acts on a selected element moved to ElementToolbar. This bar
 * used to carry both, which meant that with nothing selected five of its seven
 * controls sat greyed out — and a row of dead buttons reads as a broken
 * toolbar rather than as an empty selection.
 *
 * Rendered as a centred pill under the canvas. As a full-width bar above it,
 * two controls left most of the row empty and pushed the photo down the page.
 *
 * The zoom buttons are a keyboard/mouse equivalent of the pinch gesture, and
 * the percentage doubles as the only visible cue that the view is zoomed at
 * all — without it a customer who pinched by accident has no way to tell why
 * the photo looks cropped, and no obvious way back. Reset is that way back.
 */
export default function EditorToolbar({
  canUndo, canRedo, onUndo, onRedo, onReset, canReset,
  zoom = 1, onZoomIn, onZoomOut, onZoomReset, canZoomIn, canZoomOut,
}) {
  const { t } = useLang();
  const pill = 'px-4 rounded-full text-sm font-semibold transition-all active:scale-95 inline-flex items-center gap-1.5 disabled:cursor-not-allowed cursor-pointer';
  const round = 'w-10 h-10 rounded-full inline-flex items-center justify-center transition-all active:scale-90 disabled:cursor-not-allowed cursor-pointer';

  const tone = (enabled) => ({
    background: enabled ? 'var(--color-primary-50)' : 'transparent',
    color: enabled ? 'var(--color-primary)' : 'var(--color-neutral-400)',
  });

  return (
    <div
      className="flex flex-wrap justify-center items-center gap-1.5 self-center max-w-full p-1.5 rounded-[1.5rem] shrink-0"
      style={{ background: 'var(--color-card)', border: '1px solid var(--color-neutral-200)', boxShadow: 'var(--shadow-md)' }}
    >
      <button className={pill} onClick={onUndo} disabled={!canUndo} style={{ minHeight: 40, ...tone(canUndo) }}>
        <Undo2 size={16} /> {t('toolbar.undo')}
      </button>
      <button className={pill} onClick={onRedo} disabled={!canRedo} style={{ minHeight: 40, ...tone(canRedo) }}>
        <Redo2 size={16} /> {t('toolbar.redo')}
      </button>
      {onReset && (
        // Clears this photo's stickers, text, filter and frame. Stickers/text
        // come back with Undo; filter and frame are one tap to re-pick.
        <button className={pill} onClick={onReset} disabled={!canReset} style={{ minHeight: 40, ...tone(canReset) }}>
          <Eraser size={16} /> {t('toolbar.reset')}
        </button>
      )}

      <span className="w-px self-stretch mx-0.5" style={{ background: 'var(--color-neutral-200)' }} />

      <button
        className={round} onClick={onZoomOut} disabled={!canZoomOut}
        aria-label={t('toolbar.zoomOut')} title={t('toolbar.zoomOut')}
        style={tone(canZoomOut)}
      >
        <Minus size={18} />
      </button>

      <span
        className="text-sm font-bold tabular-nums text-center select-none"
        style={{ minWidth: 52, color: 'var(--color-neutral-700)' }}
      >
        {Math.round(zoom * 100)}%
      </span>

      <button
        className={round} onClick={onZoomIn} disabled={!canZoomIn}
        aria-label={t('toolbar.zoomIn')} title={t('toolbar.zoomIn')}
        style={tone(canZoomIn)}
      >
        <Plus size={18} />
      </button>

      <button
        className={round} onClick={onZoomReset} disabled={zoom === 1}
        aria-label={t('toolbar.zoomReset')} title={t('toolbar.zoomReset')}
        style={tone(zoom !== 1)}
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
}
