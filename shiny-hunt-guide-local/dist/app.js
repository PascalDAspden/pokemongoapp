const BASE = 'https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/';
const EVOLUTIONS_URL='https://pogoapi.net/api/v1/pokemon_evolutions.json';
const state = { raids: [], eggs: [], research: [], events: [], pokemonInfo: {}, shinyForms: {}, raidDetails: {}, typeDetails: {}, evolutionData: null, evolutionPromise: null, activeRaid: null, activePokemon: null, familyAppearance: 'normal', trackedHunt: loadTrackedHunt(), appearance: 'normal', filter: 'all', eggDistance: 'all', raidScope: 'current', raidType: 'all', raidSort: 'tier', raidShinyOnly: true, eventFilter: 'upcoming', eventType: 'all', eventSort: 'date', query: '', view: 'hunt', cached: false, failed: false };
const $ = (id) => document.getElementById(id);
const html = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = (url) => { try { const parsed = new URL(url); return parsed.protocol === 'https:' ? parsed.href : ''; } catch { return ''; } };
const now = () => new Date();
const shortDate = (date) => new Intl.DateTimeFormat(undefined, {month:'short',day:'numeric'}).format(date);
const time = (date) => new Intl.DateTimeFormat(undefined, {hour:'numeric',minute:'2-digit'}).format(date);
const day = (date) => new Intl.DateTimeFormat(undefined, {weekday:'short'}).format(date);
const parse = (value) => value ? new Date(value) : null;

function loadTrackedHunt() { try { const saved=JSON.parse(localStorage.getItem('tracked-hunt-v1')); return saved?.name && saved?.kind ? saved : null; } catch { return null; } }
function huntKey(kind,name,eventId='') { return `${kind}:${name}:${eventId}`.toLowerCase(); }
function isTracked(kind,name,eventId='') { return state.trackedHunt && huntKey(kind,name,eventId)===huntKey(state.trackedHunt.kind,state.trackedHunt.name,state.trackedHunt.eventId); }
function trackButton(kind,name,eventId='') {
  const active=isTracked(kind,name,eventId);
  return `<button class="track-button${active ? ' active' : ''}" type="button" data-track-kind="${html(kind)}" data-track-name="${html(name)}" data-track-event="${html(eventId)}" aria-pressed="${active}">${active ? 'Tracking ✓' : 'Track hunt'}</button>`;
}
function countdownMarkup(start,end) {
  const startDate=parse(start),endDate=parse(end),current=now();
  if (!startDate || !endDate || endDate<=current) return '';
  const live=startDate<=current;
  return `<span class="countdown" data-countdown="${html((live ? endDate : startDate).toISOString())}" data-prefix="${live ? 'Ends' : 'Starts'}">${live ? 'Ends' : 'Starts'} soon</span>`;
}
function countdownTo(target,prefix) {
  const date=parse(target);
  return date ? `<span class="countdown" data-countdown="${html(date.toISOString())}" data-prefix="${html(prefix)}">${html(prefix)} soon</span>` : '';
}
function countdownText(milliseconds) {
  const total=Math.max(0,Math.floor(milliseconds/60000));
  const days=Math.floor(total/1440),hours=Math.floor(total%1440/60),minutes=total%60;
  if(days)return `${days}d ${hours}h`;
  if(hours)return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
function updateCountdowns() {
  document.querySelectorAll('[data-countdown]').forEach(node=>{
    const distance=parse(node.dataset.countdown)-now();
    node.textContent=distance<=0 ? 'Updating…' : `${node.dataset.prefix} in ${countdownText(distance)}`;
  });
  const clock=$('local-clock');
  if(clock)clock.textContent=new Intl.DateTimeFormat(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}).format(now());
}

async function loadFeed(name) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);
  try {
    const response = await fetch(BASE + name + '.json', {cache:'no-cache', signal: controller.signal});
    if (!response.ok) throw new Error(name + ': ' + response.status);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Unexpected feed');
    try { localStorage.setItem('feed-' + name, JSON.stringify({saved: Date.now(), data})); } catch {}
    return {data, cached:false};
  } catch (error) {
    try { const saved = JSON.parse(localStorage.getItem('feed-' + name)); if (Array.isArray(saved.data)) return {data:saved.data, cached:true, saved:saved.saved}; } catch {}
    return {data:[], cached:false, failed:true};
  } finally { clearTimeout(timeout); }
}

async function refresh() {
  $('refresh').disabled = true;
  $('status').textContent = 'Updating current data…';
  $('status-dot').className = 'status-dot';
  const names = ['raids', 'eggs', 'research', 'events'];
  const values = await Promise.all(names.map(loadFeed));
  names.forEach((name, i) => state[name] = values[i].data);
  state.cached = values.some(v => v.cached);
  state.failed = values.some(v => v.failed);
  document.querySelector('[data-filter="research"]').classList.toggle('hidden', !researchCards().length);
  if (state.filter === 'research' && !researchCards().length) { state.filter='all'; document.querySelector('[data-filter="all"]').click(); }
  for (const [filter,label,count] of [['raids','Raids',state.raids.length + scheduledRaids().length],['eggs','Eggs',state.eggs.length],['max','Max',maxEncounters().length],['events','Events',eventEncounters().length]]) {
    document.querySelector(`[data-filter="${filter}"]`).textContent = `${label} ${count}`;
  }
  document.querySelectorAll('.egg-pool').forEach(button => {
    const distance = button.dataset.distance;
    const count = state.eggs.filter(e => distance === 'all' || e.eggType?.startsWith(distance + ' ')).length;
    button.textContent = `${distance === 'all' ? 'All eggs' : distance + ' km'} ${count}`;
  });
  const allFailed = values.every(v => v.failed);
  $('status-dot').className = 'status-dot ' + (allFailed ? 'error' : state.cached || state.failed ? '' : 'live');
  $('status').textContent = allFailed ? 'Could not load live data' : state.cached || state.failed ? 'Some data may be out of date' : 'Current feed loaded';
  $('updated').textContent = allFailed ? '' : state.cached ? 'Saved copy' : time(now());
  $('refresh').disabled = false;
  render();
  hydratePokemonInfo();
  if(state.appearance==='shiny')hydrateShinyForms();
}

function rate(value, confidence, reason, note='') { return {value, confidence, reason, note}; }
function rateHtml(info) {
  return `<div class="rate${info.value === 'Shiny locked' ? ' locked' : ''}">✦ ${html(info.value)} <span class="confidence">${html(info.confidence)}</span></div><p class="rate-note">${html(info.reason)}${info.note ? ' · ' + html(info.note) : ''}</p>`;
}
function currentRaidDayFor(name) {
  const wanted = String(name).replace(/^(shadow|mega)\s+/i,'').toLowerCase();
  return state.events.some(e => {
    if (e.eventType !== 'raid-day' || !e.start || !e.end) return false;
    const active = parse(e.start) <= now() && now() < parse(e.end);
    const named = e.name.toLowerCase().includes(wanted) || (e.extraData?.raidbattles?.bosses || []).some(b => String(b.name).toLowerCase() === String(name).toLowerCase());
    return active && named;
  });
}
function raidRate(raid) {
  const tier = String(raid.tier || '').toLowerCase();
  const shadow = /^shadow\s/i.test(raid.name);
  if (currentRaidDayFor(raid.name)) return rate('1/10','event-specific','Named Raid Day boss, during event hours only');
  if (shadow && tier.includes('5-star')) return rate('1/20','estimated','Tier 5 Shadow raid');
  if (shadow && /[13]-star/.test(tier)) return rate('1/64','estimated','Tier 1/3 Shadow raid');
  if (tier.includes('mega')) return rate('1/64','estimated','Mega raid');
  if (tier.includes('5-star') || tier.includes('ultra beast')) return rate('1/20','confirmed guide rate','Tier 5 / Legendary raid');
  if (/[13]-star/.test(tier)) return rate('1/64','estimated','Tier 1/3 raid');
  return rate('Rate unknown','unknown','No supported rate for this raid type');
}

