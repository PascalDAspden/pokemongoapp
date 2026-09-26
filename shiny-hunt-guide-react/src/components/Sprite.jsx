import { useState } from 'react';
import { safeUrl, normalizedSpriteUrl, shinySource } from '../utils/pokemonForms.js';

/**
 * Renders a Pokémon's artwork, swapping to shiny art when `shiny` is true and
 * falling back to the normal sprite (then a ✦ placeholder) if shiny art
 * isn't available for that form yet.
 */
export default function Sprite({ src, name, shiny = false, shinyFormArt = {}, size = 64 }) {
  const [stage, setStage] = useState('shiny'); // 'shiny' -> 'normal' -> 'fallback'

  const normalized = normalizedSpriteUrl(src);
  const normalUrl = safeUrl(normalized) || safeUrl(src);
  const shinyUrl = shiny ? safeUrl(shinySource(name, normalized, shinyFormArt)) : '';
  const shadow = /^shadow\s/i.test(String(name || ''));

  const showShiny = shiny && shinyUrl && stage === 'shiny';
  const url = showShiny ? shinyUrl : normalUrl;

  return (
    <div className={`sprite-box${shadow ? ' shadow-aura' : ''}`} style={{ width: size, height: size }}>
      {url ? (
        <img
          className={showShiny ? 'shiny-art' : ''}
          src={url}
          alt={showShiny ? `Shiny ${name}` : name}
          loading="lazy"
          onError={() => setStage((s) => (s === 'shiny' ? 'normal' : 'fallback'))}
        />
      ) : (
        <span className="fallback">✦</span>
      )}
    </div>
  );
}
