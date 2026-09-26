import { useEffect, useState } from 'react';
import ShinyToggle from './ShinyToggle.jsx';
import { safeUrl } from '../utils/pokemonForms.js';
import { fetchEvolutionData, buildEvolutionFamily, evolutionRequirementText, familyMemberSprite } from '../data/pokemon.js';

/** `item` is the raid/egg/research/event/max object the detail modal is showing. */
export default function EvolutionLine({ item, shinyFormArt }) {
  const [family, setFamily] = useState(null); // null = loading, [] = unavailable
  const [appearance, setAppearance] = useState('normal');

  useEffect(() => {
    let cancelled = false;
    setFamily(null);
    setAppearance('normal');
    fetchEvolutionData().then((data) => {
      if (cancelled) return;
      setFamily(buildEvolutionFamily(data, item));
    });
    return () => {
      cancelled = true;
    };
  }, [item]);

  return (
    <details className="evolution-section" open>
      <summary>Evolution family &amp; shiny comparison</summary>
      <div className="evolution-content">
        {family === null && <div className="family-loading">Loading evolution family…</div>}
        {family?.length === 0 && <p className="meta evolution-empty">Evolution family unavailable for this form.</p>}
        {family && family.length > 0 && (
          <>
            <div className="family-controls">
              <span>Compare family</span>
              <ShinyToggle value={appearance} onChange={setAppearance} label="Evolution family appearance" />
            </div>
            <div className="evolution-row">
              {(() => {
                const maxStage = Math.max(...family.map((p) => p.stage));
                const shiny = appearance === 'shiny';
                return family.map((p) => {
                  const stageLabel = maxStage === 0 ? 'Single-stage' : p.stage === 0 ? 'Base' : p.stage === maxStage ? 'Final evolution' : 'Evolution';
                  const src = familyMemberSprite(p, item, shiny, shinyFormArt);
                  return (
                    <article className="evolution-member" key={p.key}>
                      <span className="stage-label">{stageLabel}</span>
                      <div className="family-sprite">
                        <img src={safeUrl(src)} alt={`${shiny ? 'Shiny ' : ''}${p.name}`} loading="lazy" />
                      </div>
                      <strong>{p.name}</strong>
                      <small>{evolutionRequirementText(p.evolution)}</small>
                    </article>
                  );
                });
              })()}
            </div>
            <p className="family-note">Evolution requirements use community Pokémon GO data. Some special requirements can change.</p>
          </>
        )}
      </div>
    </details>
  );
}