function pokemonForm(name) {
  let value=String(name).replace(/^shadow\s+/i,'').trim();
  if (/^gigantamax\s+/i.test(value)) return value.replace(/^gigantamax\s+/i,'').toLowerCase().replace(/\s+/g,'-')+'-gmax';
  const mega=value.match(/^mega\s+(.+?)(?:\s+(x|y))?$/i);
  if (mega) return mega[1].toLowerCase().replace(/\s+/g,'-')+'-mega'+(mega[2] ? '-'+mega[2].toLowerCase() : '');
  const regional=value.match(/^(Hisuian|Alolan|Galarian|Paldean)\s+(.+)$/i);
  if (regional) return regional[2].toLowerCase().replace(/\s+/g,'-')+'-'+({hisuian:'hisui',alolan:'alola',galarian:'galar',paldean:'paldea'}[regional[1].toLowerCase()]);
  const alternate=value.match(/^(.+?)\s*\((.+?)\s*(?:Forme|Form)?\)$/i);
  if (alternate) return alternate[1].toLowerCase().replace(/\s+/g,'-')+'-'+alternate[2].toLowerCase().replace(/\s+/g,'-');
  return '';
}
function shinySource(name, src) {
  const source=String(src || '');
  const assetForm=source.match(/\/(pm\d+(?:\.[a-z0-9_]+)?)\.icon\.png/i)?.[1];
  if (assetForm) return source.replace(/(\/pm\d+(?:\.[a-z0-9_]+)?)\.icon\.png/i,'$1.s.icon.png');
  const iconForm=source.match(/\/pokemon_icon_(\d+_\d+)\.png/i)?.[1];
  if (iconForm) return source.replace(/(\/pokemon_icon_\d+_\d+)\.png/i,'$1_shiny.png');
  const form=pokemonForm(name);
  if (form) {
    if (form==='cinderace-gmax') return 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/10210.png';
    return state.shinyForms[form] || '';
  }
  const id=String(src || '').match(/\/pm(\d+)(?:\.|\/)/i)?.[1] || String(src || '').match(/\/(\d+)\.png(?:\?|$)/)?.[1];
  return id ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${id}.png` : '';
}
function shinyImage(name, src) { return state.appearance === 'shiny' ? shinySource(name,src) : ''; }
function normalizedSpriteUrl(src) {
  const source=String(src || '');
  return /cdn\.leekduck\.com\/assets\/img\/pokemon_icons\//i.test(source) ? source.replace('/pokemon_icons/','/pokemon_icons_crop/') : source;
}
function image(src, name, allowShiny=true, forceShiny=false) {
  const raw=safeUrl(src), normalized=normalizedSpriteUrl(src), original=safeUrl(normalized), shiny=allowShiny ? safeUrl(forceShiny ? shinySource(name,normalized) : shinyImage(name,normalized)) : '';
  const url=shiny || original;
  const fallback=shiny ? original : original!==raw ? raw : '';
  const shadow=/^shadow\s/i.test(name);
  return `<div class="sprite-box${shadow ? ' shadow-aura' : ''}">${url ? `<img class="${shiny ? 'shiny-art' : ''}" src="${html(url)}" ${fallback ? `data-fallback="${html(fallback)}"` : ''} alt="${html(shiny ? 'Shiny '+name : name)}" loading="lazy" onerror="if(this.dataset.fallback){this.src=this.dataset.fallback;this.dataset.fallback='';this.classList.remove('shiny-art')}else{this.replaceWith(Object.assign(document.createElement('span'),{className:'fallback',textContent:'✦'}))}">` : '<span class="fallback">✦</span>'}</div>`;
}

function baseSpeciesName(name) {
  return String(name).replace(/^(shadow|mega|gigantamax|dynamax)\s+/i,'').replace(/^(hisuian|alolan|galarian|paldean)\s+/i,'').replace(/\s*\(.+\)$/,'').trim();
}
function pokemonIdFromImage(src) {
  const value=String(src || '');
  return Number(value.match(/\/pm(\d+)/i)?.[1] || value.match(/pokemon_icon_(\d+)/i)?.[1] || value.match(/official-artwork\/(?:shiny\/)?(\d+)\.png/i)?.[1]) || null;
}
async function loadEvolutionData() {
  if(state.evolutionData)return state.evolutionData;
  if(!state.evolutionPromise)state.evolutionPromise=pokeJson(EVOLUTIONS_URL).then(data=>state.evolutionData=Array.isArray(data)?data:[]);
  return state.evolutionPromise;
}
function preferredForm(name) {
  if(/^alolan\s/i.test(name))return 'Alola';
  if(/^galarian\s/i.test(name))return 'Galarian';
  if(/^hisuian\s/i.test(name))return 'Hisuian';
  if(/^paldean\s/i.test(name))return 'Paldea';
  return 'Normal';
}
function evolutionFamily(data,item) {
  const nodes=new Map(),edges=[];
  const key=(id,form='Normal')=>`${id}:${form || 'Normal'}`;
  const add=(id,name,form)=>{const k=key(id,form);if(!nodes.has(k))nodes.set(k,{key:k,id:Number(id),name,form:form||'Normal'});return k;};
  data.forEach(row=>{
    const from=add(row.pokemon_id,row.pokemon_name,row.form);
    (row.evolutions||[]).forEach(e=>{const to=add(e.pokemon_id,e.pokemon_name,e.form);edges.push({from,to,detail:e});});
  });
  const wanted=baseSpeciesName(item.species || item.name).toLowerCase(),wantedId=pokemonIdFromImage(item.image),form=preferredForm(item.name);
  let start=[...nodes.values()].find(n=>n.name.toLowerCase()===wanted&&(n.form===form||form==='Normal'&&n.form==='Normal'));
  if(!start&&wantedId&&wantedId<10000)start=[...nodes.values()].find(n=>n.id===wantedId&&n.form==='Normal');
  if(!start)start=[...nodes.values()].find(n=>n.name.toLowerCase()===wanted);
  if(!start)return [];
  const family=new Set([start.key]),queue=[start.key];
  while(queue.length){const current=queue.shift();edges.filter(e=>e.from===current||e.to===current).forEach(e=>{const next=e.from===current?e.to:e.from;if(!family.has(next)){family.add(next);queue.push(next);}});}
  const incoming=new Map(),depth=new Map();
  edges.filter(e=>family.has(e.from)&&family.has(e.to)).forEach(e=>incoming.set(e.to,e));
  const roots=[...family].filter(k=>!incoming.has(k));roots.forEach(k=>depth.set(k,0));
  const work=[...roots];while(work.length){const current=work.shift(),d=depth.get(current);edges.filter(e=>e.from===current&&family.has(e.to)).forEach(e=>{if(!depth.has(e.to)||depth.get(e.to)>d+1){depth.set(e.to,d+1);work.push(e.to);}});}
  return [...family].map(k=>({...nodes.get(k),stage:depth.get(k)||0,evolution:incoming.get(k)?.detail || null})).sort((a,b)=>a.stage-b.stage||a.id-b.id||a.name.localeCompare(b.name));
}
function evolutionRequirement(detail) {
  if(!detail)return 'Starting stage';
  const parts=[];
  if(detail.candy_required)parts.push(`${detail.candy_required} Candy`);
  if(detail.item_required)parts.push(detail.item_required);
  if(detail.lure_required)parts.push(detail.lure_required);
  if(detail.buddy_distance_required)parts.push(`Walk ${detail.buddy_distance_required} km`);
  if(detail.must_be_buddy_to_evolve)parts.push('Keep as buddy');
  if(detail.only_evolves_in_daytime)parts.push('Daytime');
  if(detail.only_evolves_in_nighttime)parts.push('Nighttime');
  if(detail.upside_down)parts.push('Turn phone upside down');
  if(detail.gender_required)parts.push(`${detail.gender_required} only`);
  if(detail.no_candy_cost_if_traded)parts.push('No Candy after eligible trade');
  return parts.join(' · ') || 'Special evolution requirement';
}
function familySprite(node,item,shiny) {
  const clickedId=pokemonIdFromImage(item.image),battleForm=/^(mega|gigantamax|dynamax|shadow)\s/i.test(item.name),same=!battleForm&&node.name.toLowerCase()===baseSpeciesName(item.species || item.name).toLowerCase()&&(clickedId===node.id||!clickedId);
  const normal=normalizedSpriteUrl(same ? item.image : `https://cdn.leekduck.com/assets/img/pokemon_icons_crop/pm${node.id}.icon.png`);
  return shiny ? shinySource(node.name,normal) || normal : normal;
}
function renderEvolutionFamily(targetId,item,family) {
  const target=$(targetId);if(!target)return;
  if(!family.length){target.innerHTML='<p class="meta evolution-empty">Evolution family unavailable for this form.</p>';return;}
  const maxStage=Math.max(...family.map(p=>p.stage)),shiny=state.familyAppearance==='shiny';
  target.innerHTML=`<div class="family-controls"><span>Compare family</span><div role="group" aria-label="Evolution family appearance"><button class="family-appearance${!shiny?' active':''}" data-family-appearance="normal" aria-pressed="${!shiny}">Normal</button><button class="family-appearance${shiny?' active':''}" data-family-appearance="shiny" aria-pressed="${shiny}">Shiny ✦</button></div></div><div class="evolution-row">${family.map(p=>{const stage=maxStage===0?'Single-stage':p.stage===0?'Base':p.stage===maxStage?'Final evolution':'Evolution';const src=familySprite(p,item,shiny);return `<article class="evolution-member"><span class="stage-label">${stage}</span><div class="family-sprite"><img src="${html(safeUrl(src))}" alt="${html((shiny?'Shiny ':'')+p.name)}" loading="lazy"></div><strong>${html(p.name)}</strong><small>${html(evolutionRequirement(p.evolution))}</small></article>`;}).join('')}</div><p class="family-note">Evolution requirements use community Pokémon GO data. Some special requirements can change.</p>`;
}
async function loadEvolutionInto(targetId,item) {
  const target=$(targetId);if(!target)return;
  target.innerHTML='<div class="family-loading">Loading evolution family…</div>';
  const data=await loadEvolutionData(),family=evolutionFamily(data,item);
  if($(targetId))renderEvolutionFamily(targetId,item,family);
}
function evolutionSection(id) { return `<details class="evolution-section" open><summary>Evolution family & shiny comparison</summary><div id="${id}" class="evolution-content"></div></details>`; }

