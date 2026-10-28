import { AlertTriangle, CheckCircle2, Database, Download, FileJson, HardDrive, Info, RotateCcw, ShieldCheck, Sparkles, Trash2, Upload, UserRound, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { downloadBackup, validateBackup, type Backup } from '../lib/backup';
import { clearStore, resetProgress, restoreSnapshot } from '../lib/storage';
import type { Profile, Snapshot } from '../lib/model';
import { BACKUP_NOTICE, DATA_NOTICE, formatDate } from '../components/Shared';

type Props = { profile: Profile; snapshot: Snapshot; updateProfile: (profile: Profile) => void; refresh: () => Promise<void>; onRestored: (profile: Profile) => Promise<void> };

export function SettingsPage({ profile, snapshot, updateProfile, refresh, onRestored }: Props) {
  const [name, setName] = useState(profile.name);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ backup: Backup; droppedAwards: number } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [confirmClear, setConfirmClear] = useState<'history' | 'reset' | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const notify = (text: string) => { setError(''); setMessage(text); };
  const report = (text: string) => { setMessage(''); setError(text); };
  const exportData = () => {
    try {
      const exportedAt = downloadBackup(profile, snapshot);
      updateProfile({ ...profile, lastBackupAt: exportedAt });
      notify('Your JSON download was started. Keep the file somewhere safe.');
    } catch { report('The download could not be started. Please check your browser settings and try again.'); }
  };
  const readFile = async (file?: File) => {
    setPreview(null); setConfirmRestore(false); setMessage(''); setError('');
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { report('This file is too large. Choose a backup smaller than 5 MB.'); return; }
    try { setPreview(validateBackup(JSON.parse(await file.text()))); }
    catch (reason) { report(reason instanceof Error ? reason.message : 'Could not read that backup.'); }
    if (inputRef.current) inputRef.current.value = '';
  };
  const restore = async () => {
    if (!preview || !confirmRestore || busy) return;
    setBusy(true);
    try {
      const restoredProfile = { ...preview.backup.profile, lastBackupAt: null };
      await restoreSnapshot(preview.backup.data as Snapshot, restoredProfile);
      await onRestored(restoredProfile);
      setName(restoredProfile.name);
      setPreview(null); setConfirmRestore(false);
      notify(`Backup restored successfully.${preview.droppedAwards ? ` ${preview.droppedAwards} award(s) could not be verified and were not restored.` : ''}`);
    } catch (reason) { report(reason instanceof Error ? reason.message : 'Restore failed. Your existing progress was not changed.'); }
    finally { setBusy(false); }
  };
  const clear = async () => {
    if (!confirmClear || busy) return;
    setBusy(true);
    try {
      if (confirmClear === 'history') { await clearStore('history'); notify('Question history cleared. Your other progress is still here.'); }
      else { await resetProgress(); updateProfile({ ...profile, lastBackupAt: null }); notify('Learning progress was reset on this browser.'); }
      setConfirmClear(null); await refresh();
    } catch { report('Could not change local data. Please try again.'); }
    finally { setBusy(false); }
  };

  return <div className="standard-page settings-page page-enter"><div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> MAKE IT YOURS</div><h1>Your settings<span className="heading-period">.</span></h1><p>A little space for your preferences and your data.</p></div></div>
    {(message || error) && <div className={`settings-message ${error ? 'error' : ''}`} role="status">{error ? <AlertTriangle size={19} /> : <CheckCircle2 size={19} />}<span>{error || message}</span><button onClick={() => { setError(''); setMessage(''); }} aria-label="Dismiss message"><X size={16} /></button></div>}
    <div className="settings-grid"><div className="settings-main"><section className="content-panel settings-section"><div className="settings-title"><span className="settings-icon lavender"><UserRound size={20} /></span><div><h2>Your profile</h2><p>This name stays on this browser and device.</p></div></div><form onSubmit={(event) => { event.preventDefault(); const trimmed = name.trim(); if (!trimmed || trimmed.length > 40) { report('Enter a display name between 1 and 40 characters.'); return; } try { updateProfile({ ...profile, name: trimmed }); setName(trimmed); notify('Your display name was updated.'); } catch { report('Could not save your profile on this browser.'); } }}><label className="field-label" htmlFor="settings-name">DISPLAY NAME</label><div className="name-row"><input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} /><button className="button button-primary" type="submit">Save name</button></div></form></section>
      <section className="content-panel settings-section"><div className="settings-title"><span className="settings-icon peach"><Sparkles size={20} /></span><div><h2>Make it feel like you</h2><p>Choose how your studio looks and moves.</p></div></div><div className="setting-row"><div><strong>Appearance</strong><small>Choose a comfortable colour theme.</small></div><label><span className="sr-only">Appearance</span><select value={profile.theme} onChange={(event) => updateProfile({ ...profile, theme: event.target.value as Profile['theme'] })}><option value="light">Light</option><option value="dark">Dark</option></select></label></div><div className="setting-row"><div><strong>Animations</strong><small>Respect your device's reduced-motion setting, too.</small></div><button className={`toggle ${profile.animations ? 'on' : ''}`} role="switch" aria-label="Animations" aria-checked={profile.animations} onClick={() => updateProfile({ ...profile, animations: !profile.animations })}><span /></button></div></section>
      <section className="content-panel settings-section backup-section" id="backup"><div className="settings-title"><span className="settings-icon mint"><HardDrive size={20} /></span><div><h2>Backup &amp; Restore</h2><p>Your learning belongs to you. Keep a copy somewhere safe.</p></div></div><div className="backup-explainer"><ShieldCheck size={20} /><div><strong>Protect your progress</strong><p>{BACKUP_NOTICE}</p><p>Download your file after learning. To move or recover your progress, select that file here and confirm a restore.</p></div></div><div className="backup-buttons"><button className="button button-primary" onClick={exportData}><Download size={17} /> Download My Data (.json)</button><button className="button button-outline" onClick={() => inputRef.current?.click()}><Upload size={17} /> Import My Data (.json)</button><input ref={inputRef} type="file" accept="application/json,.json" className="sr-only" onChange={(event) => void readFile(event.target.files?.[0])} /></div><div className="backup-meta"><FileJson size={16} /> {profile.lastBackupAt ? `Last download initiated ${formatDate(profile.lastBackupAt)}.` : 'No backup download has been recorded yet.'}</div><p className="restore-explanation">Restore replaces all current local learning data and your local profile after confirmation. Merge is not supported. Backups are not tamper-proof; scores and award eligibility are checked against the included history.</p>
        {preview && <div className="import-preview"><div className="preview-header"><FileJson size={21} /><div><strong>Backup ready to review</strong><small>Exported {formatDate(preview.backup.exportedAt)} for {preview.backup.profile.name}</small></div></div><div className="preview-counts"><span>{preview.backup.data.attempts.filter((attempt) => attempt.status === 'completed').length} completed quizzes</span><span>{preview.backup.data.lessons.length} lessons</span><span>{preview.backup.data.cards.length} reviewed cards</span><span>{preview.backup.data.awards.length} eligible awards</span><span>{preview.backup.data.history.length} question fingerprints</span></div>{preview.droppedAwards > 0 && <p>{preview.droppedAwards} award(s) could not be verified and will not be restored.</p>}<p><strong>Replacing is permanent.</strong> Download your current data first if you want to keep it.</p>{!confirmRestore ? <button className="button button-primary" onClick={() => setConfirmRestore(true)}>Restore Backup</button> : <div className="confirmation-inline"><span>Replace all current local data with this backup?</span><button className="button danger-button" disabled={busy} onClick={() => void restore()}>Yes, replace my data</button><button className="button button-quiet" onClick={() => setConfirmRestore(false)}>Cancel</button></div>}<button className="text-link preview-cancel" onClick={() => { setPreview(null); setConfirmRestore(false); }}>Choose a different file</button></div>}
      </section>
      <section className="content-panel settings-section danger-section"><div className="settings-title"><span className="settings-icon coral"><Database size={20} /></span><div><h2>Manage local data</h2><p>These actions only affect this browser and device.</p></div></div><div className="setting-row"><div><strong>Clear question history</strong><small>Allows previously generated questions to appear again. Other progress stays.</small></div><button className="button button-outline" onClick={() => setConfirmClear('history')}><RotateCcw size={16} /> Clear history</button></div><div className="setting-row"><div><strong>Reset learning progress</strong><small>Delete attempts, XP, flashcards, lessons and awards.</small></div><button className="button button-outline danger-text" onClick={() => setConfirmClear('reset')}><Trash2 size={16} /> Reset progress</button></div>{confirmClear && <div className="danger-confirm"><AlertTriangle size={20} /><div><strong>{confirmClear === 'reset' ? 'Reset all learning progress?' : 'Clear question history?'}</strong><p>{confirmClear === 'reset' ? 'This cannot be undone without a backup. Download one first if you want to keep your progress.' : 'This cannot be undone. Your other learning data will not be removed.'}</p><div className="confirmation-inline">{confirmClear === 'reset' && <button className="button button-outline" onClick={exportData}><Download size={15} /> Download backup first</button>}<button className="button danger-button" disabled={busy} onClick={() => void clear()}>{confirmClear === 'reset' ? 'Yes, reset progress' : 'Yes, clear history'}</button><button className="button button-quiet" onClick={() => setConfirmClear(null)}>Cancel</button></div></div></div>}</section>
    </div><aside className="settings-aside"><section className="aside-panel"><div className="section-kicker">GOOD TO KNOW</div><h2>Your data, your device.</h2><div className="settings-notice"><Info size={19} /><p>{DATA_NOTICE}</p></div><p>English Studio is a local profile, not a secure account. It does not sync between devices.</p></section><section className="aside-panel about-panel"><div className="section-kicker">ABOUT THE STUDIO</div><h2>Made for curious minds.</h2><p>A little corner of the internet for building a bigger, brighter way with words.</p><strong>English Studio</strong><small>Developed by Venush</small></section></aside></div>
  </div>;
}