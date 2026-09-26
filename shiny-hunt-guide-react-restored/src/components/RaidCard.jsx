import Sprite from './Sprite.jsx';
import { RateNote } from './PokemonCard.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { shortDate, timeOfDay, parseDate } from '../utils/dates.js';
import { raidRate, rate } from '../data/raids.js';

export default function RaidCard({ raid, events, appearance, shinyFormArt, tracked, onTrack, onOpen }) {
  const locked = raid.canBeShiny === false;
  const upcoming = !!raid.event;
  const countdown = useCountdown(raid.event?.start, raid.event?.end);
  const info = locked ? rate('Shiny locked', 'feed status', 'Not obtainable shiny from this raid') : raidRate(raid, events);
  const eventId = raid.event?.eventID || '';

  return (
    <article className="card raid-card" onClick={() => onOpen?.(raid)}>
      <Sprite src={raid.image} name={raid.name} shiny={appearance === 'shiny' && !locked} shinyFormArt={shinyFormArt} />
      <div className="card-main">
        <div className="card-top">
          <h4>{raid.name}</h4>
          <span className={`badge ${locked ? 'locked' : upcoming ? 'upcoming' : 'gold'}`}>{locked ? 'LOCKED' : upcoming ? 'UPCOMING' : 'SHINY'}</span>
        </div>
        <p className="meta">
          {raid.tier}
          {upcoming ? ` · from ${shortDate(parseDate(raid.event.start))}, ${timeOfDay(parseDate(raid.event.start))}` : ''}
          {raid.combatPower?.normal?.min ? ` · CP ${raid.combatPower.normal.min}–${raid.combatPower.normal.max}` : ''}
        </p>
        {countdown && <span className="countdown">{countdown.label}</span>}
        <RateNote odds={info} />
        <div className="event-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="link-button" onClick={() => onOpen?.(raid)}>
            View raid details →
          </button>
          {!locked && (
            <button type="button" className={`track-button${tracked ? ' active' : ''}`} onClick={() => onTrack?.(raid, eventId)}>
              {tracked ? 'Tracking ✓' : 'Track hunt'}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