function raidCard(raid) {
  const locked = raid.canBeShiny === false;
  const upcoming = !!raid.event;
  const when = upcoming ? ` · from ${html(shortDate(parse(raid.event.start)))}, ${html(time(parse(raid.event.start)))}` : '';
  return `<article class="card raid-card" data-raid-name="${html(raid.name)}" data-raid-event="${html(raid.event?.eventID || '')}">${image(raid.image,raid.name,!locked)}<div class="card-main"><div class="card-top"><h4>${html(raid.name)}</h4><span class="badge ${locked ? 'locked' : upcoming ? 'upcoming' : 'gold'}">${locked ? 'LOCKED' : upcoming ? 'UPCOMING' : 'SHINY'}</span></div><p class="meta">${html(raid.tier)}${when}${raid.combatPower?.normal?.min ? ` · CP ${html(raid.combatPower.normal.min)}–${html(raid.combatPower.normal.max)}` : ''}</p>${upcoming ? countdownMarkup(raid.event.start,raid.event.end) : ''}${rateHtml(locked ? rate('Shiny locked','feed status','Not obtainable shiny from this raid') : raidRate(raid))}<div class="event-actions"><button class="raid-open" type="button">View raid details →</button>${!locked ? trackButton('raid',raid.name,raid.event?.eventID || '') : ''}${upcoming ? `<button class="calendar-button" data-calendar="${html(raid.event.eventID)}">Add raid to Calendar</button>` : ''}</div></div></article>`;
}

function scheduledRaids() {
  return validEvents().filter(e => e.eventType === 'raid-battles' && parse(e.start) > now()).flatMap(event =>
    (event.extraData?.raidbattles?.bosses || []).filter(b => b.name).map(b => {
      const shadow = /^shadow\s/i.test(event.name);
      const name = shadow && !/^shadow\s/i.test(b.name) ? 'Shadow ' + b.name : b.name;
      const linked = state.raids.find(r => r.name.toLowerCase() === name.toLowerCase());
      const species = b.name.replace(/\s*\(.+\)/,'').replace(/^mega\s+/i,'').toLowerCase();
      const legendary = state.pokemonInfo[species]?.legendary;
      const tier = /mega raids?/i.test(event.name) ? 'Mega Raids' : /5-star/i.test(event.name) || shadow && legendary ? '5-Star Raids' : shadow ? 'Shadow Raids (tier unconfirmed)' : 'Raid tier unconfirmed';
      return {name, image:b.image, tier, canBeShiny:b.canBeShiny, event, combatPower:linked?.combatPower, types:linked?.types};
    }));
}

function raidCategory(raid) {
  if (/^shadow\s/i.test(raid.name)) return 'shadow';
  if (/mega/i.test(raid.tier)) return 'mega';
  if (/5-star|ultra beast/i.test(raid.tier)) return 'legendary';
  if (/1-star/i.test(raid.tier)) return 'one';
  if (/3-star/i.test(raid.tier)) return 'three';
  return 'unknown';
}
function raidList(items) {
  const filtered = items.filter(r => (state.raidType === 'all' || state.raidType === raidCategory(r) || state.raidType === 'legendary' && /5-star/i.test(r.tier)) && (!state.raidShinyOnly || r.canBeShiny === true));
  const oddsRank = r => r.canBeShiny === false ? 9999 : parseInt(raidRate(r).value.split('/')[1]) || 9998;
  const tierRank = r => {
    const shadow=/^shadow\s/i.test(r.name);
    if(/1-star/i.test(r.tier))return shadow ? 2 : 1;
    if(/3-star/i.test(r.tier))return shadow ? 4 : 3;
    if(/mega/i.test(r.tier))return 5;
    if(/5-star|ultra beast/i.test(r.tier))return shadow ? 7 : 6;
    return shadow ? 9 : 8;
  };
  return filtered.sort((a,b) => {
    const byScope = state.raidScope === 'both' ? Number(!!a.event)-Number(!!b.event) : 0;
    if (byScope) return byScope;
    if (state.raidSort === 'tier') return tierRank(a)-tierRank(b) || (parse(a.event?.start)?.getTime() || 0)-(parse(b.event?.start)?.getTime() || 0) || a.name.localeCompare(b.name);
    if (state.raidSort === 'name') return a.name.localeCompare(b.name);
    if (state.raidSort === 'odds') return oddsRank(a)-oddsRank(b) || a.name.localeCompare(b.name);
    return (parse(a.event?.start)?.getTime() || 0)-(parse(b.event?.start)?.getTime() || 0) || a.name.localeCompare(b.name);
  });
}
const attackTypes=['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy'];
const typeName=value=>value.charAt(0).toUpperCase()+value.slice(1);
async function pokeJson(url) {
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),9000);
  try {const response=await fetch(url,{signal:controller.signal});return response.ok ? await response.json() : null;}
  catch{return null;} finally{clearTimeout(timeout);}
}
function raidPokemonSlug(name) {
  const plain=String(name).replace(/^shadow\s+/i,'').trim();
  return pokemonForm(plain) || plain.toLowerCase().replace(/[^a-z0-9 -]/g,'').replace(/\s+/g,'-');
}
function typeEffectiveness(relations) {
  if (relations.some(x=>!x)) return null;
  return attackTypes.map(attack=>{
    const multiplier=relations.reduce((total,data)=>{
      const table=data.damage_relations;
      const has=field=>table[field]?.some(x=>x.name===attack);
      return total*(has('no_damage_from') ? 0.390625 : has('half_damage_from') ? 0.625 : has('double_damage_from') ? 1.6 : 1);
    },1);
    return {type:attack,multiplier};
  }).filter(x=>x.multiplier>1.001).sort((a,b)=>b.multiplier-a.multiplier||a.type.localeCompare(b.type));
}
async function raidMetadata(name, raid) {
  const slug=raidPokemonSlug(name);
  if (!state.raidDetails[slug]) state.raidDetails[slug]=(async()=>{
    const feedTypes=raid.types?.map(type=>type.name).filter(Boolean) || [];
    const pokemon=feedTypes.length ? null : await pokeJson(`https://pokeapi.co/api/v2/pokemon/${slug}`);
    const types=feedTypes.length ? feedTypes : (pokemon?.types||[]).sort((a,b)=>a.slot-b.slot).map(t=>t.type.name);
    if (!types.length) return null;
    const relations=await Promise.all(types.map(type=>{
      if (!state.typeDetails[type]) state.typeDetails[type]=pokeJson(`https://pokeapi.co/api/v2/type/${type}`);
      return state.typeDetails[type];
    }));
    return {types,weaknesses:typeEffectiveness(relations)};
  })();
  return state.raidDetails[slug];
}
function renderRaidDetail(raid, metadata, loading=false) {
  const locked=raid.canBeShiny===false, upcoming=!!raid.event, info=locked ? rate('Shiny locked','feed status','Shiny unavailable from this raid') : raidRate(raid);
  const types=metadata?.types?.map(type=>`<span class="raid-type">${html(typeName(type))}</span>`).join('') || '';
  const weak=metadata?.weaknesses;
  const attack=weak?.map(x=>`<span class="raid-type${x.multiplier>2 ? ' extra-weak' : ''}">${html(typeName(x.type))}${x.multiplier>2 ? ' ×2.56' : ''}</span>`).join('') || '';
  const search=weak?.map(x=>'@'+x.type).join(',') || '';
  const cp=raid.combatPower?.normal;
  const date=upcoming ? `<p class="meta">${html(shortDate(parse(raid.event.start)))} ${html(time(parse(raid.event.start)))} – ${html(shortDate(parse(raid.event.end)))} ${html(time(parse(raid.event.end)))}</p>` : '<p class="meta">In the current raid rotation</p>';
  const url=safeUrl(raid.event?.link);
  const remote=`<div class="remote-raid"><div class="detail-label">Find a remote raid</div><div class="remote-actions"><a class="remote-button" href="https://campfire.nianticlabs.com/" target="_blank" rel="noopener">Open Campfire ↗</a><a class="remote-button secondary" href="https://apps.apple.com/app/poke-genie-remote-raid-iv-pvp/id1143920524" target="_blank" rel="noopener">Open Poké Genie ↗</a><a class="remote-button secondary" href="https://apps.apple.com/app/pokeraid-raid-from-home/id1507659524" target="_blank" rel="noopener">Open PokeRaid ↗</a></div><p class="meta detail-hint">Search for ${html(raid.name)} in the service you open. Live rooms and availability are managed there.</p></div>`;
  $('raid-detail-content').innerHTML=`<div class="raid-modal-top"><span class="eyebrow">RAID BOSS</span><button class="raid-close" type="button" aria-label="Close raid details">✕</button></div><div class="raid-modal-heading">${image(raid.image,raid.name,!locked)}<div><h2>${html(raid.name)}</h2><p class="meta">${html(raid.tier)}</p></div></div><div class="raid-modal-body">${date}${upcoming ? countdownMarkup(raid.event.start,raid.event.end) : ''}${cp?.min ? `<p class="meta">Encounter CP ${html(cp.min)}–${html(cp.max)}</p>` : ''}<div class="detail-label">Type</div><div class="type-chips">${loading ? '<span class="meta">Loading Pokémon type…</span>' : types || '<span class="meta">Type details unavailable for this form</span>'}</div><div class="detail-label">Effective attack types</div><div class="type-chips">${loading ? '<span class="meta">Checking matchups…</span>' : weak ? attack || '<span class="meta">No super-effective type matchup</span>' : '<span class="meta">Type matchup unavailable</span>'}</div>${search ? `<p class="meta detail-hint">Find Pokémon with these move types in Pokémon GO. This search does not rank your best counters.</p><div class="counter-copy"><code>${html(search)}</code><button type="button" id="copy-counter-search" data-search="${html(search)}">Copy search</button></div>` : ''}<div class="detail-label">Shiny chance</div>${rateHtml(info)}<div class="event-actions">${!locked ? trackButton('raid',raid.name,raid.event?.eventID || '') : ''}${upcoming ? `<button class="calendar-button" data-calendar="${html(raid.event.eventID)}">Add to Calendar</button>${url ? `<a class="source-link" href="${html(url)}" target="_blank" rel="noopener">Event details ↗</a>` : ''}` : ''}</div>${!locked ? remote : ''}${evolutionSection('raid-evolution')}</div>`;
  updateCountdowns();
  loadEvolutionInto('raid-evolution',raid);
}
async function openRaidDetail(card) {
  const name=card.dataset.raidName, eventId=card.dataset.raidEvent;
  const raid=eventId ? scheduledRaids().find(r=>r.name===name&&r.event.eventID===eventId) : state.raids.find(r=>r.name===name);
  if (!raid) return;
  state.familyAppearance='normal';
  state.activeRaid={raid,metadata:null};
  const dialog=$('raid-detail');
  renderRaidDetail(raid,null,true);
  if (!dialog.open) dialog.showModal();
  const metadata=await raidMetadata(name,raid);
  if (dialog.open && state.activeRaid?.raid===raid) {state.activeRaid.metadata=metadata;renderRaidDetail(raid,metadata);}
}

