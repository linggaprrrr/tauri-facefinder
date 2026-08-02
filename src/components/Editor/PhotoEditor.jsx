import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Text, Transformer, Group, Rect } from 'react-konva';
import useImage from 'use-image';
import { useNavigate } from 'react-router-dom';
import {
  Smile, Image as ImageIcon, Type, SlidersHorizontal, Sparkles,
  ChevronLeft, ChevronRight, ArrowLeft, ArrowRight, Check,
  Plus, Minus, Pencil, MousePointer, Loader2, Lock, QrCode,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { readCachedBranding } from '../../hooks/useBranding';
import { useLang } from '../../i18n/LanguageContext';
import { useHistory } from '../../hooks/useHistory';
import StickerPanel from './StickerPanel';
import TextPanel from './TextPanel';
import FilterPanel from './FilterPanel';
import FramePanel from './FramePanel';
import SlotPhotoPicker from './SlotPhotoPicker';
import UploadPanel from './UploadPanel';
import PhoneUploadModal from './PhoneUploadModal';
import EditorToolbar from './EditorToolbar';
import { useSessionUploads } from '../../hooks/useSessionUploads';
import { sessionUploadUrl } from '../../api/mockApi';
import { renderQrToDataUrl } from '../../utils/renderQrToDataUrl';
import Button from '../common/Button';
import { useStickers } from '../../hooks/useStickers';
import { useLayoutFrames } from '../../hooks/useLayoutFrames';
import { useIsMobile } from '../../hooks/useIsMobile';
import AiTransformPanel from './AiTransformPanel';
import AiResultModal from './AiResultModal';
import AiJobPill from './AiJobPill';
import { useAiTemplates } from '../../hooks/useAiTemplates';
import { aiTransform, createCompositePhoto, ApiError } from '../../api/mockApi';

// Desktop ceilings. On mobile these are overridden by the viewport (see component).
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

function fitDimensions(natW, natH, maxW = MAX_CANVAS_W, maxH = MAX_CANVAS_H) {
  if (!natW || !natH) return { width: maxW, height: Math.round(maxW * 0.667) };
  const ratio = natW / natH;
  let w = maxW;
  let h = Math.round(w / ratio);
  if (h > maxH) {
    h = maxH;
    w = Math.round(h * ratio);
  }
  return { width: w, height: h };
}

// A locked element stays *selectable* on purpose — you have to be able to pick
// it to unlock it, and selecting is also how the lock announces itself. What
// locking removes is drag, resize, rotate, delete and restacking. Reusing the
// Transformer with its handles switched off gives the "locked" chrome (a grey
// dashed box) for free, and it keeps tracking the node like it always did.
function lockedTransformerProps(locked) {
  return locked
    ? { resizeEnabled: false, rotateEnabled: false, enabledAnchors: [], borderStroke: '#6C757D', borderDash: [6, 4] }
    : {};
}

// A Transformer is a node ON the stage, so toDataURL() bakes the selection
// handles into the exported image whenever an element is still selected — the
// customer's photo then carries blue squares into the cart, the print and the
// download. Hiding beats deselecting: clearing React state wouldn't have
// repainted the stage before this synchronous export ran anyway.
const EXPORT_OPTS = { pixelRatio: 2, mimeType: 'image/jpeg', quality: 0.9 };
function exportStage(stage) {
  if (!stage) return undefined;
  const transformers = stage.find('Transformer').filter((tr) => tr.isVisible());
  transformers.forEach((tr) => tr.hide());
  stage.batchDraw();
  try {
    return stage.toDataURL(EXPORT_OPTS);
  } finally {
    transformers.forEach((tr) => tr.show());
    stage.batchDraw();
  }
}

function CanvasElement({ element, isSelected, onSelect, onChange }) {
  const shapeRef = useRef(null);
  const transformerRef = useRef(null);
  const locked = !!element.locked;

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
          draggable={!locked}
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
            {...lockedTransformerProps(locked)}
          />
        )}
      </>
    );
  }

  if (element.type === 'sticker') {
    return <StickerShape element={element} isSelected={isSelected} onSelect={onSelect} onChange={onChange} />;
  }

  if (element.type === 'upload') {
    return <UploadShape element={element} isSelected={isSelected} onSelect={onSelect} onChange={onChange} />;
  }

  return null;
}

