import { useState, useRef, useCallback, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Text, Transformer } from 'react-konva';
import useImage from 'use-image';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { useHistory } from '../../hooks/useHistory';
import StickerPanel from './StickerPanel';
import TextPanel from './TextPanel';
import FilterPanel from './FilterPanel';
import EditorToolbar from './EditorToolbar';
import Button from '../common/Button';

const LANDSCAPE = { width: 800, height: 533 };
const PORTRAIT  = { width: 533, height: 800 };
const DEFAULT_FILTERS = { list: [], brightness: 0, contrast: 0 };

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

function BackgroundImage({ src, filters, canvasW, canvasH }) {
  const [image] = useImage(src, 'anonymous');
  const imageRef = useRef(null);

  useEffect(() => {
    if (imageRef.current) imageRef.current.cache();
  }, [image, filters]);

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

const PANEL_TABS = [
  { id: 'stickers', label: '😀  Stickers' },
  { id: 'text',     label: '✏️  Text' },
  { id: 'filters',  label: '🎨  Filters' },
];

export default function PhotoEditor() {
  const { state } = useApp();
  const navigate = useNavigate();
  const stageRef = useRef(null);

  const selectedPhotos = state.selectedPhotos;

  // Which photo in the queue we're currently editing
  const [photoIndex, setPhotoIndex] = useState(0);
  const currentPhoto = selectedPhotos[photoIndex];

  // Per-photo saved edits: { [photoId]: { elements, filters } }
  const savedEditsRef = useRef({});

  const { state: elements, push: pushHistory, undo, redo, reset: resetHistory, canUndo, canRedo } = useHistory([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activePanel, setActivePanel] = useState('stickers');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [canvas, setCanvas] = useState(LANDSCAPE);

  const photoUrl = currentPhoto?.url;

  // Cache of photoId → canvas dimensions, populated eagerly for all selected photos
  const orientationCache = useRef({});

  useEffect(() => {
    selectedPhotos.forEach((photo) => {
      if (!photo.url || orientationCache.current[photo.id]) return;
      const img = new Image();
      img.onload = () => {
        orientationCache.current[photo.id] =
          img.naturalHeight > img.naturalWidth ? PORTRAIT : LANDSCAPE;
      };
      img.src = photo.url;
    });
  }, [selectedPhotos]);

  // Sync canvas orientation whenever the current photo changes
  useEffect(() => {
    if (!photoUrl) return;
    const cached = orientationCache.current[currentPhoto.id];
    if (cached) { setCanvas(cached); return; }
    const img = new Image();
    img.onload = () => {
      const dims = img.naturalHeight > img.naturalWidth ? PORTRAIT : LANDSCAPE;
      orientationCache.current[currentPhoto.id] = dims;
      setCanvas(dims);
    };
    img.src = photoUrl;
  }, [photoUrl, currentPhoto?.id]);

  // Navigate to a photo by index, saving current edits first
  function navigateTo(newIndex) {
    if (newIndex < 0 || newIndex >= selectedPhotos.length) return;

    // Persist current photo's edits
    savedEditsRef.current[currentPhoto.id] = { elements, filters };

    // Restore saved edits for the target photo (or use defaults)
    const saved = savedEditsRef.current[selectedPhotos[newIndex].id];
    resetHistory(saved?.elements ?? []);
    setFilters(saved?.filters ?? DEFAULT_FILTERS);
    setSelectedId(null);
    setActivePanel('stickers');

    // Update canvas orientation synchronously if already cached — prevents
    // the Stage from briefly rendering the new photo at the wrong dimensions
    const cached = orientationCache.current[selectedPhotos[newIndex].id];
    if (cached) setCanvas(cached);

    setPhotoIndex(newIndex);
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

  function addText({ text, fontSize, color, fontFamily }) {
    pushHistory([...elements, {
      id: `text-${Date.now()}`,
      type: 'text',
      attrs: { text, fontSize, fill: color, fontFamily, x: 80, y: 80, rotation: 0, scaleX: 1, scaleY: 1 },
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
        <p style={{ color: 'var(--color-neutral-500)' }}>No photos selected. <button onClick={() => navigate('/gallery')} style={{ color: 'var(--color-primary)' }}>Go back</button></p>
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

        <div className="flex gap-3 shrink-0">
          <Button variant="ghost" onClick={() => navigate('/gallery')}>← Gallery</Button>
          <Button onClick={() => navigate('/cart')}>
            {isLast ? 'Done ✓' : `Next →`}
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
            className="overflow-hidden shrink-0"
            style={{
              width: canvas.width,
              height: canvas.height,
              boxShadow: 'var(--shadow-xl)',
              border: '2px solid var(--color-neutral-200)',
              alignSelf: 'center'
            }}
          >
            <Stage
              key={`${canvas.width}x${canvas.height}`}
              width={canvas.width}
              height={canvas.height}
              ref={stageRef}
              onMouseDown={handleStageClick}
              onTouchStart={handleStageClick}
            >
              <Layer>
                {photoUrl && <BackgroundImage src={photoUrl} filters={filters} canvasW={canvas.width} canvasH={canvas.height} />}
                {elements.map((el) => (
                  <CanvasElement
                    key={el.id}
                    element={el}
                    isSelected={selectedId === el.id}
                    onSelect={setSelectedId}
                    onChange={handleChange}
                  />
                ))}
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

        {/* Right: photo queue strip + active panel */}
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
            <p
              className="text-xs font-bold px-3 pt-3 pb-2"
              style={{ color: 'var(--color-neutral-500)' }}
            >
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
                    {p.label && (
                      <p className="text-xs truncate" style={{ color: 'var(--color-neutral-400)' }}>
                        {p.label}
                      </p>
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
