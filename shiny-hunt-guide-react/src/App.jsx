import { useCallback, useEffect, useMemo, useState } from 'react';
import ShinyToggle from './components/ShinyToggle.jsx';
import Raids from './pages/Raids.jsx';
import Research from './pages/Research.jsx';
import Events from './pages/Events.jsx';
import Checklist from './pages/Checklist.jsx';
import { fetchRaidsFeed, fetchEggsFeed, fetchResearchFeed, fetchEventsFeed, scheduledRaids, researchRewards } from './data/raids.js';
import { maxEncounters } from './data/events.js';
import { fetchSpeciesInfo, fetchGmaxArt, fetchShinyFormArtBatch } from './data/pokemon.js';
import { collectFormSlugs } from './utils/pokemonForms.js';
import { useActiveHunt, useChecklist } from './hooks/useChecklist.js';

const TABS = [
  { id: 'raids', label: 'Raids' },
  { id: 'research', label: 'Research' },
  { id: 'events', label: 'Events' },
  { id: 'checklist', label: 'Checklist' }
];

const EMPTY_FEEDS = { raids: [], eggs: [], research: [], events: [] };

export default function App() {
  const [feeds, setFeeds] = useState(EMPTY_FEEDS);
  const [status, setStatus] = useState({ loading: true, cached: false, failed: false, updatedAt: null });
  const [appearance, setAppearance] = useState('normal');
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('raids');
  const [pokemonInfo, setPokemonInfo] = useState({});
  const [shinyFormArt, setShinyFormArt] = useState({});

  const activeHuntApi = useActiveHunt();
  const checklistApi = useChecklist();

  const refresh = useCallback(async () => {
    setStatus((s) => ({ ...s, loading: true }));
    const [raids, eggs, research, events] = await Promise.all([fetchRaidsFeed(), fetchEggsFeed(), fetchResearchFeed(), fetchEventsFeed()]);
    setFeeds({ raids: raids.data, eggs: eggs.data, research: research.data, events: events.data });
    const cached = [raids, eggs, research, events].some((v) => v.cached);
    const failed = [raids, eggs, research, events].some((v) => v.failed);
    const allFailed = [raids, eggs, research, events].every((v) => v.failed);
    setStatus({ loading: false, cached, failed, allFailed, updatedAt: new Date() });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Lazily hydrate legendary/dex-id info for raid bosses & Max Battle targets that need it
  // (the feeds don't carry a "legendary" flag, and Max Battle events only name a species).
  useEffect(() => {
    const upcoming = scheduledRaids(feeds.events, feeds.raids, pokemonInfo);
    const shadowSpecies = upcoming.filter((r) => /^shadow\s/i.test(r.name)).map((r) => r.name.replace(/^shadow\s+/i, '').replace(/\s*\(.+\)/, ''));
    const maxSpeciesGuess = [...feeds.events]
      .map((e) => e.name.match(/^(Gigantamax|Dynamax)\s+(.+?)(?:\s+during\s+Max Monday|\s+Max Battle Day|\s+in\s+Max Battles)/i))
      .filter(Boolean)
      .flatMap((m) => m[2].split(/,\s*(?:and\s+)?|\s+and\s+/i).map((s) => s.trim()))
      .filter((s) => s && !/^max$/i.test(s));
    const species = [...new Set([...shadowSpecies, ...maxSpeciesGuess])].filter((name) => !pokemonInfo[name.toLowerCase()]);
    if (!species.length) return;
    let cancelled = false;
    Promise.all(species.map(async (name) => [name.toLowerCase(), await fetchSpeciesInfo(name)])).then((entries) => {
      if (cancelled) return;
      setPokemonInfo((prev) => {
        const next = { ...prev };
        entries.forEach(([key, info]) => {
          if (info) next[key] = info;
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [feeds.events, feeds.raids]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gigantamax artwork for species that get one, keyed as "gmax:<species>".
  useEffect(() => {
    const gmaxSpecies = [...new Set(maxEncounters(feeds.events, pokemonInfo, feeds.eggs).filter((p) => p.name.startsWith('Gigantamax')).map((p) => p.species))].filter(
      (name) => !pokemonInfo['gmax:' + name.toLowerCase()]
    );
    if (!gmaxSpecies.length) return;
    let cancelled = false;
    Promise.all(gmaxSpecies.map(async (name) => [name.toLowerCase(), await fetchGmaxArt(name)])).then((entries) => {
      if (cancelled) return;
      setPokemonInfo((prev) => {
        const next = { ...prev };
        entries.forEach(([key, url]) => {
          if (url) next['gmax:' + key] = { image: url };
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [feeds.events, feeds.eggs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shiny artwork for mega/regional/gmax forms currently on screen, fetched once the person switches to Shiny.
  useEffect(() => {
    if (appearance !== 'shiny') return;
    const names = [
      ...feeds.raids,
      ...scheduledRaids(feeds.events, feeds.raids, pokemonInfo),
      ...feeds.eggs,
      ...researchRewards(feeds.research),
      ...maxEncounters(feeds.events, pokemonInfo, feeds.eggs)
    ].map((p) => p.name);
    const forms = collectFormSlugs(names).filter((f) => !(f in shinyFormArt));
    if (!forms.length) return;
    let cancelled = false;
    fetchShinyFormArtBatch(forms).then((map) => {
      if (!cancelled) setShinyFormArt((prev) => ({ ...prev, ...map }));
    });
    return () => {
      cancelled = true;
    };
  }, [appearance, feeds, pokemonInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusText = status.loading
    ? 'Updating current data…'
    : status.allFailed
      ? 'Could not load live data'
      : status.cached || status.failed
        ? 'Some data may be out of date'
        : 'Current feed loaded';

  const statusDotClass = status.loading ? '' : status.allFailed ? 'error' : status.cached || status.failed ? '' : 'live';

  const pageProps = useMemo(
    () => ({
      raidsFeed: feeds.raids,
      eggsFeed: feeds.eggs,
      researchFeed: feeds.research,
      eventsFeed: feeds.events,
      events: feeds.events,
      pokemonInfo,
      appearance,
      shinyFormArt,
      query,
      failed: status.failed,
      activeHunt: activeHuntApi.activeHunt,
      isActive: activeHuntApi.isActive,
      setActiveHunt: activeHuntApi.setActiveHunt,
      isChecked: checklistApi.isChecked,
      toggleChecked: checklistApi.toggleChecked,
      checked: checklistApi.checked
    }),
    [feeds, pokemonInfo, appearance, shinyFormArt, query, status.failed, activeHuntApi, checklistApi]
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">✦</div>
        <div className="brand-copy">
          <span className="eyebrow">POKÉMON GO</span>
          <h1>Shiny Hunt Guide</h1>
        </div>
        <button type="button" className="icon-button" onClick={refresh} disabled={status.loading} aria-label="Refresh live data">
          ⟳
        </button>
      </header>

      <div className="status-row">
        <span className={`status-dot ${statusDotClass}`} />
        <span className="status-text">{statusText}</span>
        {status.updatedAt && !status.loading && !status.allFailed && (
          <span className="status-updated">{status.cached ? 'Saved copy' : status.updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
        )}
      </div>

      <div className="controls-row">
        <input
          type="search"
          className="search-input"
          placeholder="Search Pokémon, raids, events…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search"
        />
        <ShinyToggle value={appearance} onChange={setAppearance} />
      </div>

      <nav className="tab-row" aria-label="Sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`tab${tab === t.id ? ' active' : ''}`} aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'raids' && <Raids {...pageProps} />}
        {tab === 'research' && <Research {...pageProps} />}
        {tab === 'events' && <Events {...pageProps} />}
        {tab === 'checklist' && <Checklist {...pageProps} />}
      </main>

      <footer className="app-footer">
        <p>
          Live data from Leek Duck via ScrapedDuck, and PokéAPI / PogoAPI for species, forms and evolutions. Odds are community guide-rate estimates, not
          official rates.
        </p>
      </footer>
    </div>
  );
}