// An Upload Photo placeholder. Before the customer's phone delivers anything
// it draws its own QR; once `attrs.src` arrives it behaves exactly like a
// sticker, so the fill is a one-prop change rather than a second code path.
function UploadShape({ element, isSelected, onSelect, onChange }) {
  const shapeRef = useRef(null);
  const transformerRef = useRef(null);
  const locked = !!element.locked;
  const { x, y, width, height, rotation = 0, src, qrDataUrl } = element.attrs;
  const [photo] = useImage(src ?? '', 'anonymous');
  const [qr] = useImage(qrDataUrl ?? '', 'anonymous');

  useEffect(() => {
    if (isSelected && transformerRef.current && shapeRef.current) {
      transformerRef.current.nodes([shapeRef.current]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [isSelected, photo]);

  const commit = () => {
    const node = shapeRef.current;
    onChange(element.id, {
      x: node.x(), y: node.y(),
      width: Math.max(40, node.width() * node.scaleX()),
      height: Math.max(40, node.height() * node.scaleY()),
      rotation: node.rotation(),
    });
    node.scaleX(1);
    node.scaleY(1);
  };

  return (
    <>
      <Group
        ref={shapeRef}
        x={x} y={y} width={width} height={height} rotation={rotation}
        draggable={!locked}
        onClick={() => onSelect(element.id)}
        onTap={() => onSelect(element.id)}
        onDragEnd={(e) => onChange(element.id, { x: e.target.x(), y: e.target.y() })}
        onTransformEnd={commit}
      >
        {photo ? (
          <KonvaImage image={photo} width={width} height={height} />
        ) : (
          <>
            {/* Waiting state: a dashed frame with the QR centred in it. */}
            <Rect
              width={width} height={height} cornerRadius={12}
              fill="#ffffff" stroke="#017DC5" strokeWidth={2} dash={[8, 6]}
            />
            {qr && (
              <KonvaImage
                image={qr}
                x={(width - Math.min(width, height) * 0.62) / 2}
                y={(height - Math.min(width, height) * 0.62) / 2}
                width={Math.min(width, height) * 0.62}
                height={Math.min(width, height) * 0.62}
              />
            )}
          </>
        )}
      </Group>
      {isSelected && (
        <Transformer
          ref={transformerRef}
          keepRatio={false}
          boundBoxFunc={(old, next) => (next.width < 40 || next.height < 40 ? old : next)}
          {...lockedTransformerProps(locked)}
        />
      )}
    </>
  );
}

function StickerShape({ element, isSelected, onSelect, onChange }) {
  const shapeRef = useRef(null);
  const transformerRef = useRef(null);
  const [image] = useImage(element.attrs.src, 'anonymous');
  const locked = !!element.locked;

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
        draggable={!locked}
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
          {...lockedTransformerProps(locked)}
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
      onLoad?.(image.naturalWidth, image.naturalHeight);
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

function clampOffset(x, y, imgW, imgH, slotW, slotH) {
  return {
    x: Math.min(0, Math.max(x, slotW - imgW)),
    y: Math.min(0, Math.max(y, slotH - imgH)),
  };
}

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
    const minScale = Math.max(slotPx.w / image.naturalWidth, slotPx.h / image.naturalHeight);
    const scale = slotData.scale ?? minScale;
    const w = image.naturalWidth * scale;
    const h = image.naturalHeight * scale;
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
        x={derived.x} y={derived.y}
        width={derived.w} height={derived.h}
        draggable
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
        onWheel={(e) => {
          e.evt.preventDefault();
          const direction = e.evt.deltaY < 0 ? 1 : -1;
          const newScale = derived.scale * (1 + direction * 0.08);
          onUpdate(applyZoom(newScale));
        }}
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

// ── Sidebar tool definitions ───────────────────────────────────────────────
const SIDEBAR_TOOLS = [
  { id: 'stickers', icon: Smile,             labelKey: 'editor.tabStickers' },
  { id: 'frames',   icon: ImageIcon,         labelKey: 'editor.tabFrame' },
  { id: 'text',     icon: Type,              labelKey: 'editor.tabText' },
  { id: 'upload',   icon: QrCode,            labelKey: 'editor.tabUpload' },
  { id: 'filters',  icon: SlidersHorizontal, labelKey: 'editor.tabFilters' },
  { id: 'ai',       icon: Sparkles,          labelKey: 'editor.tabAi' },
];

// Module-level counter so in-flight AI promises are correctly superseded even
// when PhotoEditor unmounts and remounts (navigation away and back).
const aiJobRef = { current: 0 };

export default function PhotoEditor() {
  const { state, dispatch } = useApp();
  const { t } = useLang();
  const navigate = useNavigate();
  const stageRef = useRef(null);
  const isMobile = useIsMobile();

  // Canvas must fit the phone viewport (the desktop 780×520 overflows badly).
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 800,
  }));
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const maxCanvasW = isMobile ? Math.max(200, viewport.w - 24) : MAX_CANVAS_W;
  const maxCanvasH = isMobile ? Math.max(220, Math.round(viewport.h * 0.42)) : MAX_CANVAS_H;

  const selectedPhotos = state.selectedPhotos;
  const photoEdits = state.photoEdits;
  const aiTransformUsed = state.aiTransformUsed;
  const aiJob = state.aiJob;
  const [photoIndex, setPhotoIndex] = useState(0);
  const currentPhoto = selectedPhotos[photoIndex];
  // Derived photos (AI result, collage) can't be re-transformed or re-framed.
  const currentIsDerived = !!(currentPhoto?.isAiGenerated || currentPhoto?.isComposite);
  // face_count comes from the search-by-face response (total faces in photo from photo_faces table).
  const currentPhotoFaceCount = currentPhoto?.face_count ?? 1;

  const savedEditsRef = useRef({ ...state.photoEdits });

  const initEdit = state.photoEdits[currentPhoto?.id] ?? {};
  const { state: elements, push: pushHistory, undo, redo, reset: resetHistory, canUndo, canRedo } = useHistory(initEdit.elements ?? []);
  const [selectedId, setSelectedId] = useState(null);
  // Admin-configured per outlet (Branding Kiosk modal), boot-cached same as
  // colours/images — a toggle lands next reboot, not mid-session.
  const disabledTools = readCachedBranding(state.deviceConfig.outlet?.id)?.disabled_tools ?? [];
  const visibleSidebarTools = SIDEBAR_TOOLS.filter(({ id }) => !disabledTools.includes(id));
  // 'stickers' is the usual default panel (on load and whenever the editor
  // resets to a neutral tool), but if an outlet has disabled exactly that
  // tool, fall back to whatever's first available instead of landing on a
  // panel with no matching sidebar button.
  const defaultPanel = disabledTools.includes('stickers') ? (visibleSidebarTools[0]?.id ?? null) : 'stickers';
  const [activePanel, setActivePanel] = useState(defaultPanel);
  const [filters, setFilters] = useState(initEdit.filters ?? DEFAULT_FILTERS);
  const [frame, setFrame] = useState(initEdit.frame ?? 'none');
  const [canvas, setCanvas] = useState(fitDimensions(null, null));

  const isLayoutFrame = typeof frame === 'object' && frame?.type === 'layout';
  const [layoutSlots, setLayoutSlots] = useState(() =>
    isLayoutFrame && initEdit.layoutSlots ? initEdit.layoutSlots : []
  );
  const [activeSlot, setActiveSlot] = useState(null);
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  // aiJob lives in global state (AppContext) — survives navigation away and back.
  const [aiResultOpen, setAiResultOpen] = useState(false);
  const [showDoneWarning, setShowDoneWarning] = useState(false);
  const [committingFrame, setCommittingFrame] = useState(false); // collage → new output upload

  // When navigating back to the editor with a completed AI job, re-open the result modal.
  useEffect(() => {
    if (aiJob?.status === 'ready') setAiResultOpen(true);
  }, [aiJob?.status]);
  const outletId = state.deviceConfig?.outlet?.id ?? null;
  const { stickers, loading: stickersLoading } = useStickers(outletId);
  const { layoutFrames, loading: layoutFramesLoading } = useLayoutFrames(outletId);
  const { templates: aiTemplates, loading: aiTemplatesLoading } = useAiTemplates(outletId);

  const frameSlots = isLayoutFrame ? (frame.slots ?? []) : [];
  const frameAspectRatio = isLayoutFrame ? (frame.aspectRatio ?? frame.aspect_ratio ?? null) : null;
  const slotsLoading = false;

  const prevLayoutFrameId = useRef(null);
  useEffect(() => {
    if (!isLayoutFrame) { prevLayoutFrameId.current = null; return; }
    if (frame.id !== prevLayoutFrameId.current) {
      prevLayoutFrameId.current = frame.id;
      setLayoutSlots([]);
    }
  }, [isLayoutFrame, frame]);

  const [isLoading, setIsLoading] = useState(true);
  const photoUrl = currentPhoto?.proxyUrl ?? currentPhoto?.url;
  const orientationCache = useRef({});

  // Canvas sizing comes from the SAME image BackgroundImage renders (its
  // onLoad reports naturalWidth/Height) — not a separate probe fetch. Two
  // independent fetches of the same photo can resolve in either order, and
  // if the render fetch wins, the photo paints before canvas has corrected
  // to its real aspect ratio, stretching it into the wrong-shaped box.
  const handleImageLoad = useCallback((natW, natH) => {
    orientationCache.current[currentPhoto.id] = { natW, natH };
    setCanvas(fitDimensions(natW, natH, maxCanvasW, maxCanvasH));
    setIsLoading(false);
  }, [currentPhoto?.id, maxCanvasW, maxCanvasH]);

  useEffect(() => {
    selectedPhotos.forEach((photo) => {
      const src = photo.proxyUrl ?? photo.url;
      if (!src || orientationCache.current[photo.id]) return;
      const img = new Image();
      img.onload = () => {
        // Cache natural size, not fitted dims, so canvas can re-fit on resize.
        orientationCache.current[photo.id] = { natW: img.naturalWidth, natH: img.naturalHeight };
      };
      img.src = src;
    });
  }, [selectedPhotos]);

  useEffect(() => {
    if (!photoUrl) return;
    const cached = orientationCache.current[currentPhoto.id];
    if (cached) {
      setCanvas(fitDimensions(cached.natW, cached.natH, maxCanvasW, maxCanvasH));
      return;
    }
    // Not yet known — leave canvas at its current size and let
    // handleImageLoad correct it once the real image reports its dimensions.
    setIsLoading(true);
  }, [photoUrl, currentPhoto?.id, maxCanvasW, maxCanvasH]);

  const layoutCanvasSize = useMemo(() => {
    if (!isLayoutFrame) return canvas;
    const ratio = frameAspectRatio;
    let w = maxCanvasW;
    let h = Math.round(w / ratio);
    if (h > maxCanvasH) { h = maxCanvasH; w = Math.round(h * ratio); }
    return { width: w, height: h };
  }, [isLayoutFrame, frameAspectRatio, canvas, maxCanvasW, maxCanvasH]);

  const activeCanvas = isLayoutFrame ? layoutCanvasSize : canvas;

  function exportAndSave() {
    // A layout frame (collage) is NOT a per-photo edit — it's committed as its own
    // new output via commitCollage(). Never persist it onto the current photo.
    if (isLayoutFrame) return undefined;

    const hasEdits =
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
      dataUrl = exportStage(stageRef.current);
    } catch (e) {
      console.warn('Canvas export failed (cross-origin frame?):', e);
    }

    const edit = { elements, filters, frame, dataUrl };
    savedEditsRef.current[currentPhoto.id] = edit;
    dispatch({ type: 'SET_PHOTO_EDIT', payload: { id: currentPhoto.id, data: edit } });
    return dataUrl;
  }

  // Commit the in-progress collage as a NEW free output. Uploads the render so the
  // backend persists it as a Photo; originals are left untouched.
  async function commitCollage() {
    if (!isLayoutFrame || committingFrame) return;
    let dataUrl;
    try {
      dataUrl = exportStage(stageRef.current);
    } catch (e) {
      console.warn('Collage export failed (cross-origin?):', e);
    }
    if (!dataUrl) return;

    setCommittingFrame(true);
    try {
      const stickerIds = [...new Set(
        elements.filter((el) => el.type === 'sticker' && el.stickerId).map((el) => el.stickerId)
      )];
      const result = await createCompositePhoto({
        outletId,
        sourcePhotoId: currentPhoto?.photo_id ?? null,
        imageBase64: dataUrl,
        templateId: isLayoutFrame ? frame.id : null,
        stickerIds: stickerIds.length ? stickerIds : null,
      });
      const newIndex = selectedPhotos.length; // appended at end by ADD_COMPOSITE_PHOTO
      dispatch({
        type: 'ADD_COMPOSITE_PHOTO',
        payload: { url: result.image_url, photoId: result.photo_id, filename: frame?.label ? `Frame · ${frame.label}` : 'Frame' },
      });
      // Reset the frame on the current photo and jump to the new collage output.
      setFrame('none');
      setLayoutSlots([]);
      setSelectedId(null);
      setActivePanel(defaultPanel);
      setPhotoIndex(newIndex);
    } catch (err) {
      console.error('Failed to commit collage:', err);
      window.alert(t('frame.commitError'));
    } finally {
      setCommittingFrame(false);
    }
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
    setActivePanel(defaultPanel);
    const cached = orientationCache.current[selectedPhotos[newIndex].id];
    if (cached) setCanvas(fitDimensions(cached.natW, cached.natH, maxCanvasW, maxCanvasH));
    setPhotoIndex(newIndex);
  }

  function handleDone() {
    if (aiJob?.status === 'pending') {
      setShowDoneWarning(true);
      return;
    }
    exportAndSave();
    navigate('/cart');
  }

  function confirmDone() {
    setShowDoneWarning(false);
    exportAndSave();
    navigate('/cart');
  }

  // Kick off a background AI generation. Customer keeps editing while it runs.
  async function startAiJob(template) {
    if (aiJob?.status === 'pending' || aiTransformUsed || currentIsDerived) return;
    // Always source the clean original photo — never the manually-edited canvas
    // (stickers/frames) and never another AI result.
    const originalUrl = currentPhoto?.url ?? currentPhoto?.proxyUrl;
    const jobId = ++aiJobRef.current;
    const sourcePhotoId = currentPhoto?.photo_id ?? null;
    setAiResultOpen(false);
    dispatch({ type: 'SET_AI_JOB', payload: { status: 'pending', template, originalUrl } });
    try {
      const result = await aiTransform({ outletId, photoUrl: originalUrl, templateId: template.id, sourcePhotoId });
      if (aiJobRef.current !== jobId) return; // superseded / dismissed
      dispatch({ type: 'SET_AI_JOB', payload: { status: 'ready', template, originalUrl, resultUrl: result.image_url, resultPhotoId: result.photo_id ?? null } });
      setAiResultOpen(true);
    } catch (err) {
      if (aiJobRef.current !== jobId) return;
      // Quota is never consumed here — only acceptAiResult() spends it. A failed
      // generation always leaves the free transform available for another try.
      let msg = t('ai.errorGeneric');
      let canRetry = true; // transient errors (network/timeout) are worth retrying
      if (err instanceof ApiError && err.kind === 'timeout') {
        msg = t('ai.errorTimeout');
        canRetry = true;
      } else if (err instanceof ApiError && err.kind === 'rate_limit') {
        msg = t('ai.errorRateLimit');
        canRetry = false;
      } else if (err instanceof ApiError && err.status === 502) {
        // Backend couldn't produce an image (Gemini refused / returned nothing).
        // Retrying the same template+photo won't help — guide to another choice.
        msg = t('ai.errorTemplate');
        canRetry = false;
      }
      dispatch({ type: 'SET_AI_JOB', payload: { status: 'error', template, originalUrl, errorMsg: msg, canRetry } });
    }
  }

  // Keep the result — only HERE is the free transform consumed.
  function acceptAiResult() {
    if (aiJob?.status !== 'ready') return;
    const newIndex = selectedPhotos.length; // appended at end by ADD_AI_PHOTO
    dispatch({
      type: 'ADD_AI_PHOTO',
      payload: {
        url: aiJob.resultUrl,
        photoId: aiJob.resultPhotoId,   // real Photo row id from the backend → checkout works
        price: 0,                        // AI photo is free; the free transform covers it
        filename: aiJob.template?.label ? `AI · ${aiJob.template.label}` : 'AI Photo',
        sourcePhotoId: currentPhoto?.photo_id ?? null,
      },
    });
    aiJobRef.current++;
    setAiResultOpen(false);
    dispatch({ type: 'SET_AI_JOB', payload: null });
    setPhotoIndex(newIndex); // jump to the new AI photo so the customer sees it
  }

  // Discard / try another / dismiss — does NOT consume the free transform.
  function dismissAiJob() {
    aiJobRef.current++; // invalidate any in-flight request
    setAiResultOpen(false);
    dispatch({ type: 'SET_AI_JOB', payload: null });
  }

  function retryAiJob() {
    const tpl = aiJob?.template;
    if (tpl) startAiJob(tpl);
  }

  function handleStageClick(e) {
    if (e.target === e.target.getStage()) setSelectedId(null);
  }

  // The single chokepoint every geometry change routes through, so guarding
  // here covers drag, resize and rotate at once — and any future caller that
  // forgets the element might be locked.
  const handleChange = useCallback((id, newAttrs) => {
    if (elements.find((el) => el.id === id)?.locked) return;
    const updated = elements.map((el) =>
      el.id === id ? { ...el, attrs: { ...el.attrs, ...newAttrs } } : el
    );
    pushHistory(updated);
  }, [elements, pushHistory]);

  function addSticker({ src, stickerId }) {
    pushHistory([...elements, {
      id: `sticker-${Date.now()}`,
      type: 'sticker',
      stickerId: stickerId ?? null,
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

  // ── Upload Photo placeholders ──────────────────────────────────────────────
  // Poll only while at least one placeholder is still empty; the hook idles
  // once this list is empty.
  // { slotId, qrDataUrl } while the QR modal is open. The QR is deliberately
  // not an element: the canvas should only ever hold the finished photo.
  const [pendingUpload, setPendingUpload] = useState(null);
  const [committingUpload, setCommittingUpload] = useState(false);
  const [uploadedToListCount, setUploadedToListCount] = useState(0);
  const pendingUploadSlots = [
    // Placeholders from an earlier build of this feature still fill in.
    ...elements.filter((el) => el.type === 'upload' && !el.attrs.src).map((el) => el.attrs.slotId),
    ...(pendingUpload ? [pendingUpload.slotId] : []),
  ];
  const sessionUploads = useSessionUploads(state.uploadSessionId, pendingUploadSlots);

  // The arriving photo is merged at render time rather than written back into
  // history: it keeps this out of an effect (no cascading setState), keeps undo
  // meaning "what the customer did", and lets a re-upload from the phone
  // replace the image without a second history entry.
  const renderElements = elements.map((el) => (
    el.type === 'upload' && !el.attrs.src && sessionUploads[el.attrs.slotId]
      ? { ...el, attrs: { ...el.attrs, src: sessionUploads[el.attrs.slotId] } }
      : el
  ));
  const awaitingUploadCount =
    renderElements.filter((el) => el.type === 'upload' && !el.attrs.src).length + (committingUpload ? 1 : 0);

  // layoutSlotIdx targets a frame slot instead of dropping a floating sticker
  // onto the free canvas — same QR/poll plumbing, different landing spot.
  async function startPhoneUpload(layoutSlotIdx = null) {
    const slotId = `up${Date.now().toString(36)}`;
    const url = sessionUploadUrl(state.uploadSessionId, slotId);
    const qrDataUrl = await renderQrToDataUrl(url, 320).catch(() => null);
    setPendingUpload({ slotId, qrDataUrl, layoutSlotIdx });
  }

  // Outside a frame, the phone photo becomes its own new photo in the
  // filmstrip — editable and printable on its own — rather than a decorative
  // overlay on whatever the customer happened to have open. Reuses the same
  // composite-commit endpoint a frame collage uses to get a real backend
  // photo_id, since checkout can't resolve a line item without one.
  async function commitUploadAsNewPhoto(src) {
    setCommittingUpload(true);
    try {
      const blob = await fetch(src).then((r) => r.blob());
      const imageBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const result = await createCompositePhoto({ outletId, sourcePhotoId: null, imageBase64, templateId: null, stickerIds: null });
      const newIndex = selectedPhotos.length;
      dispatch({ type: 'ADD_COMPOSITE_PHOTO', payload: { url: result.image_url, photoId: result.photo_id, filename: 'Foto Sendiri' } });
      setUploadedToListCount((n) => n + 1);
      setPhotoIndex(newIndex);
    } catch (err) {
      console.error('Failed to add phone upload as a new photo:', err);
      window.alert(t('frame.commitError'));
    } finally {
      setCommittingUpload(false);
    }
  }

  // The photo lands whenever the phone finishes uploading, so this has to be
  // an effect. Clearing pendingUpload closes the modal and drops the slot out
  // of the poll list in the same commit.
  useEffect(() => {
    if (!pendingUpload) return;
    const src = sessionUploads[pendingUpload.slotId];
    if (!src) return;
    if (pendingUpload.layoutSlotIdx != null) {
      updateLayoutSlot(pendingUpload.layoutSlotIdx, { photoId: null, uploadSrc: src, offsetX: undefined, offsetY: undefined, scale: undefined });
      setPendingUpload(null);
    } else {
      setPendingUpload(null);
      commitUploadAsNewPhoto(src);
    }
  }, [sessionUploads, pendingUpload, elements, pushHistory]);

  const selectedElement = elements.find((el) => el.id === selectedId) ?? null;
  const isSelectionLocked = !!selectedElement?.locked;

  function toggleLock() {
    if (!selectedId) return;
    // Stays selected afterwards — locking something and having it deselect
    // would make the toggle feel like it did something else.
    pushHistory(elements.map((el) => (el.id === selectedId ? { ...el, locked: !el.locked } : el)));
  }

  function deleteSelected() {
    if (!selectedId || isSelectionLocked) return;
    pushHistory(elements.filter((el) => el.id !== selectedId));
    setSelectedId(null);
  }

  // Restacking is locked too. It isn't in the "move/resize/rotate/delete" list,
  // but a watermark a customer can send behind the photo is an unlocked
  // watermark — z-order is the whole point of locking decorations.
  function bringForward() {
    if (isSelectionLocked) return;
    const idx = elements.findIndex((el) => el.id === selectedId);
    if (idx < elements.length - 1) {
      const arr = [...elements];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      pushHistory(arr);
    }
  }

  function sendBackward() {
    if (isSelectionLocked) return;
    const idx = elements.findIndex((el) => el.id === selectedId);
    if (idx > 0) {
      const arr = [...elements];
      [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
      pushHistory(arr);
    }
  }

  // Toggle sidebar tool — clicking active tool collapses panel
  function handleSidebarTool(id) {
    setActivePanel((prev) => (prev === id ? null : id));
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
  const activeTool = SIDEBAR_TOOLS.find((s) => s.id === activePanel);

  return (
    <div className="flex flex-col h-full gap-3 max-w-6xl mx-auto w-full">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between gap-2 sm:gap-4 shrink-0 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black shrink-0 on-bg-text" style={{ color: 'var(--color-neutral-900)' }}>
            {t('editor.title')}
          </h1>
          {/* neutral-600, not 400: this sits directly on the outlet's
              background photo, where a near-white grey vanished entirely. */}
          <p className="hidden sm:block text-sm mt-0.5 on-bg-text" style={{ color: 'var(--color-neutral-600)' }}>
            {t('editor.subtitle')}
          </p>
        </div>

        {/* Photo counter nav */}
        <div
          className="flex items-center gap-1.5 sm:gap-2 rounded-xl px-2 sm:px-3 py-1.5 sm:py-2 shrink-0"
          style={{ background: 'var(--color-neutral-100)', border: '1.5px solid var(--color-neutral-200)' }}
        >
          <button
            disabled={photoIndex === 0}
            onClick={() => navigateTo(photoIndex - 1)}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
            style={{ background: 'white', border: '1.5px solid var(--color-neutral-200)', color: 'var(--color-neutral-600)' }}
            aria-label="Previous"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-bold px-1" style={{ color: 'var(--color-neutral-700)', minWidth: 40, textAlign: 'center' }}>
            {photoIndex + 1} / {selectedPhotos.length}
          </span>
          <button
            disabled={isLast}
            onClick={() => navigateTo(photoIndex + 1)}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-30"
            style={{ background: 'white', border: '1.5px solid var(--color-neutral-200)', color: 'var(--color-neutral-600)' }}
            aria-label="Next"
          >
            <ChevronRight size={18} />
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

      {/* ── Main body: 3-column on desktop, stacked on mobile ── */}
      <div
        className="flex-1 min-h-0 no-scrollbar"
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '64px 1fr 248px',
          gap: 12,
          overflowY: isMobile ? 'auto' : 'visible',
        }}
      >
        {/* ── Tool icons: vertical sidebar on desktop, horizontal bar on mobile ── */}
        <div
          className="flex flex-row sm:flex-col items-center gap-1 px-2 sm:px-0 py-2 sm:py-3 rounded-xl shrink-0 overflow-x-auto sm:overflow-visible no-scrollbar"
          style={{
            background: '#fff',
            border: '1.5px solid var(--color-neutral-200)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {visibleSidebarTools.map(({ id, icon: Icon, labelKey }) => {
            const isActive = activePanel === id;
            return (
              <button
                key={id}
                onClick={() => handleSidebarTool(id)}
                aria-label={t(labelKey)}
                aria-pressed={isActive}
                className="relative flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all active:scale-90"
                style={{
                  width: 52, height: 52,
                  background: isActive ? 'var(--color-accent-light, #fff7ed)' : 'transparent',
                  color: isActive ? 'var(--color-neutral-900)' : 'var(--color-neutral-400)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {/* Active left-edge indicator */}
                {isActive && (
                  <span
                    className="absolute"
                    style={{
                      left: -7, top: '50%', transform: 'translateY(-50%)',
                      width: 3, height: 22,
                      background: 'var(--color-accent)',
                      borderRadius: 2,
                    }}
                  />
                )}
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 500, lineHeight: 1, letterSpacing: 0.2 }}>
                  {t(labelKey)}
                </span>
              </button>
            );
          })}

          {/* Divider (horizontal sidebar hides it on mobile) */}
          <div
            className="hidden sm:block my-1 w-6 shrink-0"
            style={{ height: 1, background: 'var(--color-neutral-200)' }}
          />

          {/* No-tool / deselect mode */}
          <button
            onClick={() => setActivePanel(null)}
            aria-label="Pilih elemen di canvas"
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all active:scale-90"
            style={{
              width: 52, height: 52,
              background: !activePanel ? 'var(--color-primary-50)' : 'transparent',
              color: !activePanel ? 'var(--color-primary)' : 'var(--color-neutral-400)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <MousePointer size={18} strokeWidth={!activePanel ? 2.5 : 1.8} />
            <span style={{ fontSize: 9, fontWeight: !activePanel ? 700 : 500, lineHeight: 1, letterSpacing: 0.2 }}>
              {t('editor.toolSelect')}
            </span>
          </button>
        </div>

        {/* ── Center: toolbar + canvas + filmstrip ── */}
        <div className="flex flex-col gap-3 min-w-0">

          {/* Toolbar */}
          <EditorToolbar
            canUndo={canUndo} canRedo={canRedo}
            onUndo={undo} onRedo={redo}
            onDelete={deleteSelected}
            onBringForward={bringForward} onSendBackward={sendBackward}
            onToggleLock={toggleLock}
            hasSelection={!!selectedId} isLocked={isSelectionLocked}
          />

          {/* Contextual hint — why the controls are dead is more useful than
              the generic prompt, so the locked case wins when both apply. */}
          {isSelectionLocked ? (
            <p
              className="text-xs font-medium text-center py-1 rounded-lg flex items-center justify-center gap-1.5"
              style={{
                color: 'var(--color-warning)',
                background: 'var(--color-warning-bg)',
                border: '1px dashed var(--color-warning)',
              }}
            >
              <Lock size={13} /> {t('editor.hintLocked')}
            </p>
          ) : !selectedId && (
            <p
              className="text-xs font-medium text-center py-1 rounded-lg"
              style={{
                color: 'var(--color-neutral-400)',
                background: 'var(--color-neutral-50)',
                border: '1px dashed var(--color-neutral-200)',
              }}
            >
              💡 {t('editor.hintSelectEl')}
            </p>
          )}

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
              borderRadius: 8,
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
                {!isLayoutFrame && photoUrl && (
                  <BackgroundImage
                    src={photoUrl}
                    filters={filters}
                    canvasW={activeCanvas.width}
                    canvasH={activeCanvas.height}
                    onLoad={handleImageLoad}
                  />
                )}

                {isLayoutFrame && frameSlots.map((slot, i) => {
                  const slotData = layoutSlots[i];
                  if (!slotData?.photoId && !slotData?.uploadSrc) {
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
                  const photo = slotData.uploadSrc
                    ? { url: slotData.uploadSrc, proxyUrl: slotData.uploadSrc }
                    : selectedPhotos.find((p) => p.id === slotData.photoId);
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

                {renderElements.map((el) => (
                  <CanvasElement
                    key={el.id}
                    element={el}
                    isSelected={selectedId === el.id}
                    onSelect={setSelectedId}
                    onChange={handleChange}
                  />
                ))}

                {isLayoutFrame && (
                  <FrameOverlay src={frame.src} canvasW={activeCanvas.width} canvasH={activeCanvas.height} />
                )}
              </Layer>
            </Stage>

            <WatermarkOverlay canvasW={activeCanvas.width} canvasH={activeCanvas.height} />

            <div
              style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5,
                background: `repeating-linear-gradient(
                  45deg,
                  rgba(0,0,0,0.045) 0px,
                  transparent 1px,
                  transparent 4px,
                  rgba(0,0,0,0.045) 5px
                )`,
              }}
            />

            {isLayoutFrame && slotsLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
                <div className="text-white text-sm font-semibold">{t('editor.loadingSlots')}</div>
              </div>
            )}

            {isLayoutFrame && !slotsLoading && frameSlots.map((slot, i) => {
              const px = toSlotPx(slot, activeCanvas.width, activeCanvas.height);
              const slotData = layoutSlots[i];
              const filled = !!slotData?.photoId || !!slotData?.uploadSrc;

              function zoomSlot(factor) {
                const photo = slotData?.uploadSrc
                  ? { url: slotData.uploadSrc, proxyUrl: slotData.uploadSrc }
                  : selectedPhotos.find((p) => p.id === slotData?.photoId);
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
                      <button onClick={(e) => { e.stopPropagation(); zoomSlot(1.15); }} style={zoomBtnStyle} title={t('editor.zoomIn')} aria-label={t('editor.zoomIn')}><Plus size={16} /></button>
                      <button onClick={(e) => { e.stopPropagation(); zoomSlot(1 / 1.15); }} style={zoomBtnStyle} title={t('editor.zoomOut')} aria-label={t('editor.zoomOut')}><Minus size={16} /></button>
                      <button onClick={(e) => { e.stopPropagation(); openSlotPicker(i); }} style={{ ...zoomBtnStyle, background: 'rgba(124,58,237,0.85)' }} title={t('editor.changePhoto')} aria-label={t('editor.changePhoto')}><Pencil size={15} /></button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ── Collage commit bar — turns the frame into a NEW output ── */}
          {isLayoutFrame && (() => {
            const filled = layoutSlots.filter((s) => s?.photoId || s?.uploadSrc).length;
            const ready = frameSlots.length > 0 && filled === frameSlots.length; // all slots required
            return (
              <div
                className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl shrink-0"
                style={{ background: '#fff', border: '1.5px solid var(--color-primary-200)', boxShadow: 'var(--shadow-sm)' }}
              >
                <span className="text-xs font-medium" style={{ color: 'var(--color-neutral-500)' }}>
                  {t('frame.slotsFilled', { filled, total: frameSlots.length })}
                </span>
                <button
                  disabled={!ready || committingFrame}
                  onClick={commitCollage}
                  className="py-2.5 px-4 rounded-xl text-sm font-semibold transition-all active:scale-95 inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: ready ? 'var(--color-primary)' : 'var(--color-neutral-200)', color: ready ? '#fff' : 'var(--color-neutral-400)' }}
                >
                  {committingFrame
                    ? <><Loader2 size={16} className="animate-spin" /> {t('frame.saving')}</>
                    : <><Check size={16} /> {t('frame.saveAsNew')}</>}
                </button>
              </div>
            );
          })()}

          {/* ── Filmstrip: horizontal photo queue below canvas ── */}
          <div
            className="flex gap-2 overflow-x-auto no-scrollbar py-2 px-1 shrink-0 rounded-xl"
            style={{ background: '#fff', border: '1.5px solid var(--color-neutral-200)', boxShadow: 'var(--shadow-sm)' }}
          >
            {selectedPhotos.map((p, i) => {
              const isActive = i === photoIndex;
              const isSaved = !!photoEdits[p.id]?.dataUrl && !isActive;
              return (
                <button
                  key={p.id}
                  onClick={() => navigateTo(i)}
                  className="flex flex-col items-center gap-1 shrink-0 transition-all active:scale-95"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                  aria-label={t('common.photoN', { n: i + 1 })}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{
                      width: 52, height: 39,
                      border: isActive
                        ? '2.5px solid var(--color-primary)'
                        : isSaved
                          ? '2px solid var(--color-success, #22c55e)'
                          : '2px solid var(--color-neutral-200)',
                      boxShadow: isActive ? '0 0 0 1px var(--color-primary)' : 'none',
                      transition: 'border-color 0.15s',
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={p.thumbnail}
                      alt=""
                      className="block w-full h-full object-cover"
                    />
                  </div>
                  <span
                    className="text-xs font-bold"
                    style={{
                      color: isActive
                        ? 'var(--color-primary)'
                        : isSaved
                          ? 'var(--color-success, #22c55e)'
                          : 'var(--color-neutral-400)',
                    }}
                  >
                    {isActive
                      ? t('editor.editingNow')
                      : isSaved
                        ? `✓ ${t('editor.savedTag')}`
                        : t('common.photoN', { n: i + 1 })}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: active panel content (full-width below canvas on mobile) ── */}
        <div
          className="flex flex-col min-h-0 sm:min-h-0 min-h-[280px] rounded-xl overflow-hidden shrink-0"
          style={{
            background: '#fff',
            border: '1.5px solid var(--color-neutral-200)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{ borderBottom: '1px solid var(--color-neutral-100)' }}
          >
            {activeTool ? (
              <>
                <span
                  className="flex items-center justify-center rounded-lg shrink-0"
                  style={{
                    width: 34, height: 34,
                    background: 'var(--color-accent-light, #fff7ed)',
                    color: 'var(--color-neutral-800)',
                  }}
                >
                  <activeTool.icon size={18} strokeWidth={2} />
                </span>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--color-neutral-900)' }}>
                    {t(activeTool.labelKey)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-neutral-400)' }}>
                    {t('editor.tabHint', { default: 'Ketuk untuk menambahkan' })}
                  </p>
                </div>
              </>
            ) : (
              <p className="text-sm font-semibold" style={{ color: 'var(--color-neutral-400)' }}>
                {t('editor.selectTool')}
              </p>
            )}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto no-scrollbar p-3">
            {activePanel === 'frames'   && <FramePanel activeFrame={frame} onSelect={setFrame} layoutFrames={layoutFrames} layoutLoading={layoutFramesLoading} />}
            {activePanel === 'stickers' && <StickerPanel onAdd={addSticker} stickers={stickers} loading={stickersLoading} />}
            {activePanel === 'text'     && <TextPanel onAdd={addText} />}
            {activePanel === 'upload'   && (
              <UploadPanel
                onAdd={startPhoneUpload}
                awaitingCount={awaitingUploadCount}
                uploadedCount={renderElements.filter((el) => el.type === 'upload' && el.attrs.src).length + uploadedToListCount}
              />
            )}
            {activePanel === 'filters'  && <FilterPanel filters={filters} onChange={setFilters} />}
            {activePanel === 'ai'       && <AiTransformPanel templates={aiTemplates} loading={aiTemplatesLoading} onGenerate={startAiJob} aiTransformUsed={aiTransformUsed} generating={aiJob?.status === 'pending'} currentIsAi={currentIsDerived} faceCount={currentPhotoFaceCount} />}

            {!activePanel && (
              <div
                className="rounded-xl p-5 flex flex-col items-center justify-center h-32 text-center"
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

      {/* ── Progress footer ── */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-2.5 rounded-xl"
        style={{
          background: '#fff',
          border: '1.5px solid var(--color-neutral-200)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {/* Progress dots */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 items-center">
            {selectedPhotos.map((_, i) => (
              <span
                key={i}
                className="transition-all rounded-full"
                style={{
                  height: 8,
                  width: i === photoIndex ? 20 : 8,
                  background: i === photoIndex
                    ? 'var(--color-primary)'
                    : photoEdits[selectedPhotos[i]?.id]?.dataUrl
                      ? 'var(--color-success, #22c55e)'
                      : 'var(--color-neutral-200)',
                  borderRadius: 4,
                }}
              />
            ))}
          </div>
          <span className="text-xs font-medium ml-1" style={{ color: 'var(--color-neutral-400)' }}>
            {t('editor.progressLabel', { current: photoIndex + 1, total: selectedPhotos.length })}
          </span>
        </div>

        <span className="text-xs font-medium" style={{ color: 'var(--color-neutral-400)' }}>
          {t('editor.autoSave')}
        </span>
      </div>

      {showSlotPicker && (
        <SlotPhotoPicker
          photos={selectedPhotos}
          assignedPhotoIds={layoutSlots.filter(Boolean).map((s) => s.photoId)}
          slotIndex={activeSlot}
          onPick={handlePickPhoto}
          onUploadFromPhone={() => { setShowSlotPicker(false); startPhoneUpload(activeSlot); }}
          onClose={() => { setShowSlotPicker(false); setActiveSlot(null); }}
        />
      )}

      {/* Phone upload QR — closes itself the moment the photo lands */}
      {pendingUpload && (
        <PhoneUploadModal
          qrDataUrl={pendingUpload.qrDataUrl}
          onCancel={() => setPendingUpload(null)}
        />
      )}

      {/* Result reveal — opens automatically when the background job finishes */}
      {aiResultOpen && aiJob?.status === 'ready' && (
        <AiResultModal
          originalUrl={aiJob.originalUrl}
          resultUrl={aiJob.resultUrl}
          label={aiJob.template?.label}
          onUse={acceptAiResult}
          onTryAnother={dismissAiJob}
          onClose={() => setAiResultOpen(false)}
        />
      )}

      {/* Floating status pill — pending / error / ready-but-dismissed */}
      {aiJob && !(aiResultOpen && aiJob.status === 'ready') && (
        <AiJobPill
          job={aiJob}
          onView={() => setAiResultOpen(true)}
          onRetry={retryAiJob}
          onDismiss={dismissAiJob}
        />
      )}

      {/* Confirmation overlay — shown when customer clicks Done while AI is still processing */}
      {showDoneWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="rounded-3xl p-7 flex flex-col gap-5 w-full"
            style={{ background: '#fff', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}
          >
            <div className="flex flex-col gap-1.5">
              <div className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                <Loader2 size={15} className="animate-spin" /> {t('ai.pendingWarningTitle')}
              </div>
              <p className="text-base font-semibold leading-snug" style={{ color: 'var(--color-neutral-900)' }}>
                {t('ai.pendingWarning')}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={confirmDone}
                className="py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)' }}
              >
                {t('ai.pendingWarningConfirm')}
              </button>
              <button
                onClick={() => setShowDoneWarning(false)}
                className="py-3 rounded-xl text-sm font-semibold transition-all active:scale-95"
                style={{ background: 'var(--color-primary)', color: '#fff' }}
              >
                {t('ai.pendingWarningCancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