function eggCard(egg) {
  const locked = egg.canBeShiny === false;
  const hatchDay = validEvents().find(e => e.name.toLowerCase() === egg.name.toLowerCase() + ' hatch day');
  const hatchLive = hatchDay && parse(hatchDay.start) <= now();
  const info = locked ? rate('Shiny locked','feed status','Not shiny-capable from this egg') : hatchLive ? rate('1/10','event-specific','Featured Hatch Day Pokémon','Applies to eligible event eggs') : rate('1/64','estimated','Shiny chance after hatching; varies by species','Poorly measured');
  const rarity = Number(egg.rarity);
  const hatch = Number.isInteger(rarity) && rarity >= 1 && rarity <= 5 ? `<div class="hatch-rarity">Hatch rarity <strong>${rarity} of 5</strong> <span>${rarity === 1 ? 'more common' : rarity === 5 ? 'rarest tier' : 'rarer tier'}</span></div>` : '<div class="hatch-rarity">Hatch rarity not reported</div>';
  const upcoming = hatchDay && !hatchLive && !locked ? `<p class="rate-note">${html(shortDate(parse(hatchDay.start)))} Hatch Day: estimated 1/10 for eligible event eggs.</p>` : '';
  return `<article class="card pokemon-card" data-pokemon-kind="egg" data-pokemon-name="${html(egg.name)}">${image(egg.image,egg.name,!locked)}<div class="card-main"><div class="card-top"><h4>${html(egg.name)}</h4><span class="badge ${locked ? 'locked' : ''}">${locked ? 'LOCKED' : html(egg.eggType || 'EGG')}</span></div><p class="meta">${html(egg.eggType || 'Egg')}${egg.isAdventureSync ? ' · Adventure Sync' : ''}${egg.isGiftExchange ? ' · Route Gift' : ''}</p>${hatch}${rateHtml(info)}${upcoming}<div class="event-actions"><button class="pokemon-open" type="button">View Pokémon details →</button>${!locked ? trackButton('egg',egg.name) : ''}</div></div></article>`;
}

function researchCards() {
  return state.research.flatMap(task => (task.rewards || []).filter(reward => reward.canBeShiny).map(reward => ({task: String(task.text || '').replace(/<[^>]*>/g,''), ...reward})));
}

function researchCard(reward) {
  return `<article class="card pokemon-card" data-pokemon-kind="research" data-pokemon-name="${html(reward.name)}">${image(reward.image,reward.name)}<div class="card-main"><div class="card-top"><h4>${html(reward.name)}</h4><span class="badge">RESEARCH</span></div><p class="meta">${html(reward.task)}${reward.combatPower?.min ? ` · CP ${html(reward.combatPower.min)}–${html(reward.combatPower.max)}` : ''}</p>${rateHtml(rate('1/512','estimated','Field research fallback','Event-specific research can differ'))}<div class="event-actions"><button class="pokemon-open" type="button">View Pokémon details →</button>${trackButton('research',reward.name)}</div></div></article>`;
}

function validEvents() {
  return state.events.filter(e => {
    const start = parse(e.start), end = parse(e.end);
    return start && end && !isNaN(start) && !isNaN(end) && end > now() && end > start;
  }).sort((a,b) => parse(a.start) - parse(b.start));
}

function featuredEvents() {
  return validEvents().filter(e => e.extraData?.spotlight?.canBeShiny || e.eventType === 'community-day' || e.eventType === 'research-day');
}

function eventEncounters() {
  return validEvents().flatMap(event => {
    if (event.eventType === 'pokemon-spotlight-hour') {
      const p = event.extraData?.spotlight;
      return p?.name && p.canBeShiny ? [{name:p.name,image:p.image,event,odds:rate('1/512','confirmed guide rate','Spotlight Hour does not boost shiny odds')}]:[];
    }
    if (event.eventType === 'community-day') {
      const details = event.extraData?.communityday;
      const shiny = new Set((details?.shinies || []).map(p => p.name?.toLowerCase()));
      return (details?.spawns || []).filter(p => p.name && shiny.has(p.name.toLowerCase())).map(p => ({...p,event,odds:rate('1/25','confirmed guide rate','Featured Community Day spawn, during event hours')}));
    }
    if (/ hatch day$/i.test(event.name)) {
      const name = event.name.replace(/ hatch day$/i,'');
      const egg = state.eggs.find(e => e.name.toLowerCase() === name.toLowerCase() && e.canBeShiny);
      return egg ? [{name:egg.name,image:egg.image,event,odds:rate('1/10','event-specific','Featured Hatch Day Pokémon','Eligible eggs obtained during event')}]:[];
    }
    return [];
  });
}

function eventEncounterCard(p) {
  const start = parse(p.event.start), live = start <= now();
  return `<article class="card event-encounter pokemon-card" data-pokemon-kind="event" data-pokemon-name="${html(p.name)}" data-pokemon-event="${html(p.event.eventID)}">${image(p.image,p.name)}<div class="card-main"><div class="card-top"><h4>${html(p.name)}</h4><span class="badge gold">${live ? 'LIVE EVENT' : 'UPCOMING'}</span></div><p class="meta">${html(p.event.name)} · ${html(shortDate(start))}, ${html(time(start))}</p>${countdownMarkup(p.event.start,p.event.end)}${rateHtml(p.odds)}<div class="event-actions"><button class="pokemon-open" type="button">View Pokémon details →</button>${trackButton('event',p.name,p.event.eventID)}<button class="calendar-button" data-calendar="${html(p.event.eventID)}">Add event to Calendar</button></div></div></article>`;
}

