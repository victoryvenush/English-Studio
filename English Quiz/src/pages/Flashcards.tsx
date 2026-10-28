import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronLeft, ChevronRight, Layers3, RotateCcw, Shuffle, Sparkles, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { allFlashcards, topics } from '../data/topics';
import type { Snapshot } from '../lib/model';
import { useStudyTimer } from '../lib/useStudyTimer';
import { ProgressBar } from '../components/Shared';

type Props = { snapshot: Snapshot; initialTopic: string; onReview: (id: string, status: 'known' | 'review', seconds: number) => Promise<void> };

function shuffled<T>(items: T[], seed: number): T[] {
  const output = [...items];
  let state = seed || 1;
  for (let i = output.length - 1; i > 0; i -= 1) { state = (state * 16807) % 2147483647; const j = state % (i + 1); [output[i], output[j]] = [output[j], output[i]]; }
  return output;
}

export function FlashcardsPage({ snapshot, initialTopic, onReview }: Props) {
  const [topic, setTopic] = useState(initialTopic);
  const [category, setCategory] = useState<'All' | 'Grammar' | 'Vocabulary'>('All');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [seed, setSeed] = useState(0);
  const [busy, setBusy] = useState(false);
  const takeTime = useStudyTimer();
  const cards = useMemo(() => {
    const filtered = allFlashcards.filter((card) => (topic === 'all' || card.topicId === topic) && (category === 'All' || card.category === category) && (!reviewOnly || snapshot.cards.some((record) => record.id === card.id && record.status === 'review')));
    return seed ? shuffled(filtered, seed) : filtered;
  }, [topic, category, reviewOnly, snapshot.cards, seed]);
  const safeIndex = Math.min(index, Math.max(0, cards.length - 1));
  const card = cards[safeIndex];
  const move = (delta: number) => { setIndex((value) => Math.max(0, Math.min(cards.length - 1, value + delta))); setFlipped(false); };
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  const changeFilter = () => { setIndex(0); setFlipped(false); };
  const record = card ? snapshot.cards.find((item) => item.id === card.id) : undefined;
  const mark = async (status: 'known' | 'review') => {
    if (!card || busy) return;
    setBusy(true);
    try { await onReview(card.id, status, takeTime()); setFlipped(false); if (!reviewOnly) setIndex(Math.min(safeIndex + 1, cards.length - 1)); }
    finally { setBusy(false); }
  };
  return <div className="standard-page flashcard-page page-enter"><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> MAKE IT STICK</div><h1>Flashcard Studio<span className="heading-period">.</span></h1><p>A few little flips can make a big difference.</p></div><span className="page-illustration"><Layers3 size={28} /></span></div>
    <div className="flash-layout"><div className="flash-main"><div className="flash-toolbar"><div className="segmented" role="group" aria-label="Flashcard category">{(['All', 'Grammar', 'Vocabulary'] as const).map((item) => <button key={item} className={category === item ? 'active' : ''} onClick={() => { setCategory(item); setTopic('all'); changeFilter(); }}>{item}</button>)}</div><button className="subtle-button" onClick={() => { setSeed(Math.floor(Math.random() * 1000000) + 1); changeFilter(); }}><Shuffle size={16} /> Shuffle</button></div>
      <div className="flash-select-row"><label><span className="sr-only">Filter flashcards by topic</span><select value={topic} onChange={(event) => { setTopic(event.target.value); changeFilter(); }}><option value="all">All topics</option>{topics.filter((item) => category === 'All' || item.category === category).map((item) => <option key={item.id} value={item.id}>{item.short}</option>)}</select></label><button className={`review-filter ${reviewOnly ? 'active' : ''}`} onClick={() => { setReviewOnly(!reviewOnly); changeFilter(); }}>Review again <span>{snapshot.cards.filter((item) => item.status === 'review').length}</span></button></div>
      {card ? <><div className="flash-counter"><span>CARD {safeIndex + 1} OF {cards.length}</span><span>{Math.round((safeIndex + 1) / cards.length * 100)}% through this set</span></div><ProgressBar value={(safeIndex + 1) / cards.length * 100} /><button className={`flash-card ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(!flipped)} aria-label={flipped ? 'Show question side' : 'Flip card to reveal answer'}><span className="flash-card-top"><span><Sparkles size={15} /> {topics.find((item) => item.id === card.topicId)?.short}</span><span>{flipped ? 'ANSWER' : 'QUESTION'}</span></span><span className="flash-card-body"><span className="flash-card-label">{flipped ? 'HERE IS THE ANSWER' : 'TAKE A MOMENT TO THINK'}</span><strong>{flipped ? card.back : card.front}</strong></span><span className="flip-hint"><RotateCcw size={15} /> {flipped ? 'Click to see question' : 'Click to flip the card'}</span></button><div className="flash-controls"><button className="round-control" onClick={() => move(-1)} disabled={safeIndex === 0} aria-label="Previous card"><ChevronLeft size={20} /></button><button className="review-button" disabled={busy} onClick={() => mark('review')}><X size={18} /> Review again</button><button className="know-button" disabled={busy} onClick={() => mark('known')}><Check size={18} /> Know it</button><button className="round-control" onClick={() => move(1)} disabled={safeIndex >= cards.length - 1} aria-label="Next card"><ChevronRight size={20} /></button></div><div className="flash-bottom"><span>{record ? `Last marked: ${record.status === 'known' ? 'Know it' : 'Review again'}` : 'Not reviewed yet'}</span><button onClick={() => { setIndex(0); setFlipped(false); }}><RotateCcw size={14} /> Restart session</button></div></> : <div className="empty-state flash-empty"><Layers3 size={32} /><h3>{reviewOnly ? 'Nothing to review just yet' : 'No cards in this set'}</h3><p>{reviewOnly ? 'Mark a card "Review again" and it will be waiting here.' : 'Choose another topic or category.'}</p><button className="button button-outline" onClick={() => { setReviewOnly(false); setTopic('all'); setCategory('All'); changeFilter(); }}>See all cards <ArrowRight size={16} /></button></div>}
    </div><aside className="flash-aside"><section className="aside-panel"><div className="section-kicker">A SMARTER WAY TO STUDY</div><h2>Little cards. Big recall.</h2><p>Read the question, flip to reveal, then decide whether you know it or want another look.</p><div className="flash-guide"><span><BookOpen size={18} /></span><div><strong>{allFlashcards.length} cards</strong><small>Across all 17 topics</small></div></div><div className="flash-guide"><span><Check size={18} /></span><div><strong>{snapshot.cards.filter((item) => item.status === 'known').length} known</strong><small>Cards you feel good about</small></div></div><div className="flash-guide"><span><RotateCcw size={18} /></span><div><strong>{snapshot.cards.filter((item) => item.status === 'review').length} to revisit</strong><small>Practice makes progress</small></div></div><p className="keyboard-hint"><ArrowLeft size={14} /> Use arrow keys to move <ArrowRight size={14} /></p></section></aside></div>
  </div>;
}