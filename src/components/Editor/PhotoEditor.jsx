import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Text, Transformer, Group, Rect } from 'react-konva';
import useImage from 'use-image';
import { useNavigate } from 'react-router-dom';
import {
  Smile, Image as ImageIcon, Type, SlidersHorizontal,
  ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, Check,
  Plus, Minus, Pencil,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useLang } from '../../i18n/LanguageContext';
import { useHistory } from '../../hooks/useHistory';
import StickerPanel from './StickerPanel';
import TextPanel from './TextPanel';
import FilterPanel from './FilterPanel';
import FramePanel from './FramePanel';
import SlotPhotoPicker from './SlotPhotoPicker';
import EditorToolbar from './EditorToolbar';
import Button from '../common/Button';
import { useStickers } from '../../hooks/useStickers';
import { useLayoutFrames } from '../../hooks/useLayoutFrames';

const MAX_CANVAS_W = 780;
const MAX_CANVAS_H = 520;
const DEFAULT_FILTERS = { list: [], brightness: 0, contrast: 0 };

const zoomBtnStyle = {
  width: 28, height: 28,
  borderRadius: 6,
  background: 'rgba(0,0,0,0.65)',
  color: '#fff',
  border: 'none',
  cursor: 'pointer',
  fontSize: 16,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 'bold',
  lineHeight: 1,
};

function toSlotPx(slot, canvasW, canvasH) {
  return {
    x: slot.x * canvasW,
    y: slot.y * canvasH,
    w: slot.w * canvasW,
    h: slot.h * canvasH,
    rx: slot.rx * canvasW,
  };
}

function fitDimensions(natW, natH) {
  if (!natW || !natH) return { width: MAX_CANVAS_W, height: Math.round(MAX_CANVAS_W * 0.667) };
  const ratio = natW / natH;
  let w = MAX_CANVAS_W;
  let h = Math.round(w / ratio);
  if (h > MAX_CANVAS_H) {
    h = MAX_CANVAS_H;
    w = Math.round(h * ratio);
  }
  return { width: w, height: h };
}

