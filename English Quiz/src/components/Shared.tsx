import { BookOpen, Check, Gem, Layers3, Sparkles, Star, Target, Trophy, Zap, Compass, Flame, Crown, type LucideIcon } from 'lucide-react';

export const DATA_NOTICE = 'Your progress is saved on this browser and device. It does not automatically sync across devices. Clearing browser data may erase your progress. Download your JSON backup regularly so you can restore your learning data if needed.';
export const BACKUP_NOTICE = 'Protect your progress! Download your English Studio JSON backup regularly. Your learning data is stored only in this browser and may be lost if browser data is cleared or your device is changed.';

export function Logo({ light = false }: { light?: boolean }) {
  return <div className={`brand ${light ? 'brand-light' : ''}`}><span className="brand-mark"><BookOpen size={21} strokeWidth={2.3} /><span className="brand-spark">+</span></span><span className="brand-words">English <b>Studio</b><small>LEARN. GROW. SHINE.</small></span></div>;
}

export function ProgressBar({ value, className = '' }: { value: number; className?: string }) {
  return <div className={`progress-track ${className}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, Math.max(0, value)))}><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>;
}

const icons: Record<string, LucideIcon> = { book: BookOpen, compass: Compass, target: Target, star: Star, sparkles: Sparkles, layers: Layers3, zap: Zap, flame: Flame, crown: Crown, gem: Gem, trophy: Trophy, check: Check };
export function AwardIcon({ icon, size = 23 }: { icon: string; size?: number }) {
  const Icon = icons[icon] ?? Star;
  return <Icon size={size} strokeWidth={1.8} />;
}

export function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'S';
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}