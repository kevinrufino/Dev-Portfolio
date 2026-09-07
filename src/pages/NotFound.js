import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SAVE_KEY, TRAPS, freshGame, multiplier, rate, cost, target, complete, grant, advance, buy, loadGame } from '../game/homeAlone.js';
import './not-found.css';

const number = n => Math.floor(n).toLocaleString();
export default function NotFound() {
  const [game, setGame] = useState(() => { try { return loadGame(window.localStorage); } catch { return freshGame(); } });
  const [message, setMessage] = useState('The family left for Paris. They forgot Kevin. And this page.');
  const [bump, setBump] = useState(0);
  const [resetting, setResetting] = useState(false);
  const [canSave, setCanSave] = useState(true);
  const current = useRef(game);
  current.current = game;
  useEffect(() => {
    const title = document.title;
    document.title = '404 — Kevin is home alone';
    window.scrollTo(0, 0);
    const save = () => { try { window.localStorage.setItem(SAVE_KEY, JSON.stringify(current.current)); } catch { setCanSave(false); } };
    const timer = setInterval(() => setGame(g => advance(g)), 250);
    const saver = setInterval(save, 3000);
    window.addEventListener('pagehide', save);
    return () => { save(); clearInterval(timer); clearInterval(saver); window.removeEventListener('pagehide', save); document.title = title; };
  }, []);
  const scavenge = () => { setGame(g => grant(advance(g), 1 * multiplier(g))); setBump(n => n + 1); };
  const purchase = i => {
    setGame(g => buy(advance(g), i));
    setMessage(`${TRAPS[i].name} ready. Kevin approves.`);
  };
  const raidReady = game.savedAt >= game.raidAt;
  const defend = () => {
    if (!raidReady) return;
    setGame(g => {
      const updated = advance(g);
      if (updated.savedAt < updated.raidAt) return updated;
      return { ...grant(updated, Math.max(15, rate(updated) * 12)), raidAt: updated.savedAt + 45000 };
    });
    setMessage('The burglars slipped up. Bonus supplies recovered!');
  };
  const progress = Math.min(100, game.earned / target(game) * 100);
  const stage = Math.min(3, Math.floor(progress / 25));
  return (
    <main className="lost-game">
      <header className="lost-nav"><Link to="/" aria-label="Kevin Rufino portfolio home">kevin rufino®</Link><Link to="/">Back to portfolio ↗</Link></header>
      <section className="lost-heading"><div><p className="lost-error">404 / Page not found</p><h1>HOME<br /><span>ALONE.</span></h1></div><div className="lost-intro"><p>Wrong address.<br />Right kid for the job.</p><span>This page is missing. Help Kevin rig the house while the family finds their way home.</span></div></section>
      <div className="lost-layout">
        <section className="lost-play" aria-label="Kevin's house">
          <div className="lost-scene-top"><span>Operation: house sitter</span><span>Vacation {game.wins + 1}</span></div>
          <button className="lost-house" onClick={scavenge} aria-label={`Scavenge supplies, gain ${multiplier(game)} per click`}>
            <svg viewBox="0 0 640 410" aria-hidden="true">
              <defs><pattern id="snow-grid" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="currentColor" opacity=".16" /></pattern></defs>
              <rect width="640" height="410" fill="url(#snow-grid)" />
              <text x="30" y="60" className="lost-svg-note">← PARIS: 4,040 MILES</text>
              <path d="M80 194L320 48L560 194Z" fill="var(--ultra)" /><path d="M405 106V57H441V127" fill="var(--ultra)" />
              <path d="M108 190H532V362H108Z" fill="var(--paper)" stroke="currentColor" strokeWidth="6" />
              <path d="M320 190V362M108 276H532" stroke="currentColor" strokeWidth="6" />
              {[ [145,210], [355,210], [145,298], [355,298] ].map(([x,y],i) => <g key={i}><rect x={x} y={y} width="58" height="43" fill={game.traps[i] ? 'var(--acid)' : 'var(--paper-rule)'} stroke="currentColor" strokeWidth="3" /><text x={x+78} y={y+33} fontSize="32">{game.traps[i] ? TRAPS[i].icon : '·'}</text><text x={x} y={y-7} className="lost-room-label">{TRAPS[i].room.replace('The ', '')}</text></g>)}
              <path d="M78 365H564M56 379H586" stroke="currentColor" strokeWidth="6" />
              <g key={bump} className={bump ? 'lost-kevin lost-hop' : 'lost-kevin'}><rect x="291" y="306" width="28" height="27" fill="var(--acid)" stroke="currentColor" strokeWidth="3" /><path d="M287 333H323V362H287Z" fill="var(--ultra)" /><path d="M298 316H301M309 316H312" stroke="currentColor" strokeWidth="3" /></g>
              <text x="490" y="65" fontSize="24">✳</text><text x="55" y="286" fontSize="30">✳</text>
            </svg>
            <span className="lost-scavenge">Scavenge supplies <span>+{multiplier(game)} / click</span></span>
          </button>
          <div className="lost-scene-bottom"><p key={message} role="status">{message}</p><span>Click the house or use Enter / Space.</span></div>
          <div className="lost-raid"><div><strong>{raidReady ? 'The burglars are at the door!' : 'Keep the change, ya filthy animal.'}</strong><p>{raidReady ? `Spring the traps for +${number(Math.max(15, rate(game) * 12))} supplies.` : `Next burglar visit in ${Math.max(0, Math.ceil((game.raidAt - game.savedAt) / 1000))}s. Your traps keep working.`}</p></div><button onClick={defend} disabled={!raidReady}>Spring traps ↗</button></div>
        </section>
        <aside className="lost-workshop" aria-label="Trap workshop">
          <div className="lost-wallet"><div><span>Supplies</span><strong>{number(game.supplies)}</strong></div><p>+{rate(game).toLocaleString(undefined, { maximumFractionDigits: 1 })}<span>per second</span></p></div>
          <div className="lost-shop-title"><h2>Make yourself at home.</h2><p>Build a trap. It earns supplies automatically.</p></div>
          <div className="lost-traps">{TRAPS.map((trap, i) => <button key={trap.name} className="lost-trap" disabled={game.supplies < cost(game,i) || game.traps[i] >= 100} onClick={() => purchase(i)} aria-label={`Build ${trap.name} for ${number(cost(game,i))} supplies. Owned ${game.traps[i]}`}><span className="lost-trap-icon" aria-hidden="true">{trap.icon}</span><span className="lost-trap-copy"><strong>{trap.name} <small>×{game.traps[i]}</small></strong><span>{trap.detail}</span><em>+{(trap.rate * multiplier(game)).toLocaleString()} / sec</em></span><span className="lost-price">{game.traps[i] >= 100 ? 'Max' : number(cost(game,i))}<small>supplies</small></span></button>)}</div>
          <div className="lost-journey"><div><h2>{complete(game) ? 'KEVIN! We’re home.' : ['Family in Paris', 'Mom caught a flight', 'A ride with the polka band', 'One street from home'][stage]}</h2><span>{Math.floor(progress)}%</span></div><progress value={progress} max="100" aria-label="Family's journey home" /><p>{complete(game) ? 'House saved. Family reunited. Do it all again with +25% to clicks and traps.' : `${number(game.earned)} / ${number(target(game))} total supplies to bring the family home. Spending doesn’t slow the journey.`}</p>{complete(game) && <button className="lost-replay" onClick={() => { setGame(g => freshGame(g.wins + 1)); setMessage('Another vacation. They forgot Kevin. Again.'); }}>Another vacation · +25% earnings ↗</button>}</div>
        </aside>
      </div>
      <footer className="lost-footer"><span>{canSave ? 'Saved on this device. Traps work for up to 4 hours away.' : 'Saving unavailable. Keep this tab open to keep your progress.'}{game.wins > 0 && ` • Earnings ×${multiplier(game)}`}</span>{resetting ? <span>Erase all progress? <button onClick={() => { setGame(freshGame()); setResetting(false); setMessage('A fresh house. A fresh set of bad ideas.'); }}>Yes, reset</button> <button onClick={() => setResetting(false)}>Cancel</button></span> : <button onClick={() => setResetting(true)}>Reset game</button>}</footer>
    </main>
  );
}