function CanvasElement({ element, isSelected, onSelect, onChange }) {
  const shapeRef = useRef(null);
  const transformerRef = useRef(null);

  useEffect(() => {
    if (isSelected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  if (element.type === 'text') {
    return (
      <>
        <Text
          ref={shapeRef}
          {...element.attrs}
          draggable
          onClick={() => onSelect(element.id)}
          onTap={() => onSelect(element.id)}
          onDragEnd={(e) => onChange(element.id, { x: e.target.x(), y: e.target.y() })}
          onTransformEnd={() => {
            const node = shapeRef.current;
            onChange(element.id, {
              x: node.x(), y: node.y(),
              rotation: node.rotation(),
              scaleX: node.scaleX(), scaleY: node.scaleY(),
            });
          }}
        />
        {isSelected && (
          <Transformer
            ref={transformerRef}
            enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right', 'middle-right', 'middle-left']}
            boundBoxFunc={(old, next) => (next.width < 20 ? old : next)}
          />
        )}
      </>
    );
  }

  if (element.type === 'sticker') {
    return <StickerShape element={element} isSelected={isSelected} onSelect={onSelect} onChange={onChange} />;
  }

  return null;
}

function StickerShape({ element, isSelected, onSelect, onChange }) {
  const shapeRef = useRef(null);
  const transformerRef = useRef(null);
  const [image] = useImage(element.attrs.src, 'anonymous');

  useEffect(() => {
    if (isSelected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={image}
        x={element.attrs.x} y={element.attrs.y}
        width={element.attrs.width} height={element.attrs.height}
        rotation={element.attrs.rotation || 0}
        draggable
        onClick={() => onSelect(element.id)}
        onTap={() => onSelect(element.id)}
        onDragEnd={(e) => onChange(element.id, { x: e.target.x(), y: e.target.y() })}
        onTransformEnd={() => {
          const node = shapeRef.current;
          onChange(element.id, {
            x: node.x(), y: node.y(),
            width: Math.max(20, node.width() * node.scaleX()),
            height: Math.max(20, node.height() * node.scaleY()),
            rotation: node.rotation(),
            scaleX: 1, scaleY: 1,
          });
          node.scaleX(1);
          node.scaleY(1);
        }}
      />
      {isSelected && (
        <Transformer
          ref={transformerRef}
          keepRatio={true}
          boundBoxFunc={(old, next) => (next.width < 20 ? old : next)}
        />
      )}
    </>
  );
}

function BackgroundImage({ src, filters, canvasW, canvasH, onLoad }) {
  const [image, status] = useImage(src, 'anonymous');
  const imageRef = useRef(null);

  useEffect(() => {
    if (status === 'loaded') {
      if (imageRef.current) imageRef.current.cache();
      onLoad?.();
    }
  }, [image, status, filters, onLoad]);

  return (
    <KonvaImage
      ref={imageRef}
      image={image}
      x={0} y={0}
      width={canvasW} height={canvasH}
      filters={filters.list}
      brightness={filters.brightness}
      contrast={filters.contrast}
    />
  );
}

function FrameOverlay({ src, canvasW, canvasH }) {
  const [image] = useImage(src, 'anonymous');
  if (!image) return null;
  return (
    <KonvaImage
      image={image}
      x={0} y={0}
      width={canvasW}
      height={canvasH}
      listening={false}
    />
  );
}

// DOM-based watermark — lives outside the Konva canvas so stage.toDataURL()
// can never capture it. Repositions randomly every 1.2 s and pulses opacity.
function WatermarkOverlay({ canvasW, canvasH }) {
  const [pos, setPos] = useState({ x: 60, y: 60 });
  const [opacity, setOpacity] = useState(0.35);

  useEffect(() => {
    const iv = setInterval(() => {
      const col = Math.floor(Math.random() * 3);
      const row = Math.floor(Math.random() * 3);
      setPos({ x: (canvasW / 3) * col + 20, y: (canvasH / 3) * row + 20 });
    }, 1200);
    return () => clearInterval(iv);
  }, [canvasW, canvasH]);

  useEffect(() => {
    let t = 0;
    const iv = setInterval(() => {
      t += 0.12;
      setOpacity(0.25 + 0.15 * Math.abs(Math.sin(t)));
    }, 80);
    return () => clearInterval(iv);
  }, []);

  const offsets = [-240, -120, 0, 120, 240, 360];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6, overflow: 'hidden' }}>
      {offsets.map((offset) => (
        <span
          key={offset}
          style={{
            position: 'absolute',
            left: pos.x + offset * 0.9,
            top: pos.y + offset * 0.5,
            transform: 'rotate(-28deg)',
            transformOrigin: '0 0',
            fontSize: 32,
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
            color: 'white',
            opacity,
            textShadow: '0 0 6px rgba(0,0,0,0.6)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          OWNIZE PHOTO
        </span>
      ))}
    </div>
  );
}

// Clamp photo offset so it always covers the slot (no gray gaps).
function clampOffset(x, y, imgW, imgH, slotW, slotH) {
  return {
    x: Math.min(0, Math.max(x, slotW - imgW)),
    y: Math.min(0, Math.max(y, slotH - imgH)),
  };
}

// Zoom towards the slot center and return the new {scale, offsetX, offsetY}.
function zoomToCenter(oldScale, newScale, oldX, oldY, slotW, slotH, imgNatW, imgNatH) {
  const cx = slotW / 2;
  const cy = slotH / 2;
  const ratio = newScale / oldScale;
  const newX = cx - (cx - oldX) * ratio;
  const newY = cy - (cy - oldY) * ratio;
  const w = imgNatW * newScale;
  const h = imgNatH * newScale;
  const { x, y } = clampOffset(newX, newY, w, h, slotW, slotH);
  return { scale: newScale, offsetX: x, offsetY: y };
}

function getTouchDist(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function SlotPhotoLayer({ slot, slotData, photo, canvasW, canvasH, onUpdate }) {
  const [image] = useImage(photo?.proxyUrl ?? photo?.url, 'anonymous');
  const slotPx = toSlotPx(slot, canvasW, canvasH);
  const lastPinchDist = useRef(null);

  const derived = useMemo(() => {
    if (!image) return null;
    // minScale = smallest scale that still covers the slot (cover-fit)
    const minScale = Math.max(slotPx.w / image.naturalWidth, slotPx.h / image.naturalHeight);
    const scale = slotData.scale ?? minScale;
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
    // Use stored offset if available, otherwise center the photo
    const rawX = slotData.offsetX ?? (slotPx.w - w) / 2;
    const rawY = slotData.offsetY ?? (slotPx.h - h) / 2;
    const { x, y } = clampOffset(rawX, rawY, w, h, slotPx.w, slotPx.h);
    return { x, y, w, h, scale, minScale };
  }, [image, slotData, slotPx]);

  if (!image || !derived) return null;

  function applyZoom(newScale) {
    const clamped = Math.max(derived.minScale, newScale);
    return zoomToCenter(
      derived.scale, clamped,
      derived.x, derived.y,
      slotPx.w, slotPx.h,
      image.naturalWidth, image.naturalHeight,
    );
  }

  return (
    <Group
      x={slotPx.x}
      y={slotPx.y}
      clipFunc={(ctx) => {
        ctx.beginPath();
        ctx.roundRect(0, 0, slotPx.w, slotPx.h, slotPx.rx);
        ctx.closePath();
      }}
    >
      <KonvaImage
        image={image}
        x={derived.x}
        y={derived.y}
        width={derived.w}
        height={derived.h}
        draggable
        // Constrain drag so photo always covers the slot
        dragBoundFunc={(pos) => {
          const groupX = slotPx.x;
          const groupY = slotPx.y;
          const { x, y } = clampOffset(
            pos.x - groupX, pos.y - groupY,
            derived.w, derived.h, slotPx.w, slotPx.h,
          );
          return { x: x + groupX, y: y + groupY };
        }}
        onDragEnd={(e) => {
          const groupX = slotPx.x;
          const groupY = slotPx.y;
          onUpdate({ offsetX: e.target.x() - groupX, offsetY: e.target.y() - groupY });
        }}
        // Mouse wheel zoom — zooms towards slot center
        onWheel={(e) => {
          e.evt.preventDefault();
          const direction = e.evt.deltaY < 0 ? 1 : -1;
          const newScale = derived.scale * (1 + direction * 0.08);
          onUpdate(applyZoom(newScale));
        }}
        // Pinch-to-zoom for touch screens
        onTouchStart={(e) => {
          if (e.evt.touches.length === 2) {
            lastPinchDist.current = getTouchDist(e.evt.touches);
          }
        }}
        onTouchMove={(e) => {
          if (e.evt.touches.length !== 2 || !lastPinchDist.current) return;
          e.evt.preventDefault();
          const newDist = getTouchDist(e.evt.touches);
          const pinchRatio = newDist / lastPinchDist.current;
          lastPinchDist.current = newDist;
          const newScale = Math.max(derived.minScale, derived.scale * pinchRatio);
          onUpdate(applyZoom(newScale));
        }}
        onTouchEnd={() => { lastPinchDist.current = null; }}
      />
    </Group>
  );
}

const PANEL_TABS = [
  { id: 'stickers', icon: Smile,            labelKey: 'editor.tabStickers' },
  { id: 'frames',   icon: ImageIcon,        labelKey: 'editor.tabFrame' },
  { id: 'text',     icon: Type,             labelKey: 'editor.tabText' },
  { id: 'filters',  icon: SlidersHorizontal,labelKey: 'editor.tabFilters' },
];

export default function PhotoEditor() {
  const { state, dispatch } = useApp();
  const { t } = useLang();
  const navigate = useNavigate();
  const stageRef = useRef(null);

  const selectedPhotos = state.selectedPhotos;
  const photoEdits = state.photoEdits;
  const [photoIndex, setPhotoIndex] = useState(0);
  const currentPhoto = selectedPhotos[photoIndex];

  // Initialize savedEditsRef from AppContext so back-navigation restores edits
  const savedEditsRef = useRef({ ...state.photoEdits });

  // Lazy-init each piece of state from persisted edits for the first photo
  const initEdit = state.photoEdits[currentPhoto?.id] ?? {};
  const { state: elements, push: pushHistory, undo, redo, reset: resetHistory, canUndo, canRedo } = useHistory(initEdit.elements ?? []);
  const [selectedId, setSelectedId] = useState(null);
  const [activePanel, setActivePanel] = useState('stickers');
  const [filters, setFilters] = useState(initEdit.filters ?? DEFAULT_FILTERS);
  const [frame, setFrame] = useState(initEdit.frame ?? 'none');
  const [canvas, setCanvas] = useState(fitDimensions(null, null));

  const isLayoutFrame = typeof frame === 'object' && frame?.type === 'layout';
  const [layoutSlots, setLayoutSlots] = useState(() =>
    isLayoutFrame && initEdit.layoutSlots ? initEdit.layoutSlots : []
  );
  const [activeSlot, setActiveSlot] = useState(null);
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const outletId = state.deviceConfig?.outlet?.id ?? null;
  const { stickers, loading: stickersLoading } = useStickers(outletId);
  const { layoutFrames, loading: layoutFramesLoading } = useLayoutFrames(outletId);


  const frameSlots = isLayoutFrame ? (frame.slots ?? []) : [];
  const frameAspectRatio = isLayoutFrame ? (frame.aspectRatio ?? frame.aspect_ratio ?? null) : null;
  const slotsLoading = false;

  // Reset slots when switching to a different layout frame
  const prevLayoutFrameId = useRef(null);
  useEffect(() => {
    if (!isLayoutFrame) { prevLayoutFrameId.current = null; return; }
    if (frame.id !== prevLayoutFrameId.current) {
      prevLayoutFrameId.current = frame.id;
      setLayoutSlots([]);
    }
  }, [isLayoutFrame, frame]);
  const [isLoading, setIsLoading] = useState(false);
  const handleImageLoad = useCallback(() => setIsLoading(false), []);

  // Use proxyUrl (~800px degraded version) for editor display — never render the full-res original on screen.
  const photoUrl = currentPhoto?.proxyUrl ?? currentPhoto?.url;
  const orientationCache = useRef({});

  // Eagerly load dimensions for all selected photos using proxy (not full-res)
  useEffect(() => {
    selectedPhotos.forEach((photo) => {
      const src = photo.proxyUrl ?? photo.url;
      if (!src || orientationCache.current[photo.id]) return;
      const img = new Image();
      img.onload = () => {
        orientationCache.current[photo.id] = fitDimensions(img.naturalWidth, img.naturalHeight);
      };
      img.src = src;
    });
  }, [selectedPhotos]);

  // Sync canvas dimensions + loading state when current photo changes
  useEffect(() => {
    if (!photoUrl) return;
    const cached = orientationCache.current[currentPhoto.id];
    if (cached) { setCanvas(cached); return; }
    const img = new Image();
    img.onload = () => {
      const dims = fitDimensions(img.naturalWidth, img.naturalHeight);
      orientationCache.current[currentPhoto.id] = dims;
      setCanvas(dims);
      setIsLoading(false);
    };
    img.onerror = () => setIsLoading(false);
    setIsLoading(true);
    img.src = photoUrl;
  }, [photoUrl, currentPhoto?.id]);


  const layoutCanvasSize = useMemo(() => {
    if (!isLayoutFrame) return canvas;
    const ratio = frameAspectRatio;   // from JSON via hook
    let w = MAX_CANVAS_W;
    let h = Math.round(w / ratio);
    if (h > MAX_CANVAS_H) { h = MAX_CANVAS_H; w = Math.round(h * ratio); }
    return { width: w, height: h };
  }, [isLayoutFrame, frameAspectRatio, canvas]);

  const activeCanvas = isLayoutFrame ? layoutCanvasSize : canvas;

  // Export the current stage and persist edits to AppContext
  function exportAndSave() {
    // Determine whether user has actually made any edits
    const hasEdits =
      isLayoutFrame ||
      elements.length > 0 ||
      (typeof frame === 'string' ? frame !== 'none' : !!frame) ||
      filters.brightness !== 0 ||
      filters.contrast !== 0 ||
      (filters.list?.length ?? 0) > 0;

    if (!hasEdits) {
      if (currentPhoto && state.photoEdits[currentPhoto.id]) {
        dispatch({ type: 'CLEAR_PHOTO_EDIT', payload: { id: currentPhoto.id } });
      }
      return undefined;
    }

    let dataUrl;
    try {
      dataUrl = stageRef.current?.toDataURL({ pixelRatio: 2, mimeType: 'image/jpeg', quality: 0.9 });
    } catch (e) {
      console.warn('Canvas export failed (cross-origin frame?):', e);
    }

    if (isLayoutFrame) {
      dispatch({ type: 'SET_LAYOUT_EDIT', payload: { frameId: frame.id, slots: layoutSlots, elements, dataUrl } });
      if (dataUrl && currentPhoto) {
        const edit = { elements, filters, frame, dataUrl };
        savedEditsRef.current[currentPhoto.id] = edit;
        dispatch({ type: 'SET_PHOTO_EDIT', payload: { id: currentPhoto.id, data: edit } });
      }
    } else {
      const edit = { elements, filters, frame, dataUrl };
      savedEditsRef.current[currentPhoto.id] = edit;
      dispatch({ type: 'SET_PHOTO_EDIT', payload: { id: currentPhoto.id, data: edit } });
    }
    return dataUrl;
  }

  function updateLayoutSlot(slotIdx, patch) {
    setLayoutSlots((prev) => {
      const next = [...prev];
      next[slotIdx] = { ...(next[slotIdx] ?? {}), ...patch };
      return next;
    });
  }

  function openSlotPicker(slotIdx) {
    setActiveSlot(slotIdx);
    setShowSlotPicker(true);
  }

  function handlePickPhoto(photo) {
    updateLayoutSlot(activeSlot, { photoId: photo.id, offsetX: undefined, offsetY: undefined, scale: undefined });
    setShowSlotPicker(false);
    setActiveSlot(null);
  }

  function navigateTo(newIndex) {
    if (newIndex < 0 || newIndex >= selectedPhotos.length) return;

    exportAndSave();

    const saved = savedEditsRef.current[selectedPhotos[newIndex].id];
    resetHistory(saved?.elements ?? []);
    setFilters(saved?.filters ?? DEFAULT_FILTERS);
    setFrame(saved?.frame ?? 'none');
    setSelectedId(null);
    setActivePanel('stickers');

    const cached = orientationCache.current[selectedPhotos[newIndex].id];
    if (cached) setCanvas(cached);

    setPhotoIndex(newIndex);
  }

  function handleDone() {
    exportAndSave();
    navigate('/cart');
  }

  function downloadCurrentPhoto() {
    const dataUrl = stageRef.current?.toDataURL({ pixelRatio: 2, mimeType: 'image/jpeg', quality: 0.92 });
    if (!dataUrl) return;
    const edit = { elements, filters, frame, dataUrl };
    savedEditsRef.current[currentPhoto.id] = edit;
    dispatch({ type: 'SET_PHOTO_EDIT', payload: { id: currentPhoto.id, data: edit } });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `edited_photo_${photoIndex + 1}.jpg`;
    a.click();
  }

  function handleStageClick(e) {
    if (e.target === e.target.getStage()) setSelectedId(null);
  }

  const handleChange = useCallback((id, newAttrs) => {
    const updated = elements.map((el) =>
      el.id === id ? { ...el, attrs: { ...el.attrs, ...newAttrs } } : el
    );
    pushHistory(updated);
  }, [elements, pushHistory]);

  function addSticker(src) {
    pushHistory([...elements, {
      id: `sticker-${Date.now()}`,
      type: 'sticker',
      attrs: { src, x: 100, y: 100, width: 120, height: 120, rotation: 0 },
    }]);
  }

  function addText({ text, fontSize, color, fontFamily, fontStyle = 'normal', align = 'center' }) {
    pushHistory([...elements, {
      id: `text-${Date.now()}`,
      type: 'text',
      attrs: { text, fontSize, fill: color, fontFamily, fontStyle, align, x: 80, y: 80, rotation: 0, scaleX: 1, scaleY: 1 },
    }]);
  }

  function deleteSelected() {
    if (!selectedId) return;
    pushHistory(elements.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }

  function bringForward() {
    const idx = elements.findIndex((el) => el.id === selectedId);
    if (idx < elements.length - 1) {
      const arr = [...elements];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      pushHistory(arr);
    }
  }

  function sendBackward() {
    const idx = elements.findIndex((el) => el.id === selectedId);
    if (idx > 0) {
      const arr = [...elements];
      [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
      pushHistory(arr);
    }
  }

  if (!currentPhoto) {
    return (
      <div className="flex items-center justify-center h-full">
        <p style={{ color: 'var(--color-neutral-500)' }}>
          {t('editor.noPhotos')}{' '}
          <button onClick={() => navigate('/gallery')} style={{ color: 'var(--color-primary)' }}>{t('editor.goBack')}</button>
        </p>
      </div>
    );
  }

  const isLast = photoIndex === selectedPhotos.length - 1;

  return (
    <div className="flex flex-col h-full gap-3 max-w-6xl mx-auto w-full">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-black shrink-0" style={{ color: 'var(--color-neutral-900)' }}>
          {t('editor.title')}
        </h1>

        {/* Prev / counter / Next */}
        <div className="flex items-center gap-2">
          <button
            disabled={photoIndex === 0}
            onClick={() => navigateTo(photoIndex - 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
            style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)' }}
            aria-label="Previous"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-semibold px-2" style={{ color: 'var(--color-neutral-600)' }}>
            {photoIndex + 1} / {selectedPhotos.length}
          </span>
          <button
            disabled={isLast}
            onClick={() => navigateTo(photoIndex + 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
            style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)' }}
            aria-label="Next"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" onClick={() => navigate('/gallery')}>
            <ArrowLeft size={18} /> {t('editor.gallery')}
          </Button>
          <Button onClick={handleDone}>
            {isLast
              ? <>{t('editor.done')} <Check size={18} strokeWidth={3} /></>
              : <>{t('editor.next')} <ArrowRight size={18} /></>}
          </Button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: canvas + toolbar */}
        <div className="flex flex-col gap-3 flex-1 min-w-0">
          <EditorToolbar
            canUndo={canUndo} canRedo={canRedo}
            onUndo={undo} onRedo={redo}
            onDelete={deleteSelected}
            onBringForward={bringForward} onSendBackward={sendBackward}
            hasSelection={!!selectedId}
          />


          {/* Canvas */}
          <div
            className="relative overflow-hidden shrink-0"
            style={{
              width: activeCanvas.width,
              height: activeCanvas.height,
              boxShadow: 'var(--shadow-xl)',
              border: '2px solid var(--color-neutral-200)',
              alignSelf: 'center',
              transition: 'width 0.2s ease, height 0.2s ease',
            }}
          >
            {isLoading && !isLayoutFrame && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
                style={{ background: 'var(--color-neutral-100)' }}
              >
                <div
                  className="w-10 h-10 rounded-full border-4 animate-spin"
                  style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
                />
                <span className="text-xs font-semibold" style={{ color: 'var(--color-neutral-400)' }}>
                  {t('editor.loadingPhoto')}
                </span>
              </div>
            )}
            <Stage
              key={`${activeCanvas.width}x${activeCanvas.height}`}
              width={activeCanvas.width}
              height={activeCanvas.height}
              ref={stageRef}
              onMouseDown={handleStageClick}
              onTouchStart={handleStageClick}
              onContextMenu={(e) => e.evt.preventDefault()}
            >
              <Layer>
                {/* ── Normal single-photo mode ── */}
                {!isLayoutFrame && photoUrl && (
                  <BackgroundImage
                    src={photoUrl}
                    filters={filters}
                    canvasW={activeCanvas.width}
                    canvasH={activeCanvas.height}
                    onLoad={handleImageLoad}
                  />
                )}

                {/* ── Layout frame mode: slot photos (uses frameSlots from JSON hook) ── */}
                {isLayoutFrame && frameSlots.map((slot, i) => {
                  const slotData = layoutSlots[i];
                  if (!slotData?.photoId) {
                    const px = toSlotPx(slot, activeCanvas.width, activeCanvas.height);
                    return (
                      <Rect
                        key={i}
                        x={px.x} y={px.y}
                        width={px.w} height={px.h}
                        fill="#d1d5db"
                        cornerRadius={px.rx}
                        listening={false}
                      />
                    );
                  }
                  const photo = selectedPhotos.find((p) => p.id === slotData.photoId);
                  return (
                    <SlotPhotoLayer
                      key={i}
                      slot={slot}
                      slotData={slotData}
                      photo={photo}
                      canvasW={activeCanvas.width}
                      canvasH={activeCanvas.height}
                      onUpdate={(patch) => updateLayoutSlot(i, patch)}
                    />
                  );
                })}

                {elements.map((el) => (
                  <CanvasElement
                    key={el.id}
                    element={el}
                    isSelected={selectedId === el.id}
                    onSelect={setSelectedId}
                    onChange={handleChange}
                  />
                ))}

                {/* Layout frame PNG overlay (sits above slot photos) */}
                {isLayoutFrame && (
                  <FrameOverlay src={frame.src} canvasW={activeCanvas.width} canvasH={activeCanvas.height} />
                )}
              </Layer>
            </Stage>

            <WatermarkOverlay canvasW={activeCanvas.width} canvasH={activeCanvas.height} />

            {/* Moiré pattern — degrades phone camera captures of the screen */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 5,
                background: `repeating-linear-gradient(
                  45deg,
                  rgba(0,0,0,0.045) 0px,
                  transparent 1px,
                  transparent 4px,
                  rgba(0,0,0,0.045) 5px
                )`,
              }}
            />

            {/* Loading overlay while JSON slot config is being fetched */}
            {isLayoutFrame && slotsLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <div className="text-white text-sm font-semibold">{t('editor.loadingSlots')}</div>
              </div>
            )}

            {/* DOM tap targets + zoom buttons for slots in layout mode */}
            {isLayoutFrame && !slotsLoading && frameSlots.map((slot, i) => {
              const px = toSlotPx(slot, activeCanvas.width, activeCanvas.height);
              const slotData = layoutSlots[i];
              const filled = !!slotData?.photoId;

              function zoomSlot(factor) {
                const photo = selectedPhotos.find((p) => p.id === slotData?.photoId);
                if (!photo) return;
                const img = new window.Image();
                img.onload = () => {
                  const minScale = Math.max(px.w / img.naturalWidth, px.h / img.naturalHeight);
                  const oldScale = slotData?.scale ?? minScale;
                  const newScale = Math.max(minScale, oldScale * factor);
                  const oldX = slotData?.offsetX ?? (px.w - img.naturalWidth * oldScale) / 2;
                  const oldY = slotData?.offsetY ?? (px.h - img.naturalHeight * oldScale) / 2;
                  updateLayoutSlot(i, zoomToCenter(oldScale, newScale, oldX, oldY, px.w, px.h, img.naturalWidth, img.naturalHeight));
                };
                img.src = photo.proxyUrl ?? photo.url;
              }

              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: px.x, top: px.y,
                    width: px.w, height: px.h,
                    borderRadius: px.rx,
                    pointerEvents: filled ? 'none' : 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: filled ? 'transparent' : 'rgba(0,0,0,0.08)',
                    border: filled ? 'none' : '2px dashed rgba(124,58,237,0.5)',
                    cursor: filled ? 'default' : 'pointer',
                  }}
                  onClick={filled ? undefined : () => openSlotPicker(i)}
                >
                  {!filled && (
                    <div style={{ color: '#7c3aed', fontSize: 12, textAlign: 'center', pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <Plus size={20} />
                      <div>{t('editor.slot', { n: i + 1 })}</div>
                    </div>
                  )}

                  {/* Zoom controls — visible on hover for filled slots */}
                  {filled && (
                    <div
                      className="slot-controls"
                      style={{
                        position: 'absolute',
                        bottom: 6, right: 6,
                        display: 'flex',
                        gap: 4,
                        pointerEvents: 'auto',
                        opacity: 0,
                        transition: 'opacity 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                      onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); zoomSlot(1.15); }}
                        style={zoomBtnStyle}
                        title={t('editor.zoomIn')}
                        aria-label={t('editor.zoomIn')}
                      ><Plus size={16} /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); zoomSlot(1 / 1.15); }}
                        style={zoomBtnStyle}
                        title={t('editor.zoomOut')}
                        aria-label={t('editor.zoomOut')}
                      ><Minus size={16} /></button>
                      <button
                        onClick={(e) => { e.stopPropagation(); openSlotPicker(i); }}
                        style={{ ...zoomBtnStyle, background: 'rgba(124,58,237,0.85)' }}
                        title={t('editor.changePhoto')}
                        aria-label={t('editor.changePhoto')}
                      ><Pencil size={15} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Panel tab switcher */}
          <div
            className="flex gap-2 p-1.5 rounded-xl shrink-0"
            style={{ background: 'var(--color-neutral-100)' }}
          >
            {PANEL_TABS.map(({ id, icon: TabIcon, labelKey }) => (
              <button
                key={id}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95 inline-flex items-center justify-center gap-1.5"
                style={{
                  background: activePanel === id ? 'var(--color-accent)' : 'transparent',
                  color: activePanel === id ? 'var(--color-neutral-900)' : 'var(--color-neutral-600)',
                  boxShadow: activePanel === id ? 'var(--shadow-sm)' : 'none',
                }}
                onClick={() => setActivePanel(activePanel === id ? null : id)}
              >
                <TabIcon size={16} /> {t(labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Right: photo queue + active panel */}
        <div className="w-64 shrink-0 flex flex-col gap-3 min-h-0">
          {/* Photo queue */}
          <div
            className="rounded-2xl overflow-hidden shrink-0"
            style={{
              border: '1.5px solid var(--color-neutral-200)',
              background: '#fff',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <p className="text-xs font-bold px-3 pt-3 pb-2" style={{ color: 'var(--color-neutral-500)' }}>
              {t('editor.selectedPhotos')}
            </p>
            <div className="flex flex-col gap-1 px-2 pb-2 overflow-y-auto no-scrollbar" style={{ maxHeight: 300, paddingTop: 10 }}>
              {selectedPhotos.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => navigateTo(i)}
                  className="flex items-center gap-2 w-full rounded-xl p-1.5 text-left transition-all"
                  style={{
                    background: i === photoIndex ? 'var(--color-primary-50)' : 'transparent',
                    outline: i === photoIndex ? '2px solid var(--color-primary)' : '2px solid transparent',
                  }}
                >
                  <img
                    src={p.thumbnail}
                    alt=""
                    className="rounded-lg object-cover shrink-0"
                    style={{ width: 48, height: 36 }}
                  />
                  <div className="min-w-0">
                    <p
                      className="text-xs font-bold truncate"
                      style={{ color: i === photoIndex ? 'var(--color-primary)' : 'var(--color-neutral-700)' }}
                    >
                      {t('common.photoN', { n: i + 1 })}
                    </p>
                    {/* Saved edit indicator */}
                    {photoEdits[p.id]?.dataUrl && i !== photoIndex && (
                      <p className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
                        <Check size={12} strokeWidth={3} /> {t('editor.savedTag')}
                      </p>
                    )}
                    {p.label && !photoEdits[p.id]?.dataUrl && (
                      <p className="text-xs truncate" style={{ color: 'var(--color-neutral-400)' }}>{p.label}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tool panel content */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {activePanel === 'frames'   && <FramePanel activeFrame={frame} onSelect={setFrame} layoutFrames={layoutFrames} layoutLoading={layoutFramesLoading} />}
            {activePanel === 'stickers' && <StickerPanel onAdd={addSticker} stickers={stickers} loading={stickersLoading} />}
            {activePanel === 'text'     && <TextPanel onAdd={addText} />}
            {activePanel === 'filters'  && <FilterPanel filters={filters} onChange={setFilters} />}
            
            {!activePanel && (
              <div
                className="rounded-2xl p-6 flex flex-col items-center justify-center h-32 text-center"
                style={{
                  background: 'var(--color-primary-50)',
                  border: '1.5px dashed var(--color-primary-200)',
                  color: 'var(--color-primary-400)',
                }}
              >
                <p className="text-sm font-semibold">{t('editor.selectTool')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {showSlotPicker && (
        <SlotPhotoPicker
          photos={selectedPhotos}
          assignedPhotoIds={layoutSlots.filter(Boolean).map((s) => s.photoId)}
          slotIndex={activeSlot}
          onPick={handlePickPhoto}
          onClose={() => { setShowSlotPicker(false); setActiveSlot(null); }}
        />
      )}


    </div>
  );
}