function maxEncounters() {
  const knownIds = {cinderace:815,sobble:816,sizzlipede:850,rookidee:821,sneasel:215,sableye:302,articuno:144,zapdos:145,moltres:146};
  const knownGmaxIds = {cinderace:10210};
  return validEvents().filter(e => ['max-battles','max-mondays'].includes(e.eventType)).flatMap(event => {
    const match = event.name.match(/^(Gigantamax|Dynamax)\s+(.+?)(?:\s+during\s+Max Monday|\s+Max Battle Day|\s+in\s+Max Battles)/i);
    if (!match || /^max$/i.test(match[2])) return [];
    const speciesList = match[2].split(/,\s*(?:and\s+)?|\s+and\s+/i).map(s => s.trim()).filter(Boolean);
    return speciesList.map(species => {
      const info = state.pokemonInfo[species.toLowerCase()];
      const existing = [...state.eggs,...state.raids].find(p => p.name.toLowerCase() === species.toLowerCase());
      const prefix = match[1];
      const odds = prefix.toLowerCase() === 'gigantamax' ? rate('1/20','unknown','Gigantamax guide estimate','Shiny availability unverified') : info?.legendary === true ? rate('1/20','estimated','Legendary Max Battle','Shiny availability unverified') : info?.legendary === false ? rate('1/64','unknown','Dynamax guide estimate','Shiny availability unverified') : rate('Checking rate','unknown','Checking whether this is a Legendary Max Battle');
      const artId = info?.id || knownIds[species.toLowerCase()];
      const gigantamax=prefix.toLowerCase() === 'gigantamax';
      const gmaxId=knownGmaxIds[species.toLowerCase()];
      const formArt=state.pokemonInfo['gmax:'+species.toLowerCase()]?.image || (gmaxId ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${gmaxId}.png` : '');
      const standardArt=existing?.image || (artId ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${artId}.png` : '');
      return {event,species,name:prefix+' '+species,image:gigantamax ? formArt || event.image : standardArt || event.image,odds};
    });
  });
}

function maxCard(p) {
  const start = parse(p.event.start);
  return `<article class="card event-encounter pokemon-card" data-pokemon-kind="max" data-pokemon-name="${html(p.name)}" data-pokemon-event="${html(p.event.eventID)}">${image(p.image,p.name)}<div class="card-main"><div class="card-top"><h4>${html(p.name)}</h4><span class="badge">${p.name.startsWith('Gigantamax') ? 'GIGANTAMAX' : 'DYNAMAX'}</span></div><p class="meta">${html(p.event.name)} · ${html(shortDate(start))}, ${html(time(start))}</p>${countdownMarkup(p.event.start,p.event.end)}${rateHtml(p.odds)}<div class="event-actions"><button class="pokemon-open" type="button">View Pokémon details →</button>${trackButton('max',p.name,p.event.eventID)}<button class="calendar-button" data-calendar="${html(p.event.eventID)}">Add event to Calendar</button></div></div></article>`;
}

function pokemonDetailData(kind,name,eventId='') {
  if(kind==='egg'){
    const item=state.eggs.find(p=>p.name===name);if(!item)return null;
    const event=validEvents().find(e=>e.name.toLowerCase()===item.name.toLowerCase()+' hatch day'),live=event&&parse(event.start)<=now();
    return {kind,name:item.name,image:item.image,label:item.eggType || 'Egg hatch',meta:`Hatch rarity ${item.rarity || 'not reported'} of 5`,odds:item.canBeShiny===false?rate('Shiny locked','feed status','Not shiny-capable from this egg'):live?rate('1/10','event-specific','Featured Hatch Day Pokémon'):rate('1/64','estimated','Egg hatch; varies by species'),event};
  }
  if(kind==='research'){
    const item=researchCards().find(p=>p.name===name);if(!item)return null;
    return {kind,name:item.name,image:item.image,label:'Field research reward',meta:item.task,odds:rate('1/512','estimated','Field research fallback')};
  }
  if(kind==='event'){
    const item=eventEncounters().find(p=>p.name===name&&p.event.eventID===eventId);if(!item)return null;
    return {kind,name:item.name,image:item.image,label:item.event.name,meta:`${shortDate(parse(item.event.start))} ${time(parse(item.event.start))}`,odds:item.odds,event:item.event};
  }
  if(kind==='max'){
    const item=maxEncounters().find(p=>p.name===name&&p.event.eventID===eventId);if(!item)return null;
    return {kind,name:item.name,species:item.species,image:item.image,label:item.event.name,meta:`${shortDate(parse(item.event.start))} ${time(parse(item.event.start))}`,odds:item.odds,event:item.event};
  }
  return null;
}
function renderPokemonDetail(item) {
  const calendar=item.event ? `<button class="calendar-button" data-calendar="${html(item.event.eventID)}">Add to Calendar</button>` : '';
  $('pokemon-detail-content').innerHTML=`<div class="raid-modal-top"><span class="eyebrow">POKÉMON DETAILS</span><button class="pokemon-close" type="button" aria-label="Close Pokémon details">✕</button></div><div class="pokemon-modal-heading">${image(item.image,item.name,item.odds.value!=='Shiny locked')}<div><h2>${html(item.name)}</h2><p class="meta">${html(item.label)}</p></div></div><div class="pokemon-modal-body"><p class="meta detail-current">${html(item.meta || '')}</p>${item.event ? countdownMarkup(item.event.start,item.event.end) : ''}<div class="detail-label">Shiny chance from this source</div>${rateHtml(item.odds)}<div class="event-actions"><button class="track-button${isTracked(item.kind,item.name,item.event?.eventID || '')?' active':''}" data-track-kind="${html(item.kind)}" data-track-name="${html(item.name)}" data-track-event="${html(item.event?.eventID || '')}">${isTracked(item.kind,item.name,item.event?.eventID || '')?'Tracking ✓':'Track hunt'}</button>${calendar}</div>${evolutionSection('pokemon-evolution')}</div>`;
  updateCountdowns();
  loadEvolutionInto('pokemon-evolution',item);
}
function openPokemonDetail(card) {
  const item=pokemonDetailData(card.dataset.pokemonKind,card.dataset.pokemonName,card.dataset.pokemonEvent || '');
  if(!item)return;
  state.activePokemon=item;state.familyAppearance='normal';renderPokemonDetail(item);
  const dialog=$('pokemon-detail');if(!dialog.open)dialog.showModal();
}

async function hydratePokemonInfo() {
  const max = maxEncounters();
  const species = [...new Set([...max.map(p => p.species),...scheduledRaids().filter(r => /^shadow\s/i.test(r.name)).map(r => r.name.replace(/^shadow\s+/i,'').replace(/\s*\(.+\)/,''))])];
  await Promise.all(species.filter(name => !state.pokemonInfo[name.toLowerCase()]).map(async name => {
    const slug = name.toLowerCase().replace(/[^a-z0-9 -]/g,'').replace(/\s+/g,'-');
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(),8500);
    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${slug}`,{signal:controller.signal});
      if (!response.ok) return;
      const data = await response.json();
      state.pokemonInfo[name.toLowerCase()] = {id:data.id,legendary:data.is_legendary};
    } catch {} finally {clearTimeout(timeout);}
  }));
  await Promise.all([...new Set(max.filter(p => p.name.startsWith('Gigantamax')).map(p => p.species))].filter(name => !state.pokemonInfo['gmax:'+name.toLowerCase()]).map(async name => {
    const slug=name.toLowerCase().replace(/[^a-z0-9 -]/g,'').replace(/\s+/g,'-');
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),8500);
    try {
      const response=await fetch(`https://pokeapi.co/api/v2/pokemon/${slug}-gmax`,{signal:controller.signal});
      if (!response.ok) return;
      const sprites=(await response.json()).sprites;
      const formImage=sprites?.other?.['official-artwork']?.front_default || sprites?.other?.home?.front_default || sprites?.front_default;
      if (formImage) state.pokemonInfo['gmax:'+name.toLowerCase()]={image:formImage};
    } catch {} finally {clearTimeout(timeout);}
  }));
  render();
}
async function hydrateShinyForms() {
  const names=[...state.raids,...scheduledRaids(),...state.eggs,...researchCards(),...eventEncounters(),...maxEncounters()].map(p=>p.name);
  const forms=[...new Set(names.map(pokemonForm).filter(Boolean))].filter(form=>!Object.hasOwn(state.shinyForms,form));
  await Promise.all(forms.map(async form=>{
    state.shinyForms[form]=null;
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8500);
    try {
      const response=await fetch(`https://pokeapi.co/api/v2/pokemon/${form}`,{signal:controller.signal});
      if(response.ok){const sprites=(await response.json()).sprites;state.shinyForms[form]=sprites?.other?.['official-artwork']?.front_shiny || sprites?.other?.home?.front_shiny || sprites?.front_shiny || null;}
    } catch {} finally {clearTimeout(timeout);}
  }));
  if(state.appearance==='shiny')renderHunt();
}

