
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
    AccentKey, CardStyle, BorderRadius, SearchBarStyle, 
    UiScale, AnimSpeed, FavSortOrder, FeedbackType, User,
    SyncState, SyncEvent
} from '../types';
import { SyncPanel } from './SyncPanel';

// --- Constants & Helpers ---

export const ACCENT_COLORS = {
  sky: { primary: '56 189 248', secondary: '129 140 248', label: 'Sky' },
  purple: { primary: '192 132 252', secondary: '232 121 249', label: 'Purple' },
  green: { primary: '74 222 128', secondary: '34 211 238', label: 'Green' },
  orange: { primary: '251 146 60', secondary: '248 113 113', label: 'Orange' },
  rose: { primary: '251 113 133', secondary: '244 114 182', label: 'Rose' },
  amber: { primary: '251 191 36', secondary: '245 158 11', label: 'Amber' },
  teal: { primary: '45 212 191', secondary: '20 184 166', label: 'Teal' },
  indigo: { primary: '99 102 241', secondary: '139 92 246', label: 'Indigo' },
  pink: { primary: '236 72 153', secondary: '219 39 119', label: 'Pink' },
  red: { primary: '239 68 68', secondary: '220 38 38', label: 'Red' },
};

const hueToRgbStr = (h: number) => {
    const s = 0.85; const l = 0.55;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    return `${Math.round((r + m) * 255)} ${Math.round((g + m) * 255)} ${Math.round((b + m) * 255)}`;
};

const rgbStrToHue = (rgb: string) => {
    try {
        const [r, g, b] = rgb.split(' ').map(n => Number(n) / 255);
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0;
        if (max !== min) {
            const d = max - min;
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return Math.round(h * 360);
    } catch (e) { return 0; }
};

// --- Icons ---
const Icons = {
    Close: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>,
    Palette: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>,
    Sliders: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>,
    Heart: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>,
    User: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
    Sun: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    Moon: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>,
    Layers: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>,
    Droplet: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2.252A8.014 8.014 0 0117.657 8c1.565 0 2.833 1.282 2.833 2.875 0 2.91-2.833 5.375-8.49 10.875C6.49 16.25 3.657 13.785 3.657 10.875c0-1.593 1.268-2.875 2.833-2.875A8.014 8.014 0 0112 2.252z" /></svg>,
    Cube: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>,
    Material: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>,
    Sparkles: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>,
    Sound: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>,
    Vibrate: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>,
    Scale: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>,
    Speed: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    Database: () => <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" /></svg>,
    Trash: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
    Logout: () => <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
}

// --- Sub-components ---

const Section = ({ title, icon, children, className = "" }: { title?: string, icon?: React.ReactNode, children?: React.ReactNode, className?: string }) => (
    <div className={`bg-white/40 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-white/5 rounded-3xl p-5 backdrop-blur-sm ${className}`}>
        {(title || icon) && (
            <div className="flex items-center gap-2 mb-4 ml-1">
                {icon && <div className="text-zinc-400 dark:text-zinc-500">{icon}</div>}
                {title && <h3 className="text-[10px] font-black uppercase tracking-[0.25em] text-zinc-400">{title}</h3>}
            </div>
        )}
        <div className="space-y-4">
            {children}
        </div>
    </div>
);

const SettingRow = ({ label, description, icon, control }: { label: string, description?: string, icon?: React.ReactNode, control: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 p-2 rounded-2xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
        <div className="flex items-center gap-3 min-w-0">
             {icon && <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{icon}</div>}
             <div className="flex flex-col">
                 <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">{label}</span>
                 {description && <span className="text-[10px] text-zinc-500 font-medium leading-tight mt-0.5">{description}</span>}
             </div>
        </div>
        <div className="flex-shrink-0">{control}</div>
    </div>
);

const Switch = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
    <button 
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full p-1 transition-all duration-300 ease-elastic ${checked ? 'bg-primary shadow-[0_2px_10px_rgba(var(--color-primary),0.3)]' : 'bg-zinc-200 dark:bg-zinc-800'}`}
    >
        <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
);

const ColorCirclePicker = ({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) => {
    const wheelRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const hue = rgbStrToHue(value);

    const handleInteraction = useCallback((clientX: number, clientY: number) => {
        if (!wheelRef.current) return;
        const rect = wheelRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        let angle = Math.atan2(clientY - centerY, clientX - centerX) * (180 / Math.PI);
        angle = (angle + 90 + 360) % 360; 
        
        onChange(hueToRgbStr(angle));
    }, [onChange]);

    useEffect(() => {
        const move = (e: MouseEvent | TouchEvent) => {
            if (!isDragging) return;
            e.preventDefault();
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
            handleInteraction(clientX, clientY);
        };
        const up = () => setIsDragging(false);
        if (isDragging) {
            window.addEventListener('mousemove', move, { passive: false });
            window.addEventListener('mouseup', up);
            window.addEventListener('touchmove', move, { passive: false });
            window.addEventListener('touchend', up);
        }
        return () => {
            window.removeEventListener('mousemove', move);
            window.removeEventListener('mouseup', up);
            window.removeEventListener('touchmove', move);
            window.removeEventListener('touchend', up);
        };
    }, [isDragging, handleInteraction]);

    return (
        <div className="flex flex-col items-center gap-4 py-4 bg-zinc-50 dark:bg-black/20 rounded-2xl border border-zinc-200 dark:border-white/5">
            <div className="flex justify-between w-full items-center px-4">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{label}</span>
                <div className="w-6 h-6 rounded-full border border-white/20 shadow-lg transition-colors duration-200" style={{ backgroundColor: `rgb(${value})` }} />
            </div>
            
            {/* Circle Container */}
            <div className="p-2 relative">
                <div 
                    ref={wheelRef}
                    onMouseDown={(e) => { setIsDragging(true); handleInteraction(e.clientX, e.clientY); }}
                    onTouchStart={(e) => { setIsDragging(true); handleInteraction(e.touches[0].clientX, e.touches[0].clientY); }}
                    className="relative w-32 h-32 rounded-full cursor-crosshair shadow-inner group touch-none"
                    style={{ 
                        background: 'conic-gradient(from 0deg at 50% 50%, #ff0000 0deg, #ffff00 60deg, #00ff00 120deg, #00ffff 180deg, #0000ff 240deg, #ff00ff 300deg, #ff0000 360deg)' 
                    }}
                >
                    {/* Shadow/Depth overlay */}
                    <div className="absolute inset-0 rounded-full shadow-[inset_0_2px_8px_rgba(0,0,0,0.2)] pointer-events-none" />
                    
                    {/* Center Cap (Dial Look) */}
                    <div className="absolute inset-8 bg-white dark:bg-zinc-900 rounded-full shadow-md flex items-center justify-center pointer-events-none">
                         <div className="w-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                    </div>

                    {/* Rotator for the handle */}
                    <div 
                        className="absolute inset-0 pointer-events-none"
                        style={{ transform: `rotate(${hue}deg)` }}
                    >
                         {/* Handle positioned at Top Center (North) */}
                        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-2 border-zinc-200 rounded-full shadow-xl flex items-center justify-center">
                            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: `rgb(${value})` }} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Main Props ---

interface SettingsTrayProps {
  isOpen: boolean;
  onClose: () => void;
  config: {
    theme: 'dark' | 'light'; setTheme: (v: 'dark' | 'light') => void;
    accent: AccentKey; setAccent: (v: AccentKey) => void;
    customPrimary: string; setCustomPrimary: (v: string) => void;
    customSecondary: string; setCustomSecondary: (v: string) => void;
    cardStyle: CardStyle; setCardStyle: (v: CardStyle) => void;
    borderRadius: BorderRadius; setBorderRadius: (v: BorderRadius) => void;
    searchBarStyle: SearchBarStyle; setSearchBarStyle: (v: SearchBarStyle) => void;
    uiScale: UiScale; setUiScale: (v: UiScale) => void;
    animSpeed: AnimSpeed; setAnimSpeed: (v: AnimSpeed) => void;
    soundEnabled: boolean; setSoundEnabled: (v: boolean) => void;
    hapticEnabled: boolean; setHapticEnabled: (v: boolean) => void;
    favorites: string[]; 
    favSortOrder: FavSortOrder; setFavSortOrder: (v: FavSortOrder) => void;
    currentUser: User | null; logout: () => void; openLogin: () => void;
    syncState: SyncState;
    onSyncStateChange: (state: Partial<SyncState>) => void;
    choirs: { name: string; code: string }[];
    onSaveChoir: (name: string, code: string) => void;
  };
  actions: {
    toggleFavorite: (song: string) => void;
    onSearch: (query: string) => void;
    triggerFeedback: (type: FeedbackType) => void;
    onSyncEvent: (event: SyncEvent) => void;
  };
  syncStats?: {
      size: string;
      unit: string;
      status: string;
  }
}

export const SettingsTray: React.FC<SettingsTrayProps> = ({ isOpen, onClose, config, actions, syncStats = { size: '0.0', unit: 'KB', status: 'Offline' } }) => {
  const [activeTab, setActiveTab] = useState<'visuals' | 'system' | 'account' | 'library' | 'chorus'>('visuals');
  
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const tabs = [
    { id: 'visuals', label: 'Look', icon: <Icons.Palette /> },
    { id: 'system', label: 'Feel', icon: <Icons.Sliders /> },
    { id: 'chorus', label: 'Chorus', icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
    { id: 'library', label: 'Vault', icon: <Icons.Heart /> },
    { id: 'account', label: 'ID', icon: <Icons.User /> },
  ] as const;

  return (
    <>
      <div 
        className={`fixed inset-0 z-[150] bg-zinc-950/20 backdrop-blur-sm transition-opacity duration-500 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={onClose}
      />
      
      <div className={`
        fixed top-0 right-0 z-[151] h-full w-full sm:max-w-[420px]
        bg-zinc-50/95 dark:bg-zinc-950/95 backdrop-blur-2xl
        shadow-2xl border-l border-white/20
        transform transition-transform duration-500 cubic-bezier(0.23, 1, 0.32, 1)
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        flex flex-col settings-tray font-space
      `}>
          
          {/* Header */}
          <div className="px-6 pt-12 pb-4 flex items-center justify-between bg-gradient-to-b from-white/50 to-transparent dark:from-black/20">
              <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
                  <span className="bg-zinc-100 dark:bg-white/10 p-2 rounded-xl text-zinc-900 dark:text-white"><Icons.Sliders /></span>
                  Settings
              </h2>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-zinc-200/50 dark:bg-white/10 flex items-center justify-center hover:bg-zinc-300 dark:hover:bg-white/20 transition-colors"
              >
                  <Icons.Close />
              </button>
          </div>

          {/* Tabs */}
          <div className="px-6 pb-6">
              <div className="flex p-1 bg-zinc-200/50 dark:bg-white/5 rounded-2xl">
                  {tabs.map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id as any); actions.triggerFeedback('tap'); }}
                        className={`flex-1 py-3 rounded-xl flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === tab.id ? 'bg-white dark:bg-zinc-800 shadow-md text-primary' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                      >
                          <div className="scale-75">{tab.icon}</div>
                          <span className="text-[10px] font-black uppercase tracking-widest">{tab.label}</span>
                      </button>
                  ))}
              </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-32 space-y-6 custom-scrollbar">
              
              {activeTab === 'visuals' && (
                  <div className="space-y-6 animate-fade-in">
                      {/* Theme Cards */}
                      <div className="grid grid-cols-2 gap-4">
                          <button
                             onClick={() => { config.setTheme('light'); localStorage.setItem('lyricist_theme', 'light'); actions.triggerFeedback('tap'); }}
                             className={`relative p-4 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center gap-2 ${config.theme === 'light' ? 'border-primary bg-white shadow-lg' : 'border-transparent bg-zinc-100 dark:bg-white/5 opacity-60'}`}
                          >
                             <div className="p-3 bg-orange-100 text-orange-500 rounded-full mb-1"><Icons.Sun /></div>
                             <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">Day</span>
                          </button>
                          <button
                             onClick={() => { config.setTheme('dark'); localStorage.setItem('lyricist_theme', 'dark'); actions.triggerFeedback('tap'); }}
                             className={`relative p-4 rounded-3xl border-2 transition-all duration-300 flex flex-col items-center gap-2 ${config.theme === 'dark' ? 'border-primary bg-zinc-800 shadow-lg' : 'border-transparent bg-zinc-100 dark:bg-white/5 opacity-60'}`}
                          >
                             <div className="p-3 bg-indigo-900/50 text-indigo-400 rounded-full mb-1"><Icons.Moon /></div>
                             <span className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-200">Night</span>
                          </button>
                      </div>

                      <Section title="Palette" icon={<Icons.Palette />}>
                          <div className="grid grid-cols-6 gap-3">
                              {Object.entries(ACCENT_COLORS).map(([key, value]) => (
                                  <button
                                      key={key}
                                      onClick={() => { config.setAccent(key as AccentKey); localStorage.setItem('lyricist_accent', key); actions.triggerFeedback('tap'); }}
                                      className={`aspect-square rounded-full transition-all duration-300 relative flex items-center justify-center ${config.accent === key ? 'scale-110 ring-2 ring-offset-2 ring-primary dark:ring-offset-black' : 'hover:scale-105 opacity-80'}`}
                                      style={{ backgroundColor: `rgb(${value.primary})` }}
                                  >
                                      {config.accent === key && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                                  </button>
                              ))}
                              <button
                                  onClick={() => { config.setAccent('custom'); localStorage.setItem('lyricist_accent', 'custom'); actions.triggerFeedback('tap'); }}
                                  className={`aspect-square rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 transition-all relative ${config.accent === 'custom' ? 'scale-110 ring-2 ring-offset-2 ring-white dark:ring-offset-black' : 'opacity-80'}`}
                              >
                                  {config.accent === 'custom' && <div className="absolute inset-0 flex items-center justify-center text-white"><div className="w-1.5 h-1.5 bg-white rounded-full"></div></div>}
                              </button>
                          </div>
                          {config.accent === 'custom' && (
                              <div className="pt-2 animate-zoom-in space-y-4">
                                  <ColorCirclePicker 
                                      label="Primary Tone" 
                                      value={config.customPrimary} 
                                      onChange={(v) => { config.setCustomPrimary(v); localStorage.setItem('lyricist_custom_primary', v); }} 
                                  />
                                  <ColorCirclePicker 
                                      label="Secondary Tone" 
                                      value={config.customSecondary} 
                                      onChange={(v) => { config.setCustomSecondary(v); localStorage.setItem('lyricist_custom_secondary', v); }} 
                                  />
                              </div>
                          )}
                      </Section>

                      <Section title="Material" icon={<Icons.Layers />}>
                          {/* Card Style Selectors - Removed Material 3 */}
                          <div className="grid grid-cols-3 gap-3 mb-4">
                              {[
                                  { id: 'glass', label: 'Glass', icon: <Icons.Layers /> },
                                  { id: 'solid', label: 'Solid', icon: <Icons.Cube /> },
                                  { id: 'liquid-glass', label: 'Liquid', icon: <Icons.Droplet /> },
                              ].map((opt) => (
                                  <button
                                    key={opt.id}
                                    onClick={() => { config.setCardStyle(opt.id as any); localStorage.setItem('lyricist_card', opt.id); actions.triggerFeedback('tap'); }}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all ${config.cardStyle === opt.id ? 'bg-primary/10 border-primary text-primary' : 'bg-zinc-50 dark:bg-white/5 border-transparent text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/10'}`}
                                  >
                                      {opt.icon}
                                      <span className="text-[10px] font-bold uppercase">{opt.label}</span>
                                  </button>
                              ))}
                          </div>

                          {/* Radius Selectors */}
                          <div className="space-y-2">
                               <span className="text-xs font-bold text-zinc-500 uppercase tracking-wide ml-1">Corner Shape</span>
                               <div className="flex gap-3 bg-zinc-50 dark:bg-black/20 p-2 rounded-2xl border border-zinc-200 dark:border-white/5">
                                   {[
                                       { id: 'round', label: 'Round', radius: '12px' },
                                       { id: 'soft', label: 'Soft', radius: '6px' },
                                       { id: 'sharp', label: 'Sharp', radius: '0px' },
                                   ].map((opt) => (
                                       <button
                                            key={opt.id}
                                            onClick={() => { config.setBorderRadius(opt.id as any); localStorage.setItem('lyricist_radius', opt.id); actions.triggerFeedback('tap'); }}
                                            className={`flex-1 h-10 flex items-center justify-center gap-2 rounded-xl transition-all ${config.borderRadius === opt.id ? 'bg-white dark:bg-zinc-700 shadow-md text-primary' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'}`}
                                       >
                                           <div className="w-4 h-4 border-2 border-current" style={{ borderRadius: opt.radius }}></div>
                                       </button>
                                   ))}
                               </div>
                          </div>
                      </Section>
                  </div>
              )}

              {activeTab === 'system' && (
                  <div className="space-y-6 animate-fade-in">
                      <Section title="Feedback" icon={<Icons.Sound />}>
                          <SettingRow 
                              label="Sound Effects" 
                              description="Play sounds on interaction"
                              icon={<Icons.Sound />}
                              control={<Switch checked={config.soundEnabled} onChange={(v) => { config.setSoundEnabled(v); localStorage.setItem('lyricist_sound', String(v)); actions.triggerFeedback('toggle'); }} />}
                          />
                          <div className="h-px bg-zinc-100 dark:bg-white/5 my-2" />
                          <SettingRow 
                              label="Haptic Feedback" 
                              description="Vibrate on touch"
                              icon={<Icons.Vibrate />}
                              control={<Switch checked={config.hapticEnabled} onChange={(v) => { config.setHapticEnabled(v); localStorage.setItem('lyricist_haptic', String(v)); actions.triggerFeedback('toggle'); }} />}
                          />
                      </Section>

                      <Section title="Motion" icon={<Icons.Speed />}>
                           <div className="space-y-6">
                               {/* UI Scale */}
                               <div className="space-y-3">
                                   <div className="flex justify-between items-center px-1">
                                       <div className="flex items-center gap-2 text-sm font-bold text-zinc-800 dark:text-zinc-100">
                                            <Icons.Scale /> UI Scale
                                       </div>
                                       <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md">{config.uiScale}%</span>
                                   </div>
                                   <div className="flex items-center gap-3">
                                       <span className="text-xs font-bold text-zinc-400">A</span>
                                       <input 
                                            type="range" min="90" max="110" step="5"
                                            value={config.uiScale}
                                            onChange={(e) => { 
                                                const val = parseInt(e.target.value) as UiScale;
                                                config.setUiScale(val);
                                                localStorage.setItem('lyricist_scale', String(val));
                                            }}
                                            className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full appearance-none accent-primary cursor-pointer"
                                       />
                                       <span className="text-lg font-bold text-zinc-400">A</span>
                                   </div>
                               </div>

                               {/* Anim Speed */}
                               <div className="space-y-3">
                                   <div className="flex items-center gap-2 px-1 text-sm font-bold text-zinc-800 dark:text-zinc-100">
                                       <Icons.Speed /> Animation Speed
                                   </div>
                                   <div className="flex p-1 bg-zinc-100 dark:bg-black/20 rounded-xl border border-zinc-200/50 dark:border-white/5 w-full">
                                       {[
                                           { label: 'Slow', value: 'slow' },
                                           { label: 'Normal', value: 'normal' },
                                           { label: 'Fast', value: 'fast' },
                                       ].map((opt) => (
                                           <button
                                                key={opt.value}
                                                onClick={() => { config.setAnimSpeed(opt.value as any); localStorage.setItem('lyricist_anim_speed', opt.value); actions.triggerFeedback('tap'); }}
                                                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all duration-300 ${config.animSpeed === opt.value ? 'bg-white dark:bg-zinc-800 text-primary shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                                           >
                                               {opt.label}
                                           </button>
                                       ))}
                                   </div>
                               </div>
                           </div>
                      </Section>
                  </div>
              )}

              {activeTab === 'chorus' && (
                  <div className="space-y-6 animate-fade-in">
                      <SyncPanel 
                        syncState={config.syncState}
                        onSyncStateChange={config.onSyncStateChange}
                        triggerFeedback={actions.triggerFeedback}
                        choirs={config.choirs}
                        onSaveChoir={config.onSaveChoir}
                      />
                  </div>
              )}

              {activeTab === 'library' && (
                  <div className="space-y-6 animate-fade-in">
                       <div className="grid grid-cols-2 gap-4">
                           <div className="p-4 rounded-3xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-center">
                               <Icons.Heart />
                               <span className="text-3xl font-black text-primary my-1">{config.favorites.length}</span>
                               <span className="text-[10px] uppercase font-bold text-zinc-500">Saved</span>
                           </div>
                           <div className="p-4 rounded-3xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex flex-col items-center justify-center text-center relative overflow-hidden">
                               <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                               <Icons.Database />
                               <span className="text-3xl font-black text-zinc-900 dark:text-white my-1">{syncStats.size}</span>
                               <span className="text-[10px] uppercase font-bold text-zinc-500">{syncStats.unit} Cloud</span>
                           </div>
                       </div>

                       <Section title="Collection" icon={<Icons.Heart />}>
                           {config.favorites.length > 0 ? (
                               <div className="divide-y divide-zinc-100 dark:divide-white/5">
                                   {config.favorites.map((song, i) => (
                                       <div key={i} className="flex items-center justify-between py-3 group">
                                           <button 
                                               onClick={() => actions.onSearch(song)}
                                               className="text-left min-w-0 flex-1 flex items-center gap-3"
                                           >
                                               <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-zinc-400 font-bold text-xs">
                                                   {i + 1}
                                               </div>
                                               <div className="min-w-0">
                                                    <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate group-hover:text-primary transition-colors">{song.split(' - ')[0]}</p>
                                                    <p className="text-[10px] text-zinc-500 truncate">{song.split(' - ')[1] || 'Artist'}</p>
                                               </div>
                                           </button>
                                           <button 
                                               onClick={() => actions.toggleFavorite(song)}
                                               className="p-2 text-zinc-300 hover:text-red-500 transition-colors"
                                           >
                                               <Icons.Trash />
                                           </button>
                                       </div>
                                   ))}
                               </div>
                           ) : (
                               <div className="flex flex-col items-center py-8 opacity-50">
                                   <Icons.Heart />
                                   <p className="text-xs text-zinc-400 mt-2 italic">Your library is empty.</p>
                               </div>
                           )}
                       </Section>
                  </div>
              )}

              {activeTab === 'account' && (
                  <div className="space-y-6 animate-fade-in">
                      {config.currentUser ? (
                          <Section title="Profile" icon={<Icons.User />}>
                              <div className="flex flex-col items-center text-center pb-6">
                                  <div 
                                    className="w-24 h-24 rounded-full mb-4 shadow-xl border-4 border-white dark:border-zinc-800 flex items-center justify-center text-3xl font-black text-white relative"
                                    style={{ backgroundColor: config.currentUser.avatarColor }}
                                  >
                                      {config.currentUser.username[0].toUpperCase()}
                                      <div className="absolute bottom-0 right-0 w-6 h-6 bg-green-500 border-2 border-white dark:border-zinc-900 rounded-full"></div>
                                  </div>
                                  <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{config.currentUser.username}</h3>
                                  <p className="text-sm font-medium text-zinc-500 mb-4">{config.currentUser.email || 'Guest Session'}</p>
                                  
                                  <div className="flex gap-2 mb-6">
                                      <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-white/5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border border-zinc-200 dark:border-white/5">
                                          {config.currentUser.provider === 'supabase' ? 'Cloud Sync' : 'Local Only'}
                                      </span>
                                      <span className="px-3 py-1 rounded-full bg-zinc-100 dark:bg-white/5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border border-zinc-200 dark:border-white/5">
                                          Member since {config.currentUser.joinedDate?.split('/')[2] || '2024'}
                                      </span>
                                  </div>

                                  <button 
                                    onClick={() => { config.logout(); actions.triggerFeedback('toggle'); }}
                                    className="w-full py-4 rounded-xl bg-red-50 text-red-500 dark:bg-red-900/10 dark:text-red-400 text-xs font-black uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors flex items-center justify-center gap-2"
                                  >
                                      <Icons.Logout />
                                      Sign Out
                                  </button>
                              </div>
                          </Section>
                      ) : (
                          <div className="p-8 rounded-3xl bg-zinc-900 dark:bg-white text-center flex flex-col items-center">
                              <div className="w-16 h-16 bg-white/10 dark:bg-black/10 rounded-full flex items-center justify-center text-white dark:text-black mb-4">
                                  <Icons.User />
                              </div>
                              <h3 className="text-2xl font-black text-white dark:text-zinc-900 mb-2">Sync Library</h3>
                              <p className="text-xs font-medium text-zinc-400 dark:text-zinc-500 mb-8 leading-relaxed px-4">
                                  Create an account to securely sync your favorites and history across devices.
                              </p>
                              <button 
                                onClick={() => { config.openLogin(); actions.triggerFeedback('tap'); }}
                                className="w-full py-4 rounded-xl bg-white text-zinc-900 dark:bg-zinc-900 dark:text-white text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                              >
                                  Login / Register
                              </button>
                          </div>
                      )}
                  </div>
              )}

          </div>
      </div>
    </>
  );
};
