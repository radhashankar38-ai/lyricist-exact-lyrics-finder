
import React, { useRef, useState, useEffect, useMemo } from 'react';
import Fuse from 'fuse.js';
import { SONG_POOL } from './SongSuggestions';

interface SearchBarProps {
  query: string;
  setQuery: (query: string) => void;
  onSearch: (query: string, useChords?: boolean) => void;
  onImport?: (title: string, artist: string, lyrics: string) => void;
  isLoading: boolean;
  style?: 'floating' | 'docked' | 'minimal';
  history: string[];
}

export const SearchBar: React.FC<SearchBarProps> = ({ 
  query, setQuery, onSearch, onImport, isLoading, style = 'floating', history
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState({ title: '', artist: '', lyrics: '' });

  // Derive suggestions from query using useMemo to prevent race conditions with useEffect
  const suggestions = useMemo(() => {
      if (!query.trim()) return [];

      const options = { includeScore: true, threshold: 0.4 };
      
      // Search history (prioritized)
      const fuseHistory = new Fuse(history, options);
      const historyResults = fuseHistory.search(query).map(r => r.item);

      // Search song pool
      const fusePool = new Fuse(SONG_POOL, options);
      const poolResults = fusePool.search(query).map(r => r.item);

      // Combine: History first, then Pool, remove duplicates
      return Array.from(new Set([...historyResults, ...poolResults])).slice(0, 5);
  }, [query, history]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      setShowSuggestions(false);
      onSearch(query);
      (document.activeElement as HTMLElement)?.blur();
    }
  };

  const isDocked = style === 'docked';
  
  // Use specific search radius for input (pill default), standard radius for menu
  const inputRadius = 'var(--radius-search)'; 
  const menuRadius = 'var(--radius)';

  // Liquid Glass Styles - AI Mode Aesthetic with Aura Lighting
  const liquidGlassClass = `
    backdrop-blur-[40px] relative overflow-hidden 
    bg-white/80 dark:bg-black/60 
    border border-zinc-200/50 dark:border-white/10
    shadow-[0_4px_25px_rgba(0,0,0,0.03)] dark:shadow-[0_15px_60px_rgba(0,0,0,0.5)]
    transition-all duration-700 ease-liquid
    
    /* Hover: Subtle Hint */
    hover:border-primary/25
    hover:shadow-[0_10px_35px_rgba(var(--color-primary),0.06)]
    hover:scale-[1.002]

    /* Focus: Full Aura Activation */
    focus-within:border-primary/40 
    focus-within:bg-white/95 dark:focus-within:bg-zinc-950/95
    focus-within:scale-[1.005]
    focus-within:shadow-[0_0_12px_rgba(var(--color-primary),0.1),0_0_30px_rgba(var(--color-secondary),0.05),inset_0_0_8px_rgba(var(--color-primary),0.01)]
  `;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  return (
    <div ref={wrapperRef} className={`w-full ${isDocked ? 'max-w-none px-4 md:px-8' : 'max-w-3xl px-4 md:px-0'} mx-auto relative z-10`}>
      
      {/* Suggestions Dropup */}
      {showSuggestions && suggestions.length > 0 && (
        <div 
            className="absolute bottom-full left-0 right-0 mb-4 bg-white/90 dark:bg-black/90 backdrop-blur-xl border border-zinc-200/50 dark:border-white/10 shadow-2xl overflow-hidden animate-slide-up-fade origin-bottom z-40"
            style={{ borderRadius: menuRadius }}
        >
           {suggestions.map((suggestion, idx) => {
              const isHistory = history.includes(suggestion);
              return (
                  <button
                    key={idx}
                    onClick={() => {
                        setQuery(suggestion);
                        onSearch(suggestion);
                        setShowSuggestions(false);
                    }}
                    className="w-full text-left px-8 py-4 flex items-center gap-3 hover:bg-primary/10 transition-colors border-b border-zinc-100 dark:border-white/5 last:border-0 group"
                  >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isHistory ? 'bg-zinc-100 dark:bg-white/10 text-zinc-500' : 'bg-primary/10 text-primary'}`}>
                          {isHistory ? (
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          ) : (
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                          )}
                      </div>
                      <span className="font-bold text-zinc-700 dark:text-zinc-200 group-hover:text-primary transition-colors truncate">{suggestion}</span>
                  </button>
              );
           })}
        </div>
      )}

      <form onSubmit={handleSubmit} className={`relative group/input z-30`}>
        {/* Main Input Container - Large pill size with normal size typography */}
        <div 
            className={`
                relative flex items-center z-10
                ${liquidGlassClass}
            `}
            style={{ borderRadius: inputRadius }}
        >
          <input
            type="search"
            enterKeyHint="search"
            className="w-full bg-transparent text-zinc-700 dark:text-zinc-200 px-12 py-7 focus:outline-none placeholder-zinc-400 dark:placeholder-zinc-500 font-semibold text-lg transition-all duration-500 ease-liquid text-left appearance-none relative z-10 tracking-tight caret-primary focus:text-primary dark:focus:text-primary/90"
            placeholder="Ask any song..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              // Only open suggestions if there is text and it wasn't open
              if (e.target.value.trim()) setShowSuggestions(true);
            }}
            onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
            }}
            disabled={isLoading}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
            style={{ borderRadius: inputRadius }}
          />

          <div className="absolute right-6 flex items-center gap-2 z-20">
            <button 
              type="button"
              onClick={() => onSearch(query, true)}
              className="p-3 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all hover:scale-110"
              title="Search with Chords"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
            </button>
            <button 
              type="button"
              onClick={() => setShowImportModal(true)}
              className="p-3 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-white/20 transition-all hover:scale-110"
              title="Import Plain Text Lyrics"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </button>
          </div>
        </div>
      </form>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200 dark:border-white/10 overflow-hidden animate-zoom-in">
            <div className="p-6 border-b border-zinc-100 dark:border-white/5 flex justify-between items-center">
              <h2 className="text-xl font-black text-zinc-900 dark:text-white">Import Lyrics</h2>
              <button onClick={() => setShowImportModal(false)} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Song Title</label>
                  <input 
                    type="text" 
                    value={importData.title}
                    onChange={(e) => setImportData({...importData, title: e.target.value})}
                    placeholder="e.g. Bohemian Rhapsody"
                    className="w-full p-3 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Artist</label>
                  <input 
                    type="text" 
                    value={importData.artist}
                    onChange={(e) => setImportData({...importData, artist: e.target.value})}
                    placeholder="e.g. Queen"
                    className="w-full p-3 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm font-bold focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Lyrics (Plain Text)</label>
                <textarea 
                  value={importData.lyrics}
                  onChange={(e) => setImportData({...importData, lyrics: e.target.value})}
                  placeholder="Paste your lyrics here..."
                  rows={8}
                  className="w-full p-4 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-sm font-medium focus:ring-2 focus:ring-primary outline-none resize-none"
                />
              </div>
              <button 
                onClick={() => {
                  if (importData.title && importData.lyrics) {
                    onImport?.(importData.title, importData.artist, importData.lyrics);
                    setShowImportModal(false);
                    setImportData({ title: '', artist: '', lyrics: '' });
                  }
                }}
                disabled={!importData.title || !importData.lyrics}
                className="w-full py-4 rounded-2xl bg-primary text-white font-black text-sm shadow-xl shadow-primary/30 hover:scale-[1.02] transition-all disabled:opacity-50"
              >
                Import & Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
