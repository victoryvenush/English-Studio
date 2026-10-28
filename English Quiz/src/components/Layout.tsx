import { Award, BookOpen, ChevronRight, CircleUserRound, Home, Layers3, Settings, BarChart3, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { getStats, type Profile, type Snapshot } from '../lib/model';
import { initials, Logo, ProgressBar } from './Shared';

export type Page = 'home' | 'learn' | 'flashcards' | 'awards' | 'profile' | 'settings' | 'lesson' | 'quizSetup' | 'quiz' | 'result' | 'cancelled';
type Props = { page: Page; profile: Profile; snapshot: Snapshot; navigate: (page: Page) => void; children: ReactNode };

const links = [
  { page: 'home' as const, title: 'Dashboard', mobile: 'Home', icon: Home },
  { page: 'learn' as const, title: 'Explore lessons', mobile: 'Learn', icon: BookOpen },
  { page: 'flashcards' as const, title: 'Flashcard Studio', mobile: 'Flashcards', icon: Layers3 },
  { page: 'awards' as const, title: 'Awards Vault', mobile: 'Awards', icon: Award },
  { page: 'profile' as const, title: 'My progress', mobile: 'Profile', icon: BarChart3 },
];

export function Layout({ page, profile, snapshot, navigate, children }: Props) {
  const stats = getStats(snapshot);
  const selected = page === 'lesson' || page === 'quizSetup' ? 'learn' : page === 'settings' ? 'profile' : page;
  const title = ({ home: 'Dashboard', learn: 'Explore lessons', flashcards: 'Flashcard Studio', awards: 'Awards Vault', profile: 'My progress', settings: 'Settings', lesson: 'Lesson', quizSetup: 'Quiz setup', quiz: 'Quiz', result: 'Results', cancelled: 'Quiz cancelled' } as Record<Page, string>)[page];
  return <div className="app-layout">
    <aside className="sidebar">
      <button className="logo-button" onClick={() => navigate('home')} aria-label="English Studio home"><Logo /></button>
      <div className="sidebar-label">YOUR LEARNING SPACE</div>
      <nav className="side-nav" aria-label="Main navigation">
        {links.map(({ page: destination, title: label, icon: Icon }) => <button key={destination} className={`side-link ${selected === destination ? 'active' : ''}`} onClick={() => navigate(destination)}><Icon size={19} strokeWidth={1.9} /><span>{label}</span>{selected === destination && <ChevronRight size={15} className="side-chevron" />}</button>)}
      </nav>
      <div className="sidebar-label sidebar-label-more">YOUR SPACE</div>
      <button className={`side-link settings-link ${page === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Settings size={19} strokeWidth={1.9} /><span>Settings</span></button>
      <div className="sidebar-bottom">
        <div className="sidebar-motivation"><div className="mini-spark"><Sparkles size={19} /></div><strong>Keep showing up.</strong><p>Little steps make a big difference.</p><div className="sidebar-level"><span>LEVEL {stats.level}</span><span>{stats.levelXP}/200 XP</span></div><ProgressBar value={stats.levelXP / 2} /></div>
        <div className="developer-credit">Made for curious minds<br /><strong>Developed by Venush</strong></div>
      </div>
    </aside>
    <div className="main-wrap">
      <header className="topbar">
        <div className="mobile-logo"><button className="logo-button" onClick={() => navigate('home')}><Logo /></button></div>
        <div className="breadcrumbs"><span>My learning space</span><ChevronRight size={14} /><strong>{title}</strong></div>
        <div className="topbar-right"><span className="topbar-date">{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span><button className="top-icon" onClick={() => navigate('settings')} aria-label="Open settings"><Settings size={19} /></button><button className="avatar-button" onClick={() => navigate('profile')} aria-label="Open profile"><span className="avatar">{initials(profile.name)}</span><span className="avatar-name">{profile.name}<small>Level {stats.level} learner</small></span></button></div>
      </header>
      <main className="main-content" id="main-content">{children}</main>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{links.map(({ page: destination, mobile, icon: Icon }) => <button key={destination} onClick={() => navigate(destination)} className={selected === destination ? 'active' : ''}><Icon size={20} strokeWidth={selected === destination ? 2.4 : 1.8} /><span>{mobile}</span></button>)}</nav>
    <span className="sr-only"><CircleUserRound /></span>
  </div>;
}