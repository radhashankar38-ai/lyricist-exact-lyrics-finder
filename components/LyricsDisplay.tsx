
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { LyricsResult, CardStyle, SyncState, SyncEvent } from '../types';
import { translateLyrics, transliterateToTanglish } from '../services/geminiService';

interface LyricsDisplayProps {
  data: LyricsResult;
  searchQuery?: string;
  onSearch: (query: string) => void;
  isKaraokeMode: boolean;
  setIsKaraokeMode: (isKaraoke: boolean) => void;
  entranceAnim?: 'cinematic' | 'simple';
  favorites: string[];
  onToggleFavorite: (song: string) => void;
  triggerFeedback?: (type: 'tap' | 'success' | 'error' | 'toggle' | 'gamewin' | 'light') => void;
  cardStyle?: CardStyle;
  syncState?: SyncState;
  onSyncEvent?: (event: SyncEvent) => void;
}

type SectionType = 'chorus' | 'verse' | 'bridge' | 'pre-chorus' | 'outro' | 'intro' | 'instrumental' | 'other';

interface ParsedLine {
  text: string;
  chords: { chord: string; index: number }[];
}

interface ParsedStanza {
  id: string;
  lines: ParsedLine[];
  headerText: string | null;
  isTitle: boolean;
  type: SectionType;
}

type ThemeType = 'modern' | 'classic' | 'minimalist';

const themeStyles: Record<ThemeType, any> = {
    modern: { font: "font-sans", container: "space-y-12", header: "text-xs font-bold uppercase tracking-widest opacity-60 mb-2" },
    classic: { font: "font-serif", container: "space-y-16 text-center", header: "italic opacity-50 mb-4" },
    minimalist: { font: "font-mono", container: "space-y-10", header: "border-b border-current inline-block mb-2 text-xs" }
};

const LANG_OPTIONS = ['Spanish', 'French', 'Hindi', 'Tamil', 'Telugu', 'Tanglish (Tamil Script)'];

const Icons = {
    Copy: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>,
    Check: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>,
    Translate: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m0 4.5a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5A.75.75 0 019 7.5zM12 11c0-1.657-1.343-3-3-3s-3 1.343-3 3 1.343 3 3 3c1.07 0 2.01-.568 2.548-1.402" /><path d="M12 11c0 3.314-2.686 6-6 6S0 14.314 0 11S2.686 5 6 5s6 2.686 6 6z M21 11h-2m-2 6a6 6 0 01-12 0" /></svg>,
    Style: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18M3 8h18M3 12h18M3 16h18M3 20h18" /></svg>,
    Close: () => <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>,
    Music: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>,
    Focus: () => <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
}

