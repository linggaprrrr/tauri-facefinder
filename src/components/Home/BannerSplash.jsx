import { X } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

// The outlet's banner shown in front of the app on the welcome screen — a
// promo card over the kiosk, not a takeover. Full-screen was rejected for
// good reason: a `contain` fit on a 16:10 screen letterboxes a portrait
// banner in black, which reads as "the app crashed" rather than "here is an
// offer", and it hides the kiosk entirely instead of framing it.
//
// So: the image keeps its own aspect ratio at its own size, the app stays
// visible and dimmed behind it, and both exits sit on the card itself.
//
// Two exits on purpose. Start is for the customer; the close button is for
// staff who need the kiosk without sitting through a promo, and for anyone
// who taps the corner because that is what corners do. Both land on the same
// screen — a banner that can trap someone in front of a queue is worse than
// no banner.
const ANCHORS = {
  'top-left': 'items-start justify-start',
  'top-center': 'items-start justify-center',
  'top-right': 'items-start justify-end',
  'middle-left': 'items-center justify-start',
  'middle-center': 'items-center justify-center',
  'middle-right': 'items-center justify-end',
  'bottom-left': 'items-end justify-start',
  'bottom-center': 'items-end justify-center',
  'bottom-right': 'items-end justify-end',
};

export default function BannerSplash({ bannerUrl, ctaPosition, ctaLabel, primaryColor, onStart, onClose }) {
  const { t } = useLang();
  const anchor = ANCHORS[ctaPosition] ?? ANCHORS['bottom-center'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      // Tapping the dimmed area behind the card dismisses it, which is what
      // every customer already expects a popup to do.
      onClick={onClose}
    >
      {/* Shrink-to-fit: the card is exactly the banner, whatever shape it is,
          capped so a tall image cannot run off a short screen. */}
      <div
        className="relative inline-block rounded-2xl overflow-hidden"
        style={{ maxWidth: 'min(90vw, 900px)', maxHeight: '82vh', boxShadow: '0 18px 60px rgba(0,0,0,0.45)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={bannerUrl}
          alt=""
          className="block"
          style={{ maxWidth: 'min(90vw, 900px)', maxHeight: '82vh', width: 'auto', height: 'auto' }}
          onError={onClose}
        />

        <button
          onClick={onClose}
          aria-label={t('common.close')}
          className="absolute flex items-center justify-center rounded-full"
          style={{
            top: 10, right: 10,
            width: 38, height: 38,
            background: 'rgba(0,0,0,0.5)',
            color: '#fff',
            border: '1.5px solid rgba(255,255,255,0.55)',
          }}
        >
          <X size={20} />
        </button>

        {/* Anchored inside the card, so the chosen corner means the corner of
            the artwork — not of a screen the operator never sees. */}
        <div className={`absolute inset-0 flex p-5 pointer-events-none ${anchor}`}>
          <button
            onClick={onStart}
            className="rounded-full font-bold active:scale-95 transition-transform pointer-events-auto"
            style={{
              background: primaryColor || 'var(--color-primary)',
              color: '#fff',
              padding: '13px 38px',
              fontSize: 18,
              boxShadow: '0 6px 22px rgba(0,0,0,0.4)',
            }}
          >
            {ctaLabel || t('splash.start')}
          </button>
        </div>
      </div>
    </div>
  );
}
