import { useMemo, useState } from 'react';
import PokemonCard from '../components/PokemonCard.jsx';
import PokemonDetail from '../components/PokemonDetail.jsx';
import { researchRewards, rate } from '../data/raids.js';
import { eventEncounters, maxEncounters } from '../data/events.js';
import { matchesAnyQuery } from '../utils/raidFilters.js';
import { shortDate, timeOfDay, parseDate } from '../utils/dates.js';

const EGG_DISTANCES = ['all', '2 km', '5 km', '7 km', '10 km', '12 km'];

function Section({ title, children, count }) {
  if (!count) return null;
  return (
    <section className="card-section">
      <div className="section-head">
        <h3>{title}</h3>
        <span>
          {count} {count === 1 ? 'target' : 'targets'}
        </span>
      </div>
      <div className="card-grid">{children}</div>
    </section>
  );
}

export default function Research({ researchFeed, eggsFeed, events, pokemonInfo, appearance, shinyFormArt, query, activeHunt, isActive, setActiveHunt, isChecked, toggleChecked }) {
  const [eggDistance, setEggDistance] = useState('all');
  const [openDetail, setOpenDetail] = useState(null);

  const research = useMemo(() => researchRewards(researchFeed).filter((r) => matchesAnyQuery([r.name, r.task], query)), [researchFeed, query]);
  const eggs = useMemo(
    () =>
      eggsFeed.filter(
        (e) => (eggDistance === 'all' || e.eggType?.startsWith(eggDistance.replace(' km', '') + ' ')) && matchesAnyQuery([e.name, e.eggType], query)
      ),
    [eggsFeed, eggDistance, query]
  );
  const eventTargets = useMemo(() => eventEncounters(events, eggsFeed).filter((p) => matchesAnyQuery([p.name, p.event.name], query)), [events, eggsFeed, query]);
  const maxTargets = useMemo(() => maxEncounters(events, pokemonInfo, [...eggsFeed]).filter((p) => matchesAnyQuery([p.name, p.event.name], query)), [events, pokemonInfo, eggsFeed, query]);

  const track = (kind, item, eventId) => {
    const active = isActive(kind, item.name, eventId);
    setActiveHunt(active ? null : { kind, name: item.name, eventId, image: item.image, label: item.eggType || item.event?.name || 'Field research', odds: item.odds || rate('1/512', 'estimated', 'Field research fallback'), start: item.event?.start, end: item.event?.end });
  };

  const openItem = (kind, item) => {
    const event = item.event;
    const eventId = event?.eventID || '';
    const base = {
      kind,
      name: item.name,
      image: item.image,
      event,
      odds:
        kind === 'egg'
          ? item.canBeShiny === false
            ? rate('Shiny locked', 'feed status', 'Not shiny-capable from this egg')
            : rate('1/64', 'estimated', 'Egg hatch; varies by species')
          : kind === 'research'
            ? rate('1/512', 'estimated', 'Field research fallback')
            : item.odds
    };
    if (kind === 'egg') base.label = item.eggType || 'Egg hatch';
    if (kind === 'research') base.label = 'Field research reward';
    if (kind === 'event' || kind === 'max') {
      base.label = event.name;
      base.meta = `${shortDate(parseDate(event.start))} ${timeOfDay(parseDate(event.start))}`;
    }
    setOpenDetail(base);
    void eventId;
  };

  const nothing = !research.length && !eggs.length && !eventTargets.length && !maxTargets.length;

  return (
    <section className="page">
      <Section title="Featured event Pokémon" count={eventTargets.length}>
        {eventTargets.map((p) => (
          <PokemonCard
            key={`${p.name}:${p.event.eventID}`}
            kind="event"
            item={p}
            appearance={appearance}
            shinyFormArt={shinyFormArt}
            tracked={isActive('event', p.name, p.event.eventID)}
            checked={isChecked('event', p.name, p.event.eventID)}
            onTrack={track}
            onToggleChecked={toggleChecked}
            onOpen={openItem}
          />
        ))}
      </Section>

      <Section title="Max Battle Pokémon" count={maxTargets.length}>
        {maxTargets.map((p) => (
          <PokemonCard
            key={`${p.name}:${p.event.eventID}`}
            kind="max"
            item={p}
            appearance={appearance}
            shinyFormArt={shinyFormArt}
            tracked={isActive('max', p.name, p.event.eventID)}
            checked={isChecked('max', p.name, p.event.eventID)}
            onTrack={track}
            onToggleChecked={toggleChecked}
            onOpen={openItem}
          />
        ))}
      </Section>

      <section className="card-section">
        <div className="section-head">
          <h3>Egg hatches</h3>
          <span>{eggs.length} targets</span>
        </div>
        <div className="egg-pool-row" role="group" aria-label="Egg distance">
          {EGG_DISTANCES.map((d) => (
            <button key={d} type="button" className={`pill${eggDistance === d ? ' active' : ''}`} aria-pressed={eggDistance === d} onClick={() => setEggDistance(d)}>
              {d === 'all' ? 'All eggs' : d}
            </button>
          ))}
        </div>
        {eggs.length ? (
          <div className="card-grid">
            {eggs.map((egg) => (
              <PokemonCard
                key={egg.name}
                kind="egg"
                item={egg}
                appearance={appearance}
                shinyFormArt={shinyFormArt}
                tracked={isActive('egg', egg.name)}
                checked={isChecked('egg', egg.name)}
                onTrack={track}
                onToggleChecked={toggleChecked}
                onOpen={openItem}
              />
            ))}
          </div>
        ) : (
          <div className="empty">No eggs match this filter right now.</div>
        )}
      </section>

      <Section title="Field research" count={research.length}>
        {research.map((r) => (
          <PokemonCard
            key={r.name + r.task}
            kind="research"
            item={r}
            appearance={appearance}
            shinyFormArt={shinyFormArt}
            tracked={isActive('research', r.name)}
            checked={isChecked('research', r.name)}
            onTrack={track}
            onToggleChecked={toggleChecked}
            onOpen={openItem}
          />
        ))}
      </Section>

      {nothing && <div className="empty">No matching shiny targets in the current feed.</div>}

      {openDetail && (
        <PokemonDetail
          detail={openDetail}
          onClose={() => setOpenDetail(null)}
          shinyFormArt={shinyFormArt}
          tracked={isActive(openDetail.kind, openDetail.name, openDetail.event?.eventID || '')}
          onTrack={() => track(openDetail.kind, openDetail, openDetail.event?.eventID || '')}
        />
      )}
    </section>
  );
}
