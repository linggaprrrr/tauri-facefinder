import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Text, Transformer } from 'react-konva';
import useImage from 'use-image';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { useHistory } from '../../hooks/useHistory';
import StickerPanel from './StickerPanel';
import TextPanel from './TextPanel';
import FilterPanel from './FilterPanel';
import FramePanel, { generateFrameDataUri } from './FramePanel';
import EditorToolbar from './EditorToolbar';
import Button from '../common/Button';

const MAX_CANVAS_W = 780;
const MAX_CANVAS_H = 520;
const DEFAULT_FILTERS = { list: [], brightness: 0, contrast: 0 };

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
  const [image] = useImage(src);
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

const PANEL_TABS = [
  { id: 'stickers', label: '😀  Stickers' },
  { id: 'text',     label: '✏️  Text'     },
  { id: 'filters',  label: '🎨  Filters'  },
  { id: 'frames',   label: '🖼  Bingkai'  },
];

export default function PhotoEditor() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const stageRef = useRef(null);

  const selectedPhotos = state.selectedPhotos;
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
  const [isLoading, setIsLoading] = useState(false);
  const handleImageLoad = useCallback(() => setIsLoading(false), []);

  const photoUrl = currentPhoto?.url;
  const orientationCache = useRef({});

  // Eagerly load dimensions for all selected photos
  useEffect(() => {
    selectedPhotos.forEach((photo) => {
      if (!photo.url || orientationCache.current[photo.id]) return;
      const img = new Image();
      img.onload = () => {
        orientationCache.current[photo.id] = fitDimensions(img.naturalWidth, img.naturalHeight);
      };
      img.src = photo.url;
    });
  }, [selectedPhotos]);

  // Sync canvas dimensions + loading state when current photo changes
  useEffect(() => {
    if (!photoUrl) return;
    setIsLoading(true);
    const cached = orientationCache.current[currentPhoto.id];
    if (cached) { setCanvas(cached); return; }
    const img = new Image();
    img.onload = () => {
      const dims = fitDimensions(img.naturalWidth, img.naturalHeight);
      orientationCache.current[currentPhoto.id] = dims;
      setCanvas(dims);
    };
    img.onerror = () => setIsLoading(false);
    img.src = photoUrl;
  }, [photoUrl, currentPhoto?.id]);

  const frameDataUri = useMemo(
    () => generateFrameDataUri(frame, canvas.width, canvas.height),
    [frame, canvas.width, canvas.height]
  );

  // Export the current stage and persist edits to AppContext
  function exportAndSave() {
    const dataUrl = stageRef.current?.toDataURL({ pixelRatio: 2, mimeType: 'image/jpeg', quality: 0.9 });
    const edit = { elements, filters, frame, dataUrl };
    savedEditsRef.current[currentPhoto.id] = edit;
    dispatch({ type: 'SET_PHOTO_EDIT', payload: { id: currentPhoto.id, data: edit } });
    return dataUrl;
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
          No photos selected.{' '}
          <button onClick={() => navigate('/gallery')} style={{ color: 'var(--color-primary)' }}>Go back</button>
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
          Edit Photos
        </h1>

        {/* Prev / counter / Next */}
        <div className="flex items-center gap-2">
          <button
            disabled={photoIndex === 0}
            onClick={() => navigateTo(photoIndex - 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg transition-all active:scale-95 disabled:opacity-30"
            style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)' }}
          >
            ‹
          </button>
          <span className="text-sm font-semibold px-2" style={{ color: 'var(--color-neutral-600)' }}>
            {photoIndex + 1} / {selectedPhotos.length}
          </span>
          <button
            disabled={isLast}
            onClick={() => navigateTo(photoIndex + 1)}
            className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-lg transition-all active:scale-95 disabled:opacity-30"
            style={{ background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)' }}
          >
            ›
          </button>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="ghost" onClick={() => navigate('/gallery')}>← Gallery</Button>
          <Button onClick={handleDone}>
            {isLast ? 'Done ✓' : 'Next →'}
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
              width: canvas.width,
              height: canvas.height,
              boxShadow: 'var(--shadow-xl)',
              border: '2px solid var(--color-neutral-200)',
              alignSelf: 'center',
              transition: 'width 0.2s ease, height 0.2s ease',
            }}
          >
            {isLoading && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
                style={{ background: 'var(--color-neutral-100)' }}
              >
                <div
                  className="w-10 h-10 rounded-full border-4 animate-spin"
                  style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
                />
                <span className="text-xs font-semibold" style={{ color: 'var(--color-neutral-400)' }}>
                  Loading photo…
                </span>
              </div>
            )}
            <Stage
              key={`${canvas.width}x${canvas.height}`}
              width={canvas.width}
              height={canvas.height}
              ref={stageRef}
              onMouseDown={handleStageClick}
              onTouchStart={handleStageClick}
            >
              <Layer>
                {photoUrl && (
                  <BackgroundImage
                    src={photoUrl}
                    filters={filters}
                    canvasW={canvas.width}
                    canvasH={canvas.height}
                    onLoad={handleImageLoad}
                  />
                )}
                {elements.map((el) => (
                  <CanvasElement
                    key={el.id}
                    element={el}
                    isSelected={selectedId === el.id}
                    onSelect={setSelectedId}
                    onChange={handleChange}
                  />
                ))}
                {/* Frame sits on top of everything, non-interactive */}
                {frameDataUri && (
                  <FrameOverlay src={frameDataUri} canvasW={canvas.width} canvasH={canvas.height} />
                )}
              </Layer>
            </Stage>
          </div>

          {/* Panel tab switcher */}
          <div
            className="flex gap-2 p-1.5 rounded-xl shrink-0"
            style={{ background: 'var(--color-neutral-100)' }}
          >
            {PANEL_TABS.map(({ id, label }) => (
              <button
                key={id}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95"
                style={{
                  background: activePanel === id ? 'var(--color-accent)' : 'transparent',
                  color: activePanel === id ? 'var(--color-neutral-900)' : 'var(--color-neutral-600)',
                  boxShadow: activePanel === id ? 'var(--shadow-sm)' : 'none',
                }}
                onClick={() => setActivePanel(activePanel === id ? null : id)}
              >
                {label}
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
              SELECTED PHOTOS
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
                      Photo {i + 1}
                    </p>
                    {/* Saved edit indicator */}
                    {savedEditsRef.current[p.id]?.dataUrl && i !== photoIndex && (
                      <p className="text-xs" style={{ color: 'var(--color-success)' }}>✓ Saved</p>
                    )}
                    {p.label && !savedEditsRef.current[p.id]?.dataUrl && (
                      <p className="text-xs truncate" style={{ color: 'var(--color-neutral-400)' }}>{p.label}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Tool panel content */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {activePanel === 'stickers' && <StickerPanel onAdd={addSticker} />}
            {activePanel === 'text'     && <TextPanel onAdd={addText} />}
            {activePanel === 'filters'  && <FilterPanel filters={filters} onChange={setFilters} />}
            {activePanel === 'frames'   && <FramePanel activeFrame={frame} onSelect={setFrame} />}
            {!activePanel && (
              <div
                className="rounded-2xl p-6 flex flex-col items-center justify-center h-32 text-center"
                style={{
                  background: 'var(--color-primary-50)',
                  border: '1.5px dashed var(--color-primary-200)',
                  color: 'var(--color-primary-400)',
                }}
              >
                <p className="text-sm font-semibold">Select a tool below to start editing</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