function eventCard(event, compact=false) {
  const start = parse(event.start), end = parse(event.end), live = start <= now();
  const spotlight = event.extraData?.spotlight;
  const subtitle = spotlight?.canBeShiny ? `${spotlight.name} can be shiny${spotlight.bonus ? ' · ' + spotlight.bonus : ''}` : event.heading || event.eventType.replaceAll('-',' ');
  return `<article class="card event-card" data-event-id="${html(event.eventID)}"><div class="date-tile"><span>${html(new Intl.DateTimeFormat(undefined,{month:'short'}).format(start))}</span><b>${start.getDate()}</b><span>${html(day(start))}</span></div><div class="card-main"><div class="card-top"><h4>${html(event.name)}</h4>${live ? '<span class="live-chip">LIVE</span>' : ''}</div><p class="meta">${html(subtitle)}</p><p class="meta">${html(shortDate(start))} ${html(time(start))} – ${html(shortDate(end))} ${html(time(end))}</p>${countdownMarkup(event.start,event.end)}<div class="event-actions"><button class="event-open" type="button">View details</button><button class="calendar-button" data-calendar="${html(event.eventID)}" aria-label="Add ${html(event.name)} to calendar">Add to Calendar</button></div></div></article>`;
}

function eventDescription(event) {
  const type=event.eventType,heading=event.heading || type.replaceAll('-',' ');
  const spotlight=event.extraData?.spotlight;
  const bosses=event.extraData?.raidbattles?.bosses || [];
  const community=event.extraData?.communityday;
  if(spotlight?.name)return `${spotlight.name} is the featured Spotlight Hour Pokémon. It appears more often during the event${spotlight.bonus ? `, with ${spotlight.bonus}` : ''}. Spotlight Hour uses the species’ normal shiny rate.`;
  if(bosses.length)return `${bosses.map(b=>b.name).join(', ')} ${bosses.length===1 ? 'is' : 'are'} featured in raids during this rotation. Open a raid card from the Hunt page for shiny odds, typing and counter-search details.`;
  if(type==='community-day')return `${community?.spawns?.map(p=>p.name).filter(Boolean).join(', ') || event.name.replace(/ Community Day.*$/i,'')} is featured with increased wild encounters during Community Day hours and the event shiny-rate estimate shown in the Hunt page.`;
  if(['max-battles','max-mondays'].includes(type))return `A timed Max Battle event featuring the Pokémon named above. The Hunt page shows the available Max form and its current shiny-rate estimate.`;
  if(/hatch day/i.test(event.name))return `A Hatch Day focused on the named Pokémon. Eligible event eggs obtained during the event use the Hatch Day shiny-rate estimate shown in the Hunt page.`;
  if(/city safari/i.test(event.name))return `A location-based Pokémon GO City Safari event in the named city. Access, encounters and bonuses may be restricted to that location.`;
  if(type==='raid-day')return `A limited-time Raid Day featuring the named raid boss. The boosted 1/10 guide rate applies only to the named boss during the local event hours.`;
  return `${heading} running during the local times shown above. Availability and bonuses can vary by event and location.`;
}
function eventHighlights(event) {
  const values=[];
  const spotlight=event.extraData?.spotlight;
  const bosses=event.extraData?.raidbattles?.bosses || [];
  const generic=event.extraData?.generic;
  if(spotlight?.bonus)values.push(spotlight.bonus);
  if(spotlight?.canBeShiny)values.push(`${spotlight.name} can be shiny`);
  if(bosses.length)values.push(`Raid bosses: ${bosses.map(b=>b.name).join(', ')}`);
  if(bosses.some(b=>b.canBeShiny))values.push('Shiny-capable raid boss listed');
  if(generic?.hasSpawns)values.push('Wild spawns included');
  if(generic?.hasFieldResearchTasks)values.push('Field research included');
  return values;
}
function openEventDetail(eventId) {
  const event=state.events.find(item=>item.eventID===eventId);
  if(!event)return;
  const start=parse(event.start),end=parse(event.end),url=safeUrl(event.link),highlights=eventHighlights(event);
  $('event-detail-content').innerHTML=`<div class="raid-modal-top"><span class="eyebrow">EVENT DETAILS</span><button class="event-close" type="button" aria-label="Close event details">✕</button></div><div class="event-modal-heading"><div class="date-tile"><span>${html(new Intl.DateTimeFormat(undefined,{month:'short'}).format(start))}</span><b>${start.getDate()}</b><span>${html(day(start))}</span></div><div><h2>${html(event.name)}</h2><p class="meta">${html(event.heading || event.eventType.replaceAll('-',' '))}</p></div></div><div class="event-modal-body"><p class="event-time">${html(shortDate(start))} ${html(time(start))} – ${html(shortDate(end))} ${html(time(end))}</p>${countdownMarkup(event.start,event.end)}<div class="detail-label">What to expect</div><p class="event-description">${html(eventDescription(event))}</p>${highlights.length ? `<div class="detail-label">Highlights</div><ul class="event-highlights">${highlights.map(item=>`<li>${html(item)}</li>`).join('')}</ul>` : ''}<div class="event-actions"><button class="calendar-button" data-calendar="${html(event.eventID)}">Add to Calendar</button>${url ? `<a class="source-link" href="${html(url)}" target="_blank" rel="noopener">Source page ↗</a>` : ''}</div></div>`;
  const dialog=$('event-detail');
  if(!dialog.open)dialog.showModal();
  updateCountdowns();
}

function section(title, items, renderCard) {
  if (!items.length) return '';
  return `<section class="card-section"><div class="section-head"><h3>${title}</h3><span>${items.length} ${items.length === 1 ? 'target' : 'targets'}</span></div><div class="card-grid">${items.map(renderCard).join('')}</div></section>`;
}

function matchingRaidEvent(name) {
  const wanted=String(name).replace(/^shadow\s+/i,'').toLowerCase();
  return validEvents().find(event=>['raid-battles','raid-day','raid-hour','raid-weekend','elite-raids'].includes(event.eventType)&&(event.extraData?.raidbattles?.bosses || []).some(b=>String(b.name).replace(/^shadow\s+/i,'').toLowerCase()===wanted));
}

