import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import { copiesOf, setCopies, MAX_COPIES } from '../../utils/printLines';
import PrintPreview from '../Print/PrintPreview';
import QtyStepper from '../Print/QtyStepper';

// "Cetak" tool: how this photo prints, and how many. Writes the same print
// lines the Pay page shows, so a count set here is already in the order there.
// Single-photo products only — a strip spans several photos and is set up on
// the Pay page, where all of them are in view.
//
// src: the photo as currently edited (rendered by the editor on open/change).
export default function PrintPanel({ products, photo, src, hasEdit }) {
  const { state, dispatch } = useApp();
  const { t } = useLang();
  const singles = products.filter((p) => p.slotCount === 1);

  if (!photo?.photo_id || !singles.length) {
    return <p className="text-sm text-center py-6" style={{ color: 'var(--color-neutral-600)' }}>{t('editor.printUnavailable')}</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {singles.map((product) => {
        const copies = copiesOf(state.printItems, product.printType, photo.photo_id);
        return (
          <div key={product.printType} className="raised-tile rounded-2xl p-3 flex items-center gap-4">
            <PrintPreview
              templateVersion={product.template.currentVersion}
              srcs={[src]}
              outletName={state.deviceConfig?.outlet?.name}
              className="h-28 w-auto max-w-[45%] rounded-md shrink-0"
            />
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              <span>
                <span className="block font-black" style={{ color: 'var(--color-neutral-900)' }}>{t(product.labelKey)}</span>
                <span className="block text-sm font-bold" style={{ color: 'var(--color-accent-700)' }}>
                  Rp {product.price.toLocaleString('id-ID')} <span className="font-normal" style={{ color: 'var(--color-neutral-600)' }}>/ {t('editor.printEach')}</span>
                </span>
              </span>
              <QtyStepper
                value={copies}
                max={MAX_COPIES}
                onChange={(n) => dispatch({
                  type: 'SET_PRINT_ITEMS',
                  payload: setCopies(state.printItems, {
                    printType: product.printType,
                    photoId: photo.photo_id,
                    source: hasEdit ? 'edited' : 'original',
                    copies: n,
                    price: product.price,
                  }),
                })}
              />
            </div>
          </div>
        );
      })}
      <p className="text-xs text-center" style={{ color: 'var(--color-neutral-600)' }}>{t('editor.printHint')}</p>
    </div>
  );
}
