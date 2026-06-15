import { useState } from 'react';
import { Sparkles, Wand2 } from 'lucide-react';
import { useLang } from '../../i18n/LanguageContext';

const CDN = 'https://s.magicaitool.com/nanobanana/prompts';

// Template slugs match the Nano Banana CDN pattern:
//   before → {CDN}/{slug}.webp
//   after  → {CDN}/{slug}-effect.webp
export const AI_TEMPLATES = [
  {
    id:         '3d-toy',
    slug:       '3d-toy',
    nameKey:    'ai.tpl.3dtoy',
    emoji:      '🧸',
    tag:        '3D',
    tagColor:   { bg: '#eff6ff', color: '#2563eb' },
    prompt:     'Q-version modern style, 3D toy, original character rendering, clever and cute, minimalist art style, with a cartoon aesthetic.',
  },
  {
    id:         'ghibsky-illustration',
    slug:       'ghibsky-illustration',
    nameKey:    'ai.tpl.ghibsky',
    emoji:      '🌸',
    tag:        'Anime',
    tagColor:   { bg: '#fdf4ff', color: '#9333ea' },
    prompt:     'GHIBSKY style, dreamy watercolor sky, soft cumulus clouds, pastel gradient, gentle natural light, whimsical atmosphere.',
  },
  {
    id:         'caricature-trend',
    slug:       'caricature-trend',
    nameKey:    'ai.tpl.caricature',
    emoji:      '🎭',
    tag:        'Fun',
    tagColor:   { bg: '#fff7ed', color: '#ea580c' },
    prompt:     'Humorous exaggerated caricature, oversized head features, vibrant colors, comic book style, playful and fun.',
  },
  {
    id:         '3d-caricature',
    slug:       '3d-caricature',
    nameKey:    'ai.tpl.caricature3d',
    emoji:      '🤪',
    tag:        '3D',
    tagColor:   { bg: '#eff6ff', color: '#2563eb' },
    prompt:     'A highly stylized 3D caricature of this character, with expressive facial features and playful exaggeration. Rendered in a smooth, polished style with clean materials and soft ambient lighting. Bold color background to emphasize the character\'s charm and presence.',
  },
  {
    id:         'halloween-poster',
    slug:       'halloween-poster',
    nameKey:    'ai.tpl.halloween',
    emoji:      '🎃',
    tag:        'Fun',
    tagColor:   { bg: '#fff7ed', color: '#ea580c' },
    prompt:     'Vintage Halloween poster with witch hat, cape, jack-o-lantern, diagonal dramatic background, and horror-themed text elements.',
  },
  {
    id:         'ai-minecraft-filter',
    slug:       'ai-minecraft-filter',
    nameKey:    'ai.tpl.minecraft',
    emoji:      '⛏️',
    tag:        'Game',
    tagColor:   { bg: '#f0fdf4', color: '#16a34a' },
    prompt:     'Transform the source photo into an isometric 3-D voxel scene in Minecraft Pixel Art style. Preserve original composition, colors, pose and key details. Build everything with small cubes under bright neutral light. Each character\'s head is one solid cube with pixel eyes & mouth (no subdivisions); the rest of the body and environment use detailed voxels. Sharp edges, subtle AO, ultra-clean, 8K.',
  },
];

// Derive CDN URLs — id === slug for all Nano Banana templates
export function templateImages(tpl) {
  const slug = tpl.slug ?? tpl.id;
  return {
    beforeImg: `${CDN}/${slug}.webp`,
    afterImg:  `${CDN}/${slug}-effect.webp`,
  };
}

export default function AiTransformPanel({ onTransform }) {
  const { t } = useLang();
  const [selected, setSelected] = useState(null);

  const panelStyle = {
    background: '#fff',
    boxShadow: 'var(--shadow-md)',
    border: '1px solid var(--color-neutral-100)',
  };

  return (
    <div className="rounded-2xl p-4 flex flex-col gap-4" style={panelStyle}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
        <h3 className="font-bold flex-1" style={{ color: 'var(--color-neutral-700)' }}>
          {t('ai.title')}
        </h3>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{ background: '#fff3cd', color: '#92400e' }}
        >
          {t('ai.comingSoon')}
        </span>
      </div>

      <p className="text-xs" style={{ color: 'var(--color-neutral-500)' }}>
        {t('ai.subtitle')}
      </p>

      {/* Template grid */}
      <div className="grid grid-cols-2 gap-2">
        {AI_TEMPLATES.map((tpl) => {
          const isActive = selected === tpl.id;
          return (
            <button
              key={tpl.id}
              onClick={() => setSelected(isActive ? null : tpl.id)}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all active:scale-95"
              style={{
                background: isActive ? 'var(--color-primary-50)' : 'var(--color-neutral-50)',
                border: `2px solid ${isActive ? 'var(--color-primary)' : 'var(--color-neutral-200)'}`,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 26, lineHeight: 1 }}>{tpl.emoji}</span>
              <span
                className="text-xs font-semibold text-center leading-tight"
                style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-neutral-700)' }}
              >
                {t(tpl.nameKey)}
              </span>
              <span
                className="text-xs font-bold px-1.5 py-0.5 rounded-full"
                style={tpl.tagColor}
              >
                {tpl.tag}
              </span>
            </button>
          );
        })}
      </div>

      {/* Preview button */}
      <button
        disabled={!selected}
        onClick={() => {
          const tpl = AI_TEMPLATES.find((t) => t.id === selected);
          if (tpl) onTransform(tpl);
        }}
        className="py-3 rounded-xl text-sm font-semibold transition-all active:scale-95 inline-flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: selected ? 'var(--color-primary)' : 'var(--color-neutral-200)',
          color: selected ? '#fff' : 'var(--color-neutral-400)',
        }}
      >
        <Wand2 size={16} />
        {t('ai.previewBtn')}
      </button>
    </div>
  );
}