function trackableHunts() {
  const raids=[...state.raids,...scheduledRaids()].filter(p=>p.canBeShiny!==false).map(p=>{const event=p.event || matchingRaidEvent(p.name);return {kind:'raid',name:p.name,eventId:p.event?.eventID || '',image:p.image,odds:raidRate(p),start:event?.start,end:event?.end,label:p.tier,raid:p};});
  const eggs=state.eggs.filter(p=>p.canBeShiny!==false).map(p=>({kind:'egg',name:p.name,eventId:'',image:p.image,odds:rate('1/64','estimated','Egg hatch'),label:p.eggType || 'Egg'}));
  const research=researchCards().map(p=>({kind:'research',name:p.name,eventId:'',image:p.image,odds:rate('1/512','estimated','Field research fallback'),label:'Field research'}));
  const events=eventEncounters().map(p=>({kind:'event',name:p.name,eventId:p.event.eventID,image:p.image,odds:p.odds,start:p.event.start,end:p.event.end,label:p.event.name,event:p.event}));
  const max=maxEncounters().map(p=>({kind:'max',name:p.name,eventId:p.event.eventID,image:p.image,odds:p.odds,start:p.event.start,end:p.event.end,label:p.event.name,event:p.event}));
  return [...raids,...events,...max,...eggs,...research];
}
function oddsNumber(item) { return Number(String(item.odds?.value || '').split('/')[1]) || 9999; }
function setTrackedHunt(item) {
  state.trackedHunt=item ? {kind:item.kind,name:item.name,eventId:item.eventId || '',image:item.image || '',label:item.label || '',odds:item.odds?.value || '',start:item.start || '',end:item.end || ''} : null;
  try { if(item)localStorage.setItem('tracked-hunt-v1',JSON.stringify(state.trackedHunt)); else localStorage.removeItem('tracked-hunt-v1'); } catch {}
  render();
  if(state.activeRaid)renderRaidDetail(state.activeRaid.raid,state.activeRaid.metadata);
  if(state.activePokemon&&$('pokemon-detail').open)renderPokemonDetail(state.activePokemon);
  showToast(item ? `${item.name} is now your active hunt` : 'Active hunt cleared');
}
function dashboardMini(item) {
  const timing=item.start ? countdownMarkup(item.start,item.end) : '<span class="availability-now">Available now</span>';
  return `<article class="opportunity-mini">${image(item.image,item.name,true,true)}<div><span class="opportunity-kind">${html(item.kind==='raid' ? 'RAID' : item.kind==='max' ? 'MAX BATTLE' : 'EVENT')}</span><h4>${html(item.name)}</h4><p>${html(item.odds.value)} shiny rate</p>${timing}${trackButton(item.kind,item.name,item.eventId)}</div></article>`;
}
function renderDashboard() {
  const all=trackableHunts();
  const found=state.trackedHunt ? all.find(item=>isTracked(item.kind,item.name,item.eventId)) : null;
  const saved=state.trackedHunt;
  const tracked=found ? {...found,start:found.start || saved?.start,end:found.end || saved?.end} : (saved?.name ? {kind:saved.kind,name:saved.name,eventId:saved.eventId || '',image:saved.image,label:saved.label || 'Saved hunt',odds:{value:saved.odds || 'Rate saved'},start:saved.start,end:saved.end} : null);
  const currentRaids=all.filter(item=>item.kind==='raid'&&!item.start).sort((a,b)=>oddsNumber(a)-oddsNumber(b)||a.name.localeCompare(b.name));
  const timed=all.filter(item=>item.start&&parse(item.end)>now()).sort((a,b)=>{
    const activeA=parse(a.start)<=now(),activeB=parse(b.start)<=now();
    return Number(activeB)-Number(activeA)||parse(a.start)-parse(b.start)||oddsNumber(a)-oddsNumber(b);
  });
  const bestTimed=[...timed].sort((a,b)=>oddsNumber(a)-oddsNumber(b)||parse(a.start)-parse(b.start));
  const suggestions=[];
  [currentRaids[0],timed[0],bestTimed[0]].forEach(item=>{if(item&&!suggestions.some(x=>huntKey(x.kind,x.name,x.eventId)===huntKey(item.kind,item.name,item.eventId))&&!isTracked(item.kind,item.name,item.eventId))suggestions.push(item);});
  let trackedTiming='<span class="availability-now">Available now</span>';
  if(tracked?.start&&tracked?.end){
    const start=parse(tracked.start),end=parse(tracked.end),remoteEnd=new Date(end.getTime()+24*60*60*1000);
    const startLabel=tracked.kind==='raid' ? 'Local raids start' : 'Hunt starts',endLabel=tracked.kind==='raid' ? 'Local raids end' : 'Hunt ends';
    if(now()<start)trackedTiming=`${countdownTo(start,startLabel)}<small>${html(shortDate(start))} at ${html(time(start))}</small>`;
    else if(now()<end)trackedTiming=`${countdownTo(end,endLabel)}<small>Local end: ${html(shortDate(end))} at ${html(time(end))}</small>`;
    else if(tracked.kind==='raid'&&now()<remoteEnd)trackedTiming=`<span class="local-ended">Local window ended</span>${countdownTo(remoteEnd,'Estimated remote window ends')}<small>About ${html(shortDate(remoteEnd))} at ${html(time(remoteEnd))} your time</small>`;
    else trackedTiming='<span class="local-ended">This timed hunt has ended</span>';
  }
  const trackedPanel=tracked ? `<div class="tracked-hunt">${image(tracked.image,tracked.name,true,true)}<div class="tracked-main"><span class="opportunity-kind">ACTIVE HUNT</span><h3>${html(tracked.name)}</h3><p>${html(tracked.label)} · ${html(tracked.odds.value)}</p><div class="tracked-timing">${trackedTiming}</div><div class="tracked-actions"><button class="clear-hunt" type="button">Stop tracking</button>${tracked.kind==='raid' ? '<a href="https://campfire.nianticlabs.com/" target="_blank" rel="noopener">Campfire ↗</a><a href="https://apps.apple.com/app/poke-genie-remote-raid-iv-pvp/id1143920524" target="_blank" rel="noopener">Poké Genie ↗</a><a href="https://apps.apple.com/app/pokeraid-raid-from-home/id1507659524" target="_blank" rel="noopener">PokeRaid ↗</a>' : ''}</div></div></div>` : '<div class="dashboard-empty"><strong>No active hunt yet</strong><span>Tap “Track hunt” on any Pokémon to pin it here.</span></div>';
  $('opportunity-dashboard').innerHTML=`<div class="dashboard-title"><div><span class="eyebrow">TODAY’S OPPORTUNITIES</span><h2>Your hunt dashboard</h2></div><span id="local-clock" class="local-clock"></span></div>${trackedPanel}${suggestions.length ? `<div class="dashboard-subhead">Best now & next</div><div class="opportunity-strip">${suggestions.map(dashboardMini).join('')}</div>` : ''}<p class="dashboard-note">Countdowns use this device’s local time. A remote cutoff is a 24-hour time-zone estimate, not guaranteed lobby availability.</p>`;
  updateCountdowns();
}

function renderHunt() {
  const q = state.query.toLowerCase();
  const match = (...parts) => parts.some(part => String(part || '').toLowerCase().includes(q));
  const raids = state.raids.filter(r => match(r.name,r.tier));
  const upcomingRaids = scheduledRaids().filter(r => match(r.name,r.tier,r.event.name));
  const eggs = state.eggs.filter(e => (state.filter !== 'eggs' || state.eggDistance === 'all' || e.eggType?.startsWith(state.eggDistance + ' ')) && match(e.name,e.eggType));
  const research = researchCards().filter(r => match(r.name,r.task));
  const events = eventEncounters().filter(p => match(p.name,p.event.name));
  const max = maxEncounters().filter(p => match(p.name,p.event.name));
  const eggView = state.filter === 'eggs';
  $('egg-pool-row').classList.toggle('hidden', !eggView);
  $('egg-explainer').classList.toggle('hidden', !eggView);
  $('raid-controls').classList.toggle('hidden',state.filter !== 'raids');
  let content = '';
  if (state.filter === 'all' || state.filter === 'events') content += section('Featured event Pokémon',events,eventEncounterCard);
  if (state.filter === 'all') {
    content += section('Current raid bosses',raids,raidCard);
    content += section('Upcoming raid bosses',q ? upcomingRaids : upcomingRaids.slice(0,6),raidCard);
    if (!q && upcomingRaids.length > 6) content += '<button class="view-all" id="view-raids">See all upcoming raids and sort →</button>';
  }
  if (state.filter === 'raids') {
    const listed = raidList([...(state.raidScope === 'upcoming' ? [] : raids),...(state.raidScope === 'current' ? [] : upcomingRaids)]);
    content += section(state.raidScope === 'current' ? 'Current raid bosses' : state.raidScope === 'upcoming' ? 'Upcoming raid bosses' : 'Current & upcoming raids',listed,raidCard);
  }
  if (state.filter === 'all' || state.filter === 'max') content += section('Max Battle Pokémon',max,maxCard);
  if (eggView) content += section(state.eggDistance === 'all' ? 'Current egg hatches' : state.eggDistance + ' km egg hatches',eggs,eggCard);
  if (state.filter === 'all' && eggs.length) content += section('Egg hatches', q ? eggs : eggs.slice(0,6),eggCard) + (eggs.length > 6 && !q ? '<button class="view-all" id="view-eggs">See all egg Pokémon and hatch rarity →</button>' : '');
  if (state.filter === 'all' || state.filter === 'research') content += section('Field research',research,researchCard);
  $('hunt-content').innerHTML = content || `<div class="empty">${state.failed && !state.raids.length && !state.events.length && !state.eggs.length ? 'Live data is unavailable right now. Check your connection and try again.' : 'No matching Pokémon in the current feed.'}<br><button id="empty-action">${state.failed ? 'Try again' : 'Clear filters'}</button></div>`;
  if ($('view-eggs')) $('view-eggs').onclick = () => document.querySelector('[data-filter="eggs"]').click();
  if ($('view-raids')) $('view-raids').onclick = () => {document.querySelector('[data-filter="raids"]').click();document.querySelector('[data-raid-scope="upcoming"]').click();};
  const action = $('empty-action'); if (action) action.onclick = () => { if (state.failed) refresh(); else { $('search').value=''; state.query=''; state.filter='all'; document.querySelector('[data-filter="all"]').click(); } };
  updateCountdowns();
}

function renderCalendar() {
  const all = validEvents();
  const eventKind = e => {
    if (['raid-battles','raid-day','raid-hour','raid-weekend','elite-raids'].includes(e.eventType)) return 'raids';
    if (['max-battles','max-mondays'].includes(e.eventType)) return 'max';
    if (e.eventType === 'pokemon-spotlight-hour') return 'spotlight';
    if (e.eventType === 'community-day') return 'community';
    if (/hatch day/i.test(e.name)) return 'hatch';
    return 'other';
  };
  const list = all.filter(e => (state.eventFilter === 'all' || (state.eventFilter === 'live' ? parse(e.start) <= now() : parse(e.start) > now())) && (state.eventType === 'all' || eventKind(e) === state.eventType));
  if (state.eventSort === 'latest') list.sort((a,b) => parse(b.start)-parse(a.start));
  if (state.eventSort === 'name') list.sort((a,b) => a.name.localeCompare(b.name));
  const label = state.eventFilter === 'live' ? 'live events' : 'upcoming events';
  $('calendar-content').innerHTML = list.length ? `<div class="section-head"><h3>${state.eventFilter === 'live' ? 'Happening now' : 'Pokémon GO events'}</h3><span>${list.length} ${label}</span></div><div class="card-grid calendar-grid">${list.map(e => eventCard(e)).join('')}</div>` : `<div class="empty">${state.failed && !state.events.length ? 'Events could not be loaded. Try refreshing.' : 'No events in this view right now.'}</div>`;
}

