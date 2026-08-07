import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import IconButton from './IconButton';
import { useLang } from '../../i18n/LanguageContext';

/**
 * Modal — a thin shell over the native <dialog> element.
 *
 * The overlays in this app were `fixed inset-0` divs, and every one of them
 * was missing the same list: focus trap, Escape, focus restore on close, an
 * inert background, and role/aria-modal. `showModal()` provides all of it,
 * so what is left to write here is only the two things the platform does not
 * give us — click-outside and the visual shell.
 *
 * Mounting opens it. That matches how every call site already works
 * (`{thing && <SomeModal … />}`), so there is no `open` prop to keep in sync
 * with the parent state that already decides this.
 */
const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
};

export default function Modal({
  title,
  children,
  onClose,
  size = 'md',
  dismissable = true,
  className = '',
}) {
  const ref = useRef(null);
  const titleId = useId();
  const { t } = useLang();

  useEffect(() => {
    // Unmounting removes the element, which closes it and releases the top
    // layer — so there is deliberately no close() to pair with this.
    ref.current?.showModal();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onCancel = (e) => {
      // `cancel` fires on Escape. Swallowing it is the only hook there is for
      // a non-dismissable modal — without this a customer could Escape out of
      // first-run device setup and reach an unconfigured kiosk.
      e.preventDefault();
      if (dismissable) onClose?.();
    };

    el.addEventListener('cancel', onCancel);
    return () => el.removeEventListener('cancel', onCancel);
  }, [dismissable, onClose]);

  // A click lands on the <dialog> itself only when it missed the panel, since
  // the dialog is stretched to the viewport and the panel is centred inside it.
  const onBackdropClick = (e) => {
    if (dismissable && e.target === ref.current) onClose?.();
  };

  return (
    <dialog
      ref={ref}
      className="modal"
      onClick={onBackdropClick}
      aria-labelledby={title ? titleId : undefined}
    >
      <div
        className={`pop-in w-full ${SIZES[size] ?? SIZES.md} ${className}
          flex flex-col max-h-[90dvh] bg-white rounded-2xl overflow-hidden shadow-xl`}
      >
        {title && (
          <div
            className="flex items-center justify-between gap-3 px-6 py-4 shrink-0"
            style={{ background: 'var(--color-primary)', color: '#fff' }}
          >
            <h2 id={titleId} className="font-bold text-lg">{title}</h2>
            {dismissable && (
              <IconButton
                icon={X}
                label={t('common.close')}
                variant="onDark"
                size="sm"
                onClick={onClose}
              />
            )}
          </div>
        )}

        {/* min-h-0 is load-bearing: a flex child defaults to min-height:auto,
            which refuses to shrink below its content, so without it the panel
            would blow past max-h and the overflow would be clipped by the
            panel's own overflow-hidden rather than ever scrolling. */}
        <div className="overflow-y-auto min-h-0">{children}</div>
      </div>
    </dialog>
  );
}
