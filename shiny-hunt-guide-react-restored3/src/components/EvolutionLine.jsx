import { useEffect, useState } from 'react';
import ShinyToggle from './ShinyToggle.jsx';
import Sprite from './Sprite.jsx';
import { baseSpeciesName, collectFormSlugs, safeUrl, shinySource } from '../utils/pokemonForms.js';
import { fetchEvolutionData, fetchShinyFormArtBatch, buildEvolutionFamily, evolutionRequirementText, familyMemberSprite } from '../data/pokemon.js';

/** `item` is the raid/egg/research/event/max object the detail modal is showing. */
export default function EvolutionLine({ item, shinyFormArt, battleForms = [] }) {
  const [family, setFamily] = useState(null); // null = loading, [] = unavailable
  const [appearance, setAppearance] = useState('normal');
  const [localFormArt, setLocalFormArt] = useState({});

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

  const featuredForms = family?.length ? battleForms.filter((form) =>
    /^(mega|dynamax|gigantamax)\s/i.test(form.name) && family.some((member) => member.name.toLowerCase() === baseSpeciesName(form.name).toLowerCase())
  ).filter((form, index, all) => all.findIndex((other) => other.name === form.name) === index) : [];
  const formSlugs = collectFormSlugs(featuredForms.map((form) => form.name));
  const missingForms = formSlugs.filter((slug) => !(slug in shinyFormArt) && !(slug in localFormArt));

  useEffect(() => {
    if (appearance !== 'shiny' || !missingForms.length) return;
    let cancelled = false;
    fetchShinyFormArtBatch(missingForms).then((art) => {
      if (!cancelled) setLocalFormArt((previous) => ({ ...previous, ...art }));
    });
    return () => { cancelled = true; };
  }, [appearance, missingForms.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

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
                  const generic = `https://cdn.leekduck.com/assets/img/pokemon_icons_crop/pm${p.id}.icon.png`;
                  const fallback = shiny ? shinySource(p.name, generic, shinyFormArt) : generic;
                  return (
                    <article className="evolution-member" key={p.key}>
                      <span className="stage-label">{stageLabel}</span>
                      <div className="family-sprite">
                        <img key={src} src={safeUrl(src)} alt={`${shiny ? 'Shiny ' : ''}${p.name}`} loading="lazy" onError={(event) => {
                          const img = event.currentTarget;
                          const next = img.dataset.fallback === 'used' ? '' : safeUrl(fallback);
                          img.dataset.fallback = 'used';
                          if (next && img.src !== next) img.src = next;
                          else img.style.visibility = 'hidden';
                        }} />
                      </div>
                      <strong>{p.name}</strong>
                      <small>{evolutionRequirementText(p.evolution)}</small>
                    </article>
                  );
                });
              })()}
            </div>
            <p className="family-note">Evolution requirements use community Pokémon GO data. Some special requirements can change.</p>
            {featuredForms.length > 0 && <>
              <p className="battle-form-label">Featured Mega &amp; Max forms</p>
              <div className="evolution-row">
                {featuredForms.map((form) => (
                  <article className="evolution-member" key={form.name}>
                    <span className="stage-label">{form.name.split(' ')[0]}</span>
                    <div className="family-sprite"><Sprite src={form.image} name={form.name} shiny={appearance === 'shiny'} shinyFormArt={{ ...shinyFormArt, ...localFormArt }} size={88} /></div>
                    <strong>{form.name}</strong>
                    <small>{form.label}</small>
                  </article>
                ))}
              </div>
              <p className="family-note">Battle forms shown here are featured in the current raids or upcoming Max Battles.</p>
            </>}
          </>
        )}
      </div>
    </details>
  );
}