function render() { renderDashboard(); renderHunt(); renderCalendar(); updateCountdowns(); }
function setView(view) {
  state.view = view;
  const calendar = view === 'calendar';
  $('hunt-view').classList.toggle('hidden',calendar);
  $('calendar-view').classList.toggle('hidden',!calendar);
  $('view-heading').innerHTML = calendar ? 'Event calendar<span class="spark">✦</span>' : 'Shiny targets<span class="spark">✦</span>';
  $('view-subtitle').textContent = calendar ? 'Live and upcoming events in your local time.' : 'Current encounters and upcoming hunts.';
  for (const [id,active] of [['hunt-tab',!calendar],['calendar-tab',calendar]]) {
    $(id).classList.toggle('active',active);
    if (active) $(id).setAttribute('aria-current','page'); else $(id).removeAttribute('aria-current');
  }
  window.scrollTo({top:0,behavior:'instant'});
}

function icsText(value) { return String(value || '').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'); }
function icsDate(date, isUtc) {
  const y = isUtc ? date.getUTCFullYear() : date.getFullYear();
  const m = isUtc ? date.getUTCMonth()+1 : date.getMonth()+1;
  const d = isUtc ? date.getUTCDate() : date.getDate();
  const h = isUtc ? date.getUTCHours() : date.getHours();
  const min = isUtc ? date.getUTCMinutes() : date.getMinutes();
  const sec = isUtc ? date.getUTCSeconds() : date.getSeconds();
  return [y,m,d,h,min,sec].map((n,i) => String(n).padStart(i===0?4:2,'0')).join('') + (isUtc?'Z':'');
}
function calendarFile(event) {
  const start = parse(event.start), end = parse(event.end);
  const globallyTimed = /Z$/i.test(event.start);
  const description = `Pokémon GO event. Details: ${safeUrl(event.link) || 'https://leekduck.com/events/'}\nSource: Leek Duck via ScrapedDuck.`;
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Shiny Hunt Guide//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',`UID:${String(event.eventID).replace(/[^a-z0-9_-]/gi,'')}@shinyhunt.guide`,`DTSTAMP:${icsDate(now(),true)}`,`DTSTART:${icsDate(start,globallyTimed)}`,`DTEND:${icsDate(end,globallyTimed)}`,`SUMMARY:${icsText(event.name)}`,`DESCRIPTION:${icsText(description)}`,'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Pokémon GO event starts soon','TRIGGER:-PT30M','END:VALARM','END:VEVENT','END:VCALENDAR'];
  const file = new File([lines.join('\r\n')+'\r\n'],`${String(event.eventID).replace(/[^a-z0-9_-]/gi,'-') || 'pokemon-go-event'}.ics`,{type:'text/calendar'});
  return file;
}
async function addCalendar(event) {
  const file = calendarFile(event);
  if (navigator.canShare?.({files:[file]})) {
    try { await navigator.share({files:[file], title:event.name}); return; } catch (error) { if (error.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a'); a.href=url; a.download=file.name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url),30000);
  showToast('Open the downloaded .ics file to add this event');
}
let toastTimer;
function showToast(message) { $('toast').textContent=message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4300); }

$('refresh').addEventListener('click',refresh);
$('search').addEventListener('input',e => { state.query=e.target.value.trim(); renderHunt(); });
$('hunt-tab').addEventListener('click',()=>setView('hunt'));
$('calendar-tab').addEventListener('click',()=>setView('calendar'));
document.querySelectorAll('.filter').forEach(button => button.onclick=()=>{ state.filter=button.dataset.filter; document.querySelectorAll('.filter').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});renderHunt(); });
document.querySelectorAll('.egg-pool').forEach(button => button.onclick=()=>{ state.eggDistance=button.dataset.distance; document.querySelectorAll('.egg-pool').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});renderHunt(); });
document.querySelectorAll('.raid-scope').forEach(button => button.onclick=()=>{ state.raidScope=button.dataset.raidScope; document.querySelectorAll('.raid-scope').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});renderHunt(); });
$('raid-type').addEventListener('change',e=>{state.raidType=e.target.value;renderHunt();});
$('raid-sort').addEventListener('change',e=>{state.raidSort=e.target.value;renderHunt();});
$('raid-shiny-only').addEventListener('change',e=>{state.raidShinyOnly=e.target.checked;renderHunt();});
document.querySelectorAll('.appearance').forEach(button=>button.onclick=()=>{
  state.appearance=button.dataset.appearance;
  document.querySelectorAll('.appearance').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});
  $('shiny-preview-note').classList.toggle('hidden',state.appearance!=='shiny');
  renderHunt();
  if(state.appearance==='shiny')hydrateShinyForms();
});
document.querySelectorAll('.event-filter').forEach(button => button.onclick=()=>{ state.eventFilter=button.dataset.eventFilter; document.querySelectorAll('.event-filter').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});renderCalendar(); });
$('event-type').addEventListener('change',e=>{state.eventType=e.target.value;renderCalendar();});
$('event-sort').addEventListener('change',e=>{state.eventSort=e.target.value;renderCalendar();});
$('raid-detail').addEventListener('click',e=>{if(e.target===$('raid-detail'))$('raid-detail').close();});
$('raid-detail').addEventListener('close',()=>{state.activeRaid=null;});
$('pokemon-detail').addEventListener('click',e=>{if(e.target===$('pokemon-detail'))$('pokemon-detail').close();});
$('pokemon-detail').addEventListener('close',()=>{state.activePokemon=null;});
$('event-detail').addEventListener('click',e=>{if(e.target===$('event-detail'))$('event-detail').close();});
document.addEventListener('click',async e => {
  if(e.target.closest('.raid-close')){$('raid-detail').close();return;}
  if(e.target.closest('.pokemon-close')){$('pokemon-detail').close();return;}
  if(e.target.closest('.event-close')){$('event-detail').close();return;}
  const familyButton=e.target.closest('[data-family-appearance]');
  if(familyButton){state.familyAppearance=familyButton.dataset.familyAppearance;if(state.activeRaid)loadEvolutionInto('raid-evolution',state.activeRaid.raid);if(state.activePokemon)loadEvolutionInto('pokemon-evolution',state.activePokemon);return;}
  if(e.target.closest('.clear-hunt')){setTrackedHunt(null);return;}
  const tracker=e.target.closest('[data-track-name]');
  if(tracker){
    if(isTracked(tracker.dataset.trackKind,tracker.dataset.trackName,tracker.dataset.trackEvent)){setTrackedHunt(null);return;}
    const item=trackableHunts().find(p=>huntKey(p.kind,p.name,p.eventId)===huntKey(tracker.dataset.trackKind,tracker.dataset.trackName,tracker.dataset.trackEvent));
    if(item)setTrackedHunt(item);
    return;
  }
  const copy=e.target.closest('#copy-counter-search');
  if(copy){
    try {
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(copy.dataset.search);
      else {const field=document.createElement('textarea');field.value=copy.dataset.search;document.body.append(field);field.select();const ok=document.execCommand('copy');field.remove();if(!ok)throw new Error('Copy unavailable');}
      copy.textContent='Copied ✓';
    } catch {copy.textContent='Select the search text to copy';}
    return;
  }
  const button=e.target.closest('[data-calendar]');
  if(button){const event=state.events.find(item => item.eventID === button.dataset.calendar); if(event)addCalendar(event);return;}
  const eventCard=e.target.closest('.event-card');
  if(eventCard&&(!e.target.closest('button,a,input,select')||e.target.closest('.event-open'))){openEventDetail(eventCard.dataset.eventId);return;}
  const pokemonCard=e.target.closest('.pokemon-card');
  if(pokemonCard&&(!e.target.closest('button,a,input,select')||e.target.closest('.pokemon-open'))){openPokemonDetail(pokemonCard);return;}
  const card=e.target.closest('.raid-card');
  if(card&&(!e.target.closest('button,a,input,select')||e.target.closest('.raid-open')))openRaidDetail(card);
});
const oddsRules = [
  ['1/512','Unboosted wild / Spotlight Hour','guide rate'],
  ['1/25','Featured Community Day spawn during event','guide rate'],
  ['1/10','Named featured Raid Day boss during event','event-specific'],
  ['1/10','Featured Hatch Day Pokémon in eligible eggs','event-specific'],
  ['1/20','Tier 5 / Legendary raid','guide rate'],
  ['1/20','Tier 5 Shadow raid; Legendary Max Battle; Gigantamax','estimated / unknown'],
  ['1/64','Mega, Tier 1/3, low-tier Shadow raids','estimated'],
  ['1/64','Egg hatch; Dynamax / Max Battle','estimated / unknown'],
  ['1/512','Research fallback; event research can differ','estimated']
];
$('odds-list').innerHTML = oddsRules.map(([value,label,confidence]) => `<div class="odds-row"><strong>${value}</strong><span>${label}</span><small>${confidence}</small></div>`).join('');
if ('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
setInterval(updateCountdowns,30000);
refresh();