export const LyricsDisplay: React.FC<LyricsDisplayProps> = ({ 
  data, searchQuery, onSearch, isKaraokeMode, setIsKaraokeMode, favorites, onToggleFavorite, triggerFeedback, cardStyle = 'glass',
  syncState, onSyncEvent
}) => {
  const [matchedLineId, setMatchedLineId] = useState<string | null>(null);
  const [currentImageSrc, setCurrentImageSrc] = useState<string | undefined>(data.metadata?.image);
  const [theme, setTheme] = useState<ThemeType>('modern');
  const [showChords, setShowChords] = useState(false);

  // Reset state when song changes
  useEffect(() => {
    setMatchedLineId(null);
    setCurrentImageSrc(data.metadata?.image);
    setTranslatedText(null);
    setIsShowingTranslation(false);
  }, [data]);

  // Snippet to highlight
  const highlightSnippet = useMemo(() => {
    const snippet = data.metadata?.matchedSnippet || searchQuery;
    if (!snippet) return null;
    // Don't highlight if it's just the song title or artist (too common)
    if (snippet.toLowerCase() === data.metadata?.title?.toLowerCase()) return null;
    return snippet.trim();
  }, [data.metadata?.matchedSnippet, searchQuery, data.metadata?.title]);

  // Controls State
  const [isCopied, setIsCopied] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [isShowingTranslation, setIsShowingTranslation] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState('Spanish');
  const langMenuRef = useRef<HTMLDivElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  
  const isCollection = data.metadata?.isCollection;
  const songKey = `${data.metadata?.title || ''} - ${data.metadata?.artist || ''}`;
  const isFavorite = favorites.includes(songKey);

  // Use derived text for parsing
  const textToDisplay = isShowingTranslation && translatedText ? translatedText : data.text;

  // Parsing Logic
  const parsedLyrics = useMemo(() => {
    const textToParse = textToDisplay;
    if (!textToParse) return [];
    const lines = textToParse.split('\n');
    const stanzas: ParsedStanza[] = [];
    let currentLines: ParsedLine[] = [];
    let currentHeader: string | null = null;
    let currentType: SectionType = 'verse';

    const flushStanza = () => {
      if (currentLines.length > 0) {
        stanzas.push({
          id: `stanza-${stanzas.length}`,
          lines: currentLines,
          headerText: currentHeader,
          isTitle: false,
          type: currentType
        });
        currentLines = [];
      }
    };

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        flushStanza();
        return;
      }
      const headerMatch = trimmed.match(/^\[(Verse|Chorus|Bridge|Pre-Chorus|Outro|Intro|Hook|Instrumental|Solo)(.*?)\]/i);
      if (headerMatch) {
        flushStanza();
        currentHeader = trimmed.replace('[', '').replace(']', '');
        const typeStr = headerMatch[1].toLowerCase();
        if (typeStr.includes('chorus')) currentType = 'chorus';
        else if (typeStr.includes('bridge')) currentType = 'bridge';
        else if (typeStr.includes('pre-chorus')) currentType = 'pre-chorus';
        else if (typeStr.includes('outro')) currentType = 'outro';
        else if (typeStr.includes('intro')) currentType = 'intro';
        else if (typeStr.includes('verse')) currentType = 'verse';
        else currentType = 'other';
      } else {
        // Parse chords from line
        const chords: { chord: string; index: number }[] = [];
        let cleanLine = trimmed;
        let offset = 0;
        
        // Match [Chord] pattern
        const chordRegex = /\[([A-G][b#]?(m|maj|min|aug|dim|sus|add)?\d?(\/[A-G][b#]?)?)\]/g;
        let match;
        while ((match = chordRegex.exec(trimmed)) !== null) {
          chords.push({ chord: match[1], index: match.index - offset });
          cleanLine = cleanLine.replace(match[0], '');
          offset += match[0].length;
        }

        currentLines.push({ text: cleanLine || trimmed, chords });
      }
    });
    flushStanza();
    return stanzas;
  }, [textToDisplay]);

  const totalLines = useMemo(() => {
    return parsedLyrics.reduce((acc, stanza) => acc + stanza.lines.length, 0);
  }, [parsedLyrics]);

  const autoFontSize = useMemo(() => {
    if (totalLines === 0) return 'text-xl';
    if (totalLines < 15) return 'text-4xl md:text-6xl';
    if (totalLines < 30) return 'text-3xl md:text-5xl';
    if (totalLines < 50) return 'text-2xl md:text-4xl';
    return 'text-xl md:text-2xl';
  }, [totalLines]);

  // Sync Listeners
  useEffect(() => {
    const handleRemoteSync = (e: any) => {
      const { type, payload } = e.detail;
      if (type === 'scroll') {
        const lineId = `line-${payload.stanzaIdx}-${payload.lineIdx}`;
        const el = document.getElementById(lineId);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setMatchedLineId(lineId);
      } else if (type === 'focus_toggle') {
        // Handled by syncState prop
      } else if (type === 'chord_toggle') {
        setShowChords(payload.enabled);
      }
    };
    window.addEventListener('remote-sync-event', handleRemoteSync);
    return () => window.removeEventListener('remote-sync-event', handleRemoteSync);
  }, []);

  // Use derived text for parsing
  // Parsing Logic (Moved up)

  // Snippet matching effect
  useEffect(() => {
    if (!highlightSnippet) return;
    const cleanSnippet = highlightSnippet.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (!cleanSnippet || cleanSnippet.length < 3) return; // Avoid highlighting very short fragments

    for (let sIdx = 0; sIdx < parsedLyrics.length; sIdx++) {
      const stanza = parsedLyrics[sIdx];
      for (let lIdx = 0; lIdx < stanza.lines.length; lIdx++) {
        const cleanLine = stanza.lines[lIdx].text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
        if (cleanLine.includes(cleanSnippet)) {
          setMatchedLineId(`line-${sIdx}-${lIdx}`);
          return;
        }
      }
    }
  }, [parsedLyrics, highlightSnippet]);

  // Scroll to matched snippet effect
  useEffect(() => {
    if (matchedLineId && !isKaraokeMode) {
      setTimeout(() => {
        const el = document.getElementById(matchedLineId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          triggerFeedback?.('success');
        }
      }, 300); // Faster trigger
    }
  }, [matchedLineId, isKaraokeMode, triggerFeedback]);

  // Click outside language menu handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Control handlers
  const handleCopy = () => {
    navigator.clipboard.writeText(data.text);
    setIsCopied(true);
    triggerFeedback?.('success');
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleTranslate = async (lang: string) => {
    setShowLangMenu(false);
    setIsTranslating(true);
    triggerFeedback?.('tap');
    try {
      let resultText: string;
      if (lang === 'Tanglish (Tamil Script)') {
        resultText = await transliterateToTanglish(data.text);
      } else {
        resultText = await translateLyrics(data.text, lang);
      }
      setTranslatedText(resultText);
      setTargetLanguage(lang);
      setIsShowingTranslation(true);
    } catch (e) {
      triggerFeedback?.('error');
    } finally {
      setIsTranslating(false);
    }
  };
  
  const handleToggleTheme = () => {
    const themes: ThemeType[] = ['modern', 'classic', 'minimalist'];
    const currentIndex = themes.indexOf(theme);
    setTheme(themes[(currentIndex + 1) % themes.length]);
    triggerFeedback?.('tap');
  };

  const handleLineClick = (stanzaIdx: number, lineIdx: number) => {
    const lineId = `line-${stanzaIdx}-${lineIdx}`;
    setMatchedLineId(lineId);
    triggerFeedback?.('tap');

    if (syncState?.status === 'host') {
      onSyncEvent?.({
        type: 'scroll',
        payload: { stanzaIdx, lineIdx }
      });
    }
  };

  const handleToggleFocus = () => {
    if (syncState?.status === 'host') {
      onSyncEvent?.({
        type: 'focus_toggle',
        payload: { enabled: !syncState.isFocusMode }
      });
    }
  };

  const handleToggleChords = () => {
    const newState = !showChords;
    setShowChords(newState);
    triggerFeedback?.('toggle');
    if (syncState?.status === 'host') {
      onSyncEvent?.({
        type: 'chord_toggle',
        payload: { enabled: newState }
      });
    }
  };

  const LyricsControls = () => (
    <div className={`w-full mb-8 p-2 bg-zinc-100/80 dark:bg-white/5 border border-zinc-200/50 dark:border-white/10 rounded-2xl flex items-center justify-center gap-1 backdrop-blur-sm shadow-inner overflow-x-auto`}>
        {/* Copy Button */}
        <button
            onClick={handleCopy}
            className="flex-1 min-w-fit flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors text-zinc-600 dark:text-zinc-300 hover:bg-primary/10 hover:text-primary"
            aria-label={isCopied ? "Lyrics copied to clipboard" : "Copy lyrics"}
        >
            {isCopied ? <Icons.Check /> : <Icons.Copy />}
            <span>{isCopied ? 'Copied!' : 'Copy'}</span>
        </button>

        <div className="w-px h-5 bg-zinc-200 dark:bg-white/10 shrink-0"></div>

        {/* Chords Toggle */}
        <button
            onClick={handleToggleChords}
            className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${showChords ? 'bg-primary/10 text-primary' : 'text-zinc-600 dark:text-zinc-300 hover:bg-primary/10 hover:text-primary'}`}
            aria-label="Toggle chords"
        >
            <Icons.Music />
            <span>Chords</span>
        </button>

        <div className="w-px h-5 bg-zinc-200 dark:bg-white/10 shrink-0"></div>

        {/* Focus Mode Toggle (Only for Host) */}
        {syncState?.status === 'host' && (
          <>
            <button
                onClick={handleToggleFocus}
                className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors ${syncState.isFocusMode ? 'bg-amber-500/10 text-amber-500' : 'text-zinc-600 dark:text-zinc-300 hover:bg-amber-500/10 hover:text-amber-500'}`}
                aria-label="Toggle focus mode"
            >
                <Icons.Focus />
                <span>Focus</span>
            </button>
            <div className="w-px h-5 bg-zinc-200 dark:bg-white/10 shrink-0"></div>
          </>
        )}

        {/* Translate Button & Menu */}
        <div className="relative flex-1 min-w-fit" ref={langMenuRef}>
            <button
                onClick={() => {
                    if (isShowingTranslation) {
                        setIsShowingTranslation(false);
                        triggerFeedback?.('toggle');
                    } else {
                        setShowLangMenu(prev => !prev);
                        triggerFeedback?.('tap');
                    }
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors text-zinc-600 dark:text-zinc-300 hover:bg-primary/10 hover:text-primary group"
                aria-label="Translate lyrics"
            >
                {isTranslating ? (
                    <div className="w-4 h-4 border-2 border-zinc-300 border-t-primary rounded-full animate-spin"></div>
                ) : (
                    <Icons.Translate />
                )}
                <span>{isShowingTranslation ? targetLanguage : 'Translate'}</span>
                {isShowingTranslation && <div className="ml-1 p-0.5 rounded-full bg-zinc-200 dark:bg-white/10 group-hover:bg-red-500/20"><Icons.Close /></div>}
            </button>
            
            {showLangMenu && (
                 <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-white dark:bg-zinc-800 rounded-2xl shadow-lg border border-zinc-100 dark:border-white/10 p-2 z-20 animate-zoom-in origin-bottom">
                    {LANG_OPTIONS.map(lang => (
                        <button
                            key={lang}
                            onClick={() => handleTranslate(lang)}
                            className="w-full text-left px-3 py-2 rounded-lg text-xs font-bold text-zinc-700 dark:text-zinc-200 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                            {lang}
                        </button>
                    ))}
                </div>
            )}
        </div>
        
        <div className="w-px h-5 bg-zinc-200 dark:bg-white/10 shrink-0"></div>

        {/* Style Button */}
        <button
            onClick={handleToggleTheme}
            className="flex-1 min-w-fit flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-colors text-zinc-600 dark:text-zinc-300 hover:bg-primary/10 hover:text-primary"
            aria-label={`Change style to ${theme === 'modern' ? 'classic' : theme === 'classic' ? 'minimalist' : 'modern'}`}
        >
            <Icons.Style />
            <span className="capitalize">{theme}</span>
        </button>
    </div>
  );

  /* COLLECTION VIEW (Soundtracks / Albums) */
  if (isCollection) {
    const relatedSongs = data.metadata?.relatedSongs || [];
    return (
        <div className="w-full max-w-7xl mx-auto relative z-10 pt-16 pb-40 animate-fade-in px-4">
            <div className="flex flex-col lg:flex-row gap-12">
                {/* Hero Section */}
                <div className="w-full lg:w-1/3 lg:sticky lg:top-32 h-fit">
                    <div className="relative aspect-[2/3] md:aspect-square rounded-[var(--radius)] overflow-hidden shadow-2xl mb-8 group ring-1 ring-white/10">
                        {currentImageSrc ? (
                            <img src={currentImageSrc} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Art" />
                        ) : (
                            <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-6xl">💿</div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                    </div>
                    <h1 className="text-4xl lg:text-5xl font-black mb-3 text-zinc-900 dark:text-white leading-tight">
                        {data.metadata?.title}
                    </h1>
                    <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-widest border border-primary/20">
                            {data.metadata?.collectionType || 'Collection'}
                        </span>
                        <p className="text-xl text-zinc-500 font-medium">Soundtrack</p>
                    </div>
                    <p className="mt-6 text-zinc-600 dark:text-zinc-400 leading-relaxed italic opacity-80">
                        Select a track below to see the lyrics.
                    </p>
                </div>

                {/* Track List */}
                <div className="w-full lg:w-2/3">
                    <div className="glass-panel bg-white/[var(--bg-opacity)] dark:bg-surface/[var(--bg-opacity)] backdrop-blur-[var(--blur)] rounded-[var(--radius)] p-6 md:p-10 shadow-xl ring-1 ring-black/5 dark:ring-white/5 animate-slide-up-fade">
                        <h2 className="text-xs font-black text-zinc-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-3">
                            <span className="w-8 h-px bg-zinc-300 dark:bg-zinc-700"></span>
                            TRACKLIST
                        </h2>
                        
                        <div className="space-y-3">
                            {relatedSongs.length > 0 ? (
                                relatedSongs.map((song, index) => (
                                    <button
                                        key={index}
                                        onClick={() => {
                                            triggerFeedback?.('tap');
                                            onSearch(song);
                                        }}
                                        className="w-full group flex items-center gap-4 p-4 rounded-2xl hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all text-left"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/5 flex items-center justify-center text-sm font-bold text-zinc-400 group-hover:text-primary transition-colors">
                                            {(index + 1).toString().padStart(2, '0')}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-zinc-800 dark:text-zinc-200 truncate group-hover:text-primary transition-colors">
                                                {song.split(' - ')[0]}
                                            </p>
                                            <p className="text-xs text-zinc-500 truncate">
                                                {song.split(' - ')[1] || data.metadata?.artist || 'Unknown Artist'}
                                            </p>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-primary font-bold text-[10px] uppercase tracking-wider">
                                            Get Lyrics
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                        </div>
                                    </button>
                                ))
                            ) : (
                                <div className="py-12 text-center text-zinc-500 italic">
                                    No tracks identified for this collection.
                                </div>
                            )}
                        </div>

                        {data.text && !data.text.includes("No lyrics") && (
                            <div className="mt-12 pt-12 border-t border-zinc-100 dark:border-white/5">
                                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mb-4">About this {data.metadata?.collectionType || 'item'}</h3>
                                <div className="text-zinc-600 dark:text-zinc-400 prose dark:prose-invert max-w-none">
                                    {data.text}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
  }

  // Standard Rendering (Unified for Glass/Solid/Liquid)
  return (
    <div className="w-full max-w-7xl mx-auto relative z-10 px-4">
       <div className="flex flex-col lg:flex-row gap-12 items-start">
           
           {/* Album Art Sticky */}
           <div className="w-full lg:w-1/3 lg:sticky lg:top-32 animate-fade-in">
                <div className="relative aspect-square rounded-[var(--radius)] overflow-hidden shadow-2xl mb-6 group cursor-pointer" onClick={() => {}}>
                    {currentImageSrc ? (
                        <img src={currentImageSrc} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Art" />
                    ) : (
                        <div className="w-full h-full bg-zinc-800 flex items-center justify-center text-6xl">🎵</div>
                    )}
                </div>
                <h1 className="text-4xl lg:text-5xl font-black mb-2 text-zinc-900 dark:text-white leading-tight">{data.metadata?.title}</h1>
                <p className="text-xl text-zinc-500 font-medium">{data.metadata?.artist}</p>
                <div className="flex gap-4 mt-8">
                     <button onClick={() => setIsKaraokeMode(true)} className="flex-1 py-4 bg-primary text-white rounded-full font-bold shadow-lg shadow-primary/30 hover:scale-105 transition-transform">Karaoke</button>
                     <button onClick={() => onToggleFavorite(songKey)} className={`p-4 rounded-full border transition-colors ${isFavorite ? 'border-red-500 text-red-500 bg-red-50' : 'border-zinc-200 dark:border-white/10 text-zinc-400 hover:text-primary'}`}>
                        <svg className={`w-6 h-6 ${isFavorite ? 'fill-current' : 'fill-none'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                     </button>
                </div>
           </div>

           {/* Lyrics Content */}
           <div className="w-full lg:w-2/3 pb-40">
               <div className={`glass-panel bg-white/[var(--bg-opacity)] dark:bg-surface/[var(--bg-opacity)] backdrop-blur-[var(--blur)] rounded-[var(--radius)] p-8 md:p-12 shadow-xl ring-1 ring-black/5 dark:ring-white/5 animate-slide-up-fade ${syncState?.isFocusMode ? 'ring-4 ring-amber-500/30' : ''}`}>
                   <LyricsControls />
                   <div className={`${themeStyles[theme].font} ${themeStyles[theme].container}`}>
                       {parsedLyrics.map((stanza, sIdx) => (
                           <div key={stanza.id} className="animate-fade-in">
                               {stanza.headerText && <div className={themeStyles[theme].header}>{stanza.headerText}</div>}
                                {stanza.lines.map((line, lIdx) => {
                                    const lineId = `line-${sIdx}-${lIdx}`;
                                    const isMatched = matchedLineId === lineId;
                                    const isFocus = syncState?.isFocusMode;

                                    return (
                                        <div 
                                          key={lIdx} 
                                          id={lineId}
                                          onClick={() => handleLineClick(sIdx, lIdx)}
                                          className={`
                                            relative group cursor-pointer transition-all duration-700 ease-silky
                                            ${isFocus ? 'text-center py-6' : 'py-1'}
                                            ${isFocus && !isMatched ? 'opacity-20 scale-90 blur-[0.5px]' : 'opacity-100'}
                                            ${isFocus && isMatched ? 'scale-125 z-10' : ''}
                                            ${isMatched ? 'animate-highlight-pulse' : ''}
                                          `}
                                        >
                                            {/* Chords Layer */}
                                            {showChords && line.chords.length > 0 && (
                                                <div className={`flex gap-4 mb-1 h-6 ${isFocus ? 'justify-center' : ''}`}>
                                                    {line.chords.map((c, cIdx) => (
                                                        <span key={cIdx} className="text-xs font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                                            {c.chord}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <p className={`
                                              ${autoFontSize} leading-relaxed transition-all duration-700
                                              ${isMatched ? 'text-primary font-black' : 'text-zinc-800 dark:text-zinc-200'} 
                                              ${theme === 'classic' ? 'italic' : ''} 
                                              group-hover:text-primary
                                            `}>
                                                {highlightSnippet ? (
                                                    (() => {
                                                        const snippet = highlightSnippet;
                                                        // Escape special regex characters
                                                        const escapedSnippet = snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                                        const parts = line.text.split(new RegExp(`(${escapedSnippet})`, 'gi'));
                                                        return parts.map((part, i) => 
                                                            part.toLowerCase() === snippet.toLowerCase() 
                                                                ? <span key={i} className="bg-primary/20 rounded px-1 shadow-[0_0_15px_rgba(var(--color-primary),0.4)] ring-1 ring-primary/30">{part}</span> 
                                                                : part
                                                        );
                                                    })()
                                                ) : line.text}
                                            </p>

                                            {isMatched && !isFocus && (
                                                <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full animate-pulse"></div>
                                            )}
                                        </div>
                                    );
                                })}
                           </div>
                       ))}
                   </div>
               </div>
           </div>
       </div>
    </div>
  );
};
