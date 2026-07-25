import { QrCode, Ticket, Percent } from 'lucide-react';

// The client-side registry of checkout access methods — the single seam a
// future method (event ticket, promo voucher, ...) plugs into. A method_key
// is meaningless without an entry here (icon + which runner executes it);
// the backend (OutletAccessMethod) only configures enabled/order/badge/copy
// for keys the client already knows, it never defines new method types.
//
// kind: 'payment' | 'verification' — used only for future outcome-column
// styling (verification methods show Gratis/Cek potongan instead of a price).
// supportedOn: capability tags required to offer the method on this client
// (e.g. ['scanner']) — empty means it works everywhere. Phase A ships QRIS
// only; useAccessMethods filters unrecognized/unsupported keys, not this file.
export const ACCESS_METHODS = {
  qris: {
    key: 'qris',
    kind: 'payment',
    icon: QrCode,
    runner: 'qris',
    supportedOn: [],
    titleKey: 'method.qris.title',
    descKey: 'method.qris.desc',
  },
  event_ticket: {
    key: 'event_ticket',
    kind: 'verification',
    icon: Ticket,
    runner: 'scan',
    supportedOn: ['scanner'],
    titleKey: 'method.ticket.title',
    descKey: 'method.ticket.desc',
  },
  promo_voucher: {
    key: 'promo_voucher',
    kind: 'verification',
    icon: Percent,
    runner: 'scan',
    supportedOn: ['scanner'],
    titleKey: 'method.voucher.title',
    descKey: 'method.voucher.desc',
  },
};
