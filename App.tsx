
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SearchBar } from './components/SearchBar';
import { LyricsDisplay } from './components/LyricsDisplay';
import { SearchHistory } from './components/SearchHistory';
import { SongSuggestions, getRandomSongs, SONG_POOL } from './components/SongSuggestions';
import { SettingsTray, ACCENT_COLORS } from './components/SettingsTray';
import { LoginModal } from './components/LoginModal';
import { KaraokeView } from './components/KaraokeView';
import { fetchLyrics, fetchLyricsWithChords, fetchTimedLyrics } from './services/geminiService';
import { storageService } from './services/storageService';
import { supabase } from './services/supabaseClient';
import { 
  SearchState, AccentKey, BgPattern, CardStyle, 
  UiScale, AnimSpeed, FavSortOrder, FeedbackType, User, SearchBarStyle, BorderRadius,
  SyncState, SyncEvent
} from './types';

// Helper for Color Extraction
const getDominantColor = (imageSrc: string): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageSrc;
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 1; canvas.height = 1;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, 1, 1);
                    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
                    resolve(`${r} ${g} ${b}`);
                } else {
                    resolve('56 189 248'); // Default Sky
                }
            } catch (e) {
                 resolve('56 189 248');
            }
        };
        img.onerror = () => resolve('56 189 248'); 
    });
};

const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isKaraokeMode, setIsKaraokeMode] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(true);
  const lastScrollY = useRef(0);
  
  // Sync State
  const [isRestoring, setIsRestoring] = useState(false);
  
  // SECURE STORAGE: Load User
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return storageService.getUser();
  });

  const [history, setHistory] = useState<string[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [choirs, setChoirs] = useState<{name: string, code: string}[]>([]);
  const [recommendationPool, setRecommendationPool] = useState<string[]>([]);
  const [suggestedSongs, setSuggestedSongs] = useState<string[]>([]);
  
  // Preferences are non-sensitive, stored in plain text for performance
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('lyricist_theme') as 'dark' | 'light') || 'dark');
  const [accent, setAccent] = useState<AccentKey>(() => (localStorage.getItem('lyricist_accent') as AccentKey) || 'sky');
  const [customPrimary, setCustomPrimary] = useState(() => localStorage.getItem('lyricist_custom_primary') || '255 0 255');
  const [customSecondary, setCustomSecondary] = useState(() => localStorage.getItem('lyricist_custom_secondary') || '0 255 255');
  
  const [bgPattern, setBgPattern] = useState<BgPattern>(() => (localStorage.getItem('lyricist_bg') as BgPattern) || 'none');
  const [cardStyle, setCardStyle] = useState<CardStyle>(() => {
      const stored = localStorage.getItem('lyricist_card') as any;
      if (stored === 'material-3') return 'glass'; // Migration
      return stored || 'glass';
  });
  const [searchBarStyle, setSearchBarStyle] = useState<SearchBarStyle>(() => (localStorage.getItem('lyricist_search_bar') as SearchBarStyle) || 'floating');
  const [uiScale, setUiScale] = useState<UiScale>(() => parseInt(localStorage.getItem('lyricist_scale') || '100') as UiScale);
  const [animSpeed, setAnimSpeed] = useState<AnimSpeed>(() => (localStorage.getItem('lyricist_anim_speed') as AnimSpeed) || 'normal');
  const [borderRadius, setBorderRadius] = useState<BorderRadius>(() => (localStorage.getItem('lyricist_radius') as BorderRadius) || 'round');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('lyricist_sound') !== 'false');
  const [hapticEnabled, setHapticEnabled] = useState(() => localStorage.getItem('lyricist_haptic') !== 'false');
  const [favSortOrder, setFavSortOrder] = useState<FavSortOrder>(() => (localStorage.getItem('lyricist_fav_sort') as FavSortOrder) || 'newest');
  
  const [syncStats, setSyncStats] = useState({ size: '0.0', unit: 'KB', status: 'Offline' });
  const [extractedColor, setExtractedColor] = useState<string | null>(null);

  // SYNC STATE
  const [syncState, setSyncState] = useState<SyncState>({
    roomCode: null,
    status: 'idle',
    isFocusMode: false,
    currentStanzaIndex: 0,
    currentLineIndex: 0,
    songTitle: null,
    artist: null,
    lyrics: null,
    chordsEnabled: false
  });

  const handleSyncStateChange = (newState: Partial<SyncState>) => {
    setSyncState(prev => ({ ...prev, ...newState }));
    
    // If we joined a room and it has a song, load it
    if (newState.lyrics && newState.lyrics !== syncState.lyrics) {
      setSearchState({
        status: 'success',
        data: {
          text: newState.lyrics,
          sources: [],
          metadata: {
            title: newState.songTitle || 'Shared Song',
            artist: newState.artist || 'Unknown'
          }
        },
        error: null
      });
    }
  };

  const handleSyncEvent = (event: SyncEvent) => {
    if (event.type === 'focus_toggle') {
      setSyncState(prev => ({ ...prev, isFocusMode: event.payload.enabled }));
    }
    // Dispatch to SyncPanel via custom event
    window.dispatchEvent(new CustomEvent('local-sync-event', { detail: event }));
  };

  useEffect(() => {
    const handleRemoteSync = (e: any) => {
      const { type, payload } = e.detail;
      if (type === 'song_change') {
        setSearchState({
          status: 'success',
          data: {
            text: payload.lyrics,
            sources: [],
            metadata: {
              title: payload.songTitle,
              artist: payload.artist
            }
          },
          error: null
        });
        setSyncState(prev => ({ 
          ...prev, 
          songTitle: payload.songTitle, 
          artist: payload.artist, 
          lyrics: payload.lyrics,
          currentStanzaIndex: 0,
          currentLineIndex: 0
        }));
      } else if (type === 'focus_toggle') {
        setSyncState(prev => ({ ...prev, isFocusMode: payload.enabled }));
      } else if (type === 'scroll') {
        setSyncState(prev => ({ 
          ...prev, 
          currentStanzaIndex: payload.stanzaIdx, 
          currentLineIndex: payload.lineIdx 
        }));
      }
    };
    window.addEventListener('remote-sync-event', handleRemoteSync);
    return () => window.removeEventListener('remote-sync-event', handleRemoteSync);
  }, []);

  // SUPABASE SESSION HANDLER
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        if (!currentUser || currentUser.id !== session.user.id) {
            const meta = session.user.user_metadata || {};
            const user: User = {
                id: session.user.id,
                username: meta.username || session.user.email?.split('@')[0] || 'User',
                email: session.user.email,
                avatarColor: meta.avatar_color || '#3b82f6',
                joinedDate: new Date(session.user.created_at).toLocaleDateString(),
                provider: 'supabase'
            };
            setCurrentUser(user);
            storageService.saveUser(user);
        }
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session?.user && currentUser?.provider === 'supabase') {
             setCurrentUser(null);
             storageService.saveUser(null);
        }
    });
    return () => subscription.unsubscribe();
  }, []);

  // SECURE STORAGE: Load Data & Hydrate
  useEffect(() => {
    setHistory(storageService.getData('history', currentUser));
    setFavorites(storageService.getData('favorites', currentUser));
    setChoirs(storageService.getData('choirs', currentUser));
    
    const recs = storageService.getData('recommendations', currentUser);
    setRecommendationPool(recs);
    setSuggestedSongs(getRandomSongs(recs));

    if (currentUser?.provider === 'supabase') {
        const syncRemote = async () => {
            setIsRestoring(true);
            try {
                const [rHistory, rFavorites, rRecs] = await Promise.all([
                    storageService.getRemoteData('history', currentUser),
                    storageService.getRemoteData('favorites', currentUser),
                    storageService.getRemoteData('recommendations', currentUser),
                ]);
                if (rFavorites) setFavorites(prev => Array.from(new Set([...prev, ...rFavorites])));
                if (rHistory) setHistory(prev => Array.from(new Set([...rHistory, ...prev])).slice(0, 20));
                if (rRecs) {
                    setRecommendationPool(prev => Array.from(new Set([...prev, ...rRecs])));
                    setSuggestedSongs(getRandomSongs(Array.from(new Set([...recommendationPool, ...rRecs]))));
                }
            } catch (e) { console.warn("Sync failed", e); } finally { setIsRestoring(false); }
        };
        syncRemote();
    } else {
        setIsRestoring(false);
    }
  }, [currentUser]);

  // SETTINGS SYNC
  useEffect(() => {
      const userAccent = storageService.getValue('accent', currentUser);
      if (userAccent) setAccent(userAccent);
      const userCustomPrimary = storageService.getValue('customPrimary', currentUser);
      if (userCustomPrimary) setCustomPrimary(userCustomPrimary);
      const userCustomSecondary = storageService.getValue('customSecondary', currentUser);
      if (userCustomSecondary) setCustomSecondary(userCustomSecondary);

      if (currentUser?.provider === 'supabase') {
          const syncSettings = async () => {
              const [rAccent, rPri, rSec] = await Promise.all([
                  storageService.getRemoteValue('accent', currentUser),
                  storageService.getRemoteValue('customPrimary', currentUser),
                  storageService.getRemoteValue('customSecondary', currentUser),
              ]);
              if (rAccent) setAccent(rAccent);
              if (rPri) setCustomPrimary(rPri);
              if (rSec) setCustomSecondary(rSec);
          };
          syncSettings();
      }
  }, [currentUser]);

  useEffect(() => {
      storageService.saveData('accent', accent, currentUser);
      localStorage.setItem('lyricist_accent', accent);
  }, [accent, currentUser]);

  useEffect(() => {
      storageService.saveData('customPrimary', customPrimary, currentUser);
      localStorage.setItem('lyricist_custom_primary', customPrimary);
  }, [customPrimary, currentUser]);

  useEffect(() => {
      storageService.saveData('customSecondary', customSecondary, currentUser);
      localStorage.setItem('lyricist_custom_secondary', customSecondary);
  }, [customSecondary, currentUser]);

  useEffect(() => {
    if (isRestoring) return;
    storageService.saveData('history', history, currentUser);
    storageService.saveData('favorites', favorites, currentUser);
    storageService.saveData('choirs', choirs, currentUser);
    storageService.saveData('recommendations', recommendationPool, currentUser);

    if (currentUser?.provider === 'supabase') {
        const totalSize = JSON.stringify(history).length + JSON.stringify(favorites).length + JSON.stringify(recommendationPool).length;
        const kb = totalSize / 1024;
        const mb = kb / 1024;
        if (mb >= 0.1) setSyncStats({ size: mb.toFixed(2), unit: 'MB', status: 'Active' });
        else setSyncStats({ size: kb.toFixed(1), unit: 'KB', status: 'Active' });
    } else {
        setSyncStats(prev => ({ ...prev, status: 'Offline' }));
    }
  }, [history, favorites, recommendationPool, currentUser, isRestoring]);

  // Scroll detection
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY < 50 || currentScrollY < 0) {
         setShowSearchBar(true);
         lastScrollY.current = currentScrollY;
         return;
      }
      const diff = currentScrollY - lastScrollY.current;
      if (diff > 10) setShowSearchBar(false);
      else if (diff < -10) setShowSearchBar(true);
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const [eggClicks, setEggClicks] = useState(0);
  const [isEggGameOpen, setIsEggGameOpen] = useState(false);
  const [gameScore, setGameScore] = useState(0);
  const [gameLevel, setGameLevel] = useState(1);
  const [questionsCorrect, setQuestionsCorrect] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<{song: string, correct: string, options: string[]} | null>(null);
  const [gameTimer, setGameTimer] = useState(30); 
  const [gameState, setGameState] = useState<'playing' | 'gameover'>('playing');
  const [streak, setStreak] = useState(0);
  const [powerups, setPowerups] = useState({ split: 1, freeze: 1 });
  const [isFrozen, setIsFrozen] = useState(false);
  const [removedOptions, setRemovedOptions] = useState<string[]>([]);
  const [playedQuestions, setPlayedQuestions] = useState<Set<string>>(new Set());
  
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle', data: null, error: null });
  const [suggestionsKey, setSuggestionsKey] = useState(0);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioContext = () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  };

  const triggerFeedback = useCallback((type: FeedbackType = 'tap') => {
    if (soundEnabled) {
        try {
            const ctx = getAudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const now = ctx.currentTime;
            osc.connect(gain);
            gain.connect(ctx.destination);
            if (type === 'tap' || type === 'light') {
                osc.type = 'sine'; osc.frequency.setValueAtTime(800, now); osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
                gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
                osc.start(now); osc.stop(now + 0.05);
            } else if (type === 'toggle') {
                osc.type = 'triangle'; osc.frequency.setValueAtTime(400, now);
                gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.03);
                osc.start(now); osc.stop(now + 0.04);
            } else if (type === 'success') {
                const notes = [523.25, 659.25, 783.99]; 
                notes.forEach((freq, i) => {
                    const o = ctx.createOscillator(); const g = ctx.createGain();
                    o.type = 'sine'; o.frequency.value = freq; o.connect(g); g.connect(ctx.destination);
                    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(0.05, now + 0.05 + (i * 0.05));
                    g.gain.exponentialRampToValueAtTime(0.001, now + 0.4 + (i * 0.05));
                    o.start(now + (i * 0.05)); o.stop(now + 0.5 + (i * 0.05));
                });
            } else if (type === 'error') {
                osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.linearRampToValueAtTime(50, now + 0.3);
                gain.gain.setValueAtTime(0.05, now); gain.gain.linearRampToValueAtTime(0, now + 0.3);
                osc.start(now); osc.stop(now + 0.3);
            } else if (type === 'gamewin') {
                osc.type = 'sine'; osc.frequency.setValueAtTime(400, now); osc.frequency.exponentialRampToValueAtTime(1200, now + 0.6);
                gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.6);
                osc.start(now); osc.stop(now + 0.6);
            }
        } catch (e) {}
    }
    if (hapticEnabled && navigator.vibrate) {
        if (type === 'tap' || type === 'light') navigator.vibrate(8);
        else if (type === 'toggle') navigator.vibrate(15);
        else if (type === 'success') navigator.vibrate([10, 30, 10]);
        else if (type === 'error') navigator.vibrate([50, 30, 50]);
        else if (type === 'gamewin') navigator.vibrate([20, 50, 20, 50, 20]);
    }
  }, [soundEnabled, hapticEnabled]);

  const handleLogin = (user: User) => {
    setIsRestoring(true);
    setCurrentUser(user);
    storageService.saveUser(user);
    setIsLoginOpen(false);
  };

  const handleLogout = async () => {
    if (currentUser?.provider === 'supabase') {
        await supabase.auth.signOut();
    }
    setCurrentUser(null);
    storageService.saveUser(null);
    setIsSettingsOpen(false);
    triggerFeedback('toggle');
  };

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    if (theme === 'dark') root.classList.add('dark'); else root.classList.remove('dark');
    
    body.classList.remove('style-liquid-glass', 'style-glass', 'style-solid');
    if (cardStyle === 'liquid-glass') body.classList.add('style-liquid-glass');
    else if (cardStyle === 'glass') body.classList.add('style-glass');
    else if (cardStyle === 'solid') body.classList.add('style-solid');

    // Radius Logic
    let radiusValue = '1.5rem';
    let radiusSmValue = '0.75rem';
    let radiusSearchValue = '9999px'; // Default pill shape for 'round'
    
    if (borderRadius === 'soft') {
        radiusValue = '0.75rem';
        radiusSmValue = '0.375rem';
        radiusSearchValue = '0.75rem';
    } else if (borderRadius === 'sharp') {
        radiusValue = '0px';
        radiusSmValue = '0px';
        radiusSearchValue = '0px';
    }
    
    root.style.setProperty('--radius', radiusValue);
    root.style.setProperty('--radius-sm', radiusSmValue);
    root.style.setProperty('--radius-search', radiusSearchValue);

    // Color Logic: Extracted > Custom > Preset
    if (accent === 'custom') {
        root.style.setProperty('--color-primary', customPrimary);
        root.style.setProperty('--color-secondary', customSecondary);
    } else {
        root.style.setProperty('--color-primary', ACCENT_COLORS[accent].primary);
        root.style.setProperty('--color-secondary', ACCENT_COLORS[accent].secondary);
    }
    
    root.style.setProperty('--anim-speed', animSpeed === 'slow' ? '1.5' : animSpeed === 'fast' ? '0.6' : '1');
    root.style.fontSize = `${uiScale}%`;
  }, [theme, accent, customPrimary, customSecondary, uiScale, animSpeed, cardStyle, extractedColor, borderRadius]);

  // Game Logic
  const generateQuestion = useCallback(() => {
    const pool = SONG_POOL;
    let available = pool.filter(s => !playedQuestions.has(s));
    if (available.length === 0) {
        setPlayedQuestions(new Set());
        available = pool;
    }
    const targetSong = available[Math.floor(Math.random() * available.length)];
    const [title, artist] = targetSong.split(' - ');
    if (!title || !artist) return;
    let wrongOptions: string[] = [];
    let attempts = 0;
    while (wrongOptions.length < 3 && attempts < 50) {
        attempts++;
        const randomArtist = SONG_POOL[Math.floor(Math.random() * SONG_POOL.length)].split(' - ')[1];
        if (randomArtist && randomArtist !== artist && !wrongOptions.includes(randomArtist)) {
            wrongOptions.push(randomArtist);
        }
    }
    while(wrongOptions.length < 3) wrongOptions.push(`Artist ${wrongOptions.length + 101}`);
    setRemovedOptions([]); 
    setCurrentQuestion({ 
        song: title, 
        correct: artist, 
        options: [artist, ...wrongOptions].sort(() => Math.random() - 0.5) 
    });
    setPlayedQuestions(prev => new Set(prev).add(targetSong));
  }, [gameLevel, recommendationPool, playedQuestions]);

  const handleAnswer = (selected: string) => {
    if (!currentQuestion || gameState !== 'playing') return;
    if (selected === currentQuestion.correct) {
        setGameScore(prev => prev + 10 * (streak + 1) * gameLevel);
        setStreak(prev => prev + 1);
        setQuestionsCorrect(prev => prev + 1);
        setGameTimer(prev => Math.min(prev + 5, 60)); 
        triggerFeedback('success');
        if ((questionsCorrect + 1) % 5 === 0) {
            setGameLevel(prev => prev + 1);
            setGameTimer(prev => Math.min(prev + 10, 60)); 
            // Award random powerup
            setPowerups(prev => {
                const rand = Math.random();
                if (rand > 0.5) return { ...prev, split: prev.split + 1 };
                return { ...prev, freeze: prev.freeze + 1 };
            });
            triggerFeedback('gamewin');
        }
        generateQuestion();
    } else {
        setStreak(0);
        setGameTimer(prev => Math.max(0, prev - 10)); 
        triggerFeedback('error');
        if (gameTimer - 10 <= 0) setGameState('gameover');
    }
  };

  const usePowerup = (type: 'split' | 'freeze') => {
      if (powerups[type] > 0 && currentQuestion && gameState === 'playing') {
          setPowerups(prev => ({...prev, [type]: prev[type] - 1}));
          triggerFeedback('light');
          if (type === 'split') {
              const wrong = currentQuestion.options.filter(o => o !== currentQuestion.correct);
              setRemovedOptions(wrong.slice(0, 2));
          } else if (type === 'freeze') {
              setIsFrozen(true);
              setTimeout(() => setIsFrozen(false), 5000);
          }
      }
  };

  useEffect(() => {
    let interval: any;
    if (isEggGameOpen && gameState === 'playing' && !isFrozen) {
        interval = setInterval(() => {
            setGameTimer(prev => {
                if (prev <= 1) {
                    setGameState('gameover');
                    triggerFeedback('error');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }
    return () => clearInterval(interval);
  }, [isEggGameOpen, gameState, isFrozen, triggerFeedback]);

  const startArcadeGame = () => {
    setIsEggGameOpen(true);
    setGameState('playing');
    setGameScore(0);
    setGameLevel(1);
    setQuestionsCorrect(0);
    setStreak(0);
    setGameTimer(30);
    setPowerups({ split: 1, freeze: 1 });
    setPlayedQuestions(new Set());
    generateQuestion();
    triggerFeedback('gamewin');
  };

  const refreshSuggestions = useCallback(() => {
    setSuggestedSongs(getRandomSongs(recommendationPool));
    setSuggestionsKey(prev => prev + 1);
    triggerFeedback('success');
  }, [recommendationPool, triggerFeedback]);

  const handleSearch = async (query: string, useChords: boolean = false) => {
    if (!query.trim()) return;
    setSearchQuery(query);
    setSearchState({ status: 'loading', data: null, error: null });
    triggerFeedback('tap');
    
    try {
      const result = useChords ? await fetchLyricsWithChords(query) : await fetchLyrics(query);
      setSearchState({ status: 'success', data: result, error: null });
      
      if (result.metadata?.title) {
        setHistory(prev => [query, ...prev.filter(q => q !== query)].slice(0, 20));
        setRecommendationPool(prev => [...prev, query]);
      }

      // Sync if host
      if (syncState.status === 'host') {
        handleSyncEvent({
          type: 'song_change',
          payload: {
            songTitle: result.metadata?.title || query,
            artist: result.metadata?.artist || 'Unknown',
            lyrics: result.text
          }
        });
      }
    } catch (err: any) {
      setSearchState({ status: 'error', data: null, error: err.message });
      triggerFeedback('error');
    }
  };

  const handleImportLyrics = (title: string, artist: string, lyrics: string) => {
    const result = {
      text: lyrics,
      sources: [],
      metadata: { title, artist }
    };
    setSearchState({ status: 'success', data: result, error: null });
    
    if (syncState.status === 'host') {
      handleSyncEvent({
        type: 'song_change',
        payload: { songTitle: title, artist, lyrics }
      });
    }
  };

  const handleFavoriteToggle = (song: string) => {
      setFavorites(favorites.includes(song) ? favorites.filter(f => f !== song) : [song, ...favorites]);
      triggerFeedback('toggle');
  };

  const resetApp = () => {
    setSearchState({ status: 'idle', data: null, error: null });
    setSearchQuery(''); 
    refreshSuggestions();
    triggerFeedback('tap');
  };

  const handleKaraokeMode = async (enabled: boolean) => {
    setIsKaraokeMode(enabled);
    if (enabled && searchState.data && !searchState.data.timedLyrics) {
      // Try to fetch timed lyrics if they don't exist
      setIsSyncing(true);
      try {
        const query = `${searchState.data.metadata?.title} ${searchState.data.metadata?.artist}`;
        const timedResult = await fetchTimedLyrics(query);
        if (timedResult.timedLyrics && timedResult.timedLyrics.length > 0) {
          setSearchState(prev => ({
            ...prev,
            data: {
              ...prev.data!,
              timedLyrics: timedResult.timedLyrics
            }
          }));
        }
      } catch (e) {
        console.warn("Failed to fetch timed lyrics", e);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const isDarkMode = theme === 'dark';

  return (
    <div className={`min-h-[100dvh] transition-colors duration-700 ease-in-out font-sans ${bgPattern === 'grid' ? 'bg-pattern-grid' : bgPattern === 'dots' ? 'bg-pattern-dots' : ''}`}>
      
      {/* Adaptive Blob Background */}
      {/* Always active for Glass and Liquid-Glass styles */}
      <div className={`fixed inset-0 z-0 overflow-hidden pointer-events-none transition-all duration-1000 ${cardStyle === 'solid' ? 'opacity-30' : 'opacity-100'}`}>
          {/* Primary Aura */}
          <div className={`absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full blur-[140px] animate-blob transition-colors duration-1000 ${isDarkMode ? 'bg-primary/15' : 'bg-primary/30'}`}></div>
          {/* Secondary Aura */}
          <div className={`absolute top-10 right-1/4 w-[500px] h-[500px] rounded-full blur-[140px] animate-blob animation-delay-2000 transition-colors duration-1000 ${isDarkMode ? 'bg-secondary/10' : 'bg-secondary/25'}`}></div>
          {/* Daytime Sun/Glow */}
          {!isDarkMode && (
              <div className="absolute top-[-10%] left-[-10%] w-[800px] h-[800px] bg-yellow-100/20 rounded-full blur-[160px] animate-pulse-slow"></div>
          )}
      </div>

      {!currentUser ? (
          <LoginModal 
            isOpen={true} 
            onClose={() => {}} 
            onLogin={handleLogin} 
            triggerFeedback={triggerFeedback}
            blocking={true}
          />
      ) : (
          <>
            <div className={`relative z-10 flex flex-col min-h-[100dvh] max-w-6xl mx-auto px-4 md:px-8 ${isKaraokeMode ? 'hidden' : ''}`}>
                {searchState.status !== 'success' && (
                <header className="pt-24 pb-12 flex flex-col items-center justify-center text-center animate-fade-in">
                    <h1 
                    className={`text-6xl md:text-8xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary via-secondary to-primary animate-gradient-xy bg-[length:200%_auto] cursor-pointer select-none transition-all duration-500 ${isDarkMode ? 'drop-shadow-[0_0_15px_rgba(var(--color-primary),0.3)]' : 'drop-shadow-sm'}`} 
                    onClick={() => {
                        if (searchState.status === 'idle') {
                            setEggClicks(prev => {
                                const next = prev + 1;
                                if (next === 5) {
                                    startArcadeGame();
                                    return 0;
                                }
                                triggerFeedback('tap');
                                return next;
                            });
                        } else {
                            resetApp();
                        }
                    }}
                    >
                    Lyricist
                    </h1>
                    <p className={`text-lg font-medium tracking-wide transition-colors duration-500 ${isDarkMode ? 'text-zinc-500' : 'text-zinc-600'}`}>Exact Lyrics Finder</p>
                </header>
                )}

                <main className={`flex-1 flex flex-col items-center w-full pb-40 ${searchState.status === 'success' ? 'pt-24 md:pt-32' : ''}`}>
                
                {searchState.status === 'idle' && (
                    <div className="flex-1 flex flex-col justify-center w-full">
                    <SongSuggestions 
                        key={suggestionsKey} 
                        songs={suggestedSongs} 
                        onSelect={(q) => { setSearchQuery(q); handleSearch(q); }} 
                        variant="grid"
                    />
                    </div>
                )}

                {searchState.status === 'loading' && (
                    <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in">
                    <div className="flex items-end justify-center gap-1 h-[3.25rem] mb-4">
                        {[...Array(9)].map((_, i) => (
                            <div key={i} className="w-1.5 bg-gradient-to-t from-primary to-secondary rounded-full animate-wave" style={{ animationDelay: `${i * 0.1}s`, height: '100%' }}></div>
                        ))}
                    </div>
                    <p className="text-zinc-400 dark:text-zinc-500 font-medium animate-pulse text-sm">Loading...</p>
                    </div>
                )}

                {searchState.status === 'success' && searchState.data && (
                    <LyricsDisplay 
                        data={searchState.data} 
                        searchQuery={searchQuery}
                        onSearch={handleSearch} 
                        isKaraokeMode={isKaraokeMode} 
                        setIsKaraokeMode={handleKaraokeMode} 
                        favorites={favorites} 
                        onToggleFavorite={handleFavoriteToggle} 
                        triggerFeedback={triggerFeedback}
                        cardStyle={cardStyle} 
                        syncState={syncState}
                        onSyncEvent={handleSyncEvent}
                    />
                )}

                {searchState.status === 'error' && (
                    <div className="text-center mt-12 p-8 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-[var(--radius)] animate-zoom-in max-w-lg">
                    <h2 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Oops!</h2>
                    <p className="text-zinc-600 dark:text-zinc-300">{searchState.error}</p>
                    <button onClick={resetApp} className="mt-6 px-6 py-2 bg-red-600 text-white font-medium rounded-full hover:scale-105 transition-all">Try Again</button>
                    </div>
                )}
                </main>

                {!isKaraokeMode && (
                <div className={`fixed bottom-0 left-0 right-0 z-50 flex flex-col items-center justify-end pb-8 pointer-events-none transition-all duration-500 ease-silky ${showSearchBar ? 'translate-y-0 opacity-100' : 'translate-y-[120%] opacity-0'}`}>
                    
                    {/* History Chips - Right above search bar */}
                    {searchState.status === 'idle' && (
                        <SearchHistory 
                            history={history} 
                            onSelect={(q) => { setSearchQuery(q); handleSearch(q); }} 
                            onClear={() => { setHistory([]); triggerFeedback('tap'); }}
                            compact={true}
                        />
                    )}

                    {/* Search Bar Wrapper */}
                    <div className="w-full pointer-events-auto">
                        <SearchBar 
                            query={searchQuery} 
                            setQuery={setSearchQuery} 
                            onSearch={handleSearch} 
                            onImport={handleImportLyrics}
                            isLoading={searchState.status === 'loading'} 
                            history={history}
                        />
                    </div>
                </div>
                )}
            </div>

            {/* Header Controls (Settings, Reset) */}
            {!isKaraokeMode && (
                <div className="fixed top-6 left-6 right-6 z-40 flex justify-between items-center">
                <button onClick={resetApp} className={`p-3 rounded-full backdrop-blur-xl border text-zinc-600 dark:text-zinc-400 hover:text-primary transition-all shadow-lg hover:scale-110 ${isDarkMode ? 'bg-black/40 border-white/10' : 'bg-white/60 border-black/5'}`}>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                </button>
                
                <div className="flex gap-3">
                    {currentUser && (
                    <button onClick={() => setIsSettingsOpen(true)} className={`p-1 px-3 rounded-full backdrop-blur-xl border flex items-center gap-2 transition-all hover:bg-primary/20 shadow-lg ${isDarkMode ? 'bg-primary/10 border-primary/20' : 'bg-white/60 border-black/5'}`}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] text-white font-black" style={{ backgroundColor: currentUser.avatarColor }}>{currentUser.username[0].toUpperCase()}</div>
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{currentUser.username}</span>
                    </button>
                    )}
                    <button onClick={() => setIsSettingsOpen(true)} className={`p-3 rounded-full backdrop-blur-xl border text-zinc-600 dark:text-zinc-400 hover:text-primary transition-all shadow-lg hover:rotate-90 ${isDarkMode ? 'bg-black/40 border-white/10' : 'bg-white/60 border-black/5'}`}>
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                </div>
                </div>
            )}
            
            {isKaraokeMode && searchState.data && (
              <KaraokeView 
                data={searchState.data}
                isSyncing={isSyncing}
                onClose={() => {
                  handleKaraokeMode(false);
                  triggerFeedback('toggle');
                }}
              />
            )}

            <SettingsTray 
                isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}
                config={{
                    theme, setTheme, accent, setAccent, customPrimary, setCustomPrimary, customSecondary, setCustomSecondary,
                    cardStyle, setCardStyle, borderRadius, setBorderRadius, searchBarStyle, setSearchBarStyle,
                    uiScale, setUiScale, animSpeed, setAnimSpeed, soundEnabled, setSoundEnabled, hapticEnabled, setHapticEnabled,
                    favorites, favSortOrder, setFavSortOrder, currentUser, logout: handleLogout, openLogin: () => setIsLoginOpen(true),
                    syncState, onSyncStateChange: handleSyncStateChange, choirs, onSaveChoir: (name, code) => setChoirs(prev => [...prev, { name, code }])
                }}
                actions={{ toggleFavorite: handleFavoriteToggle, onSearch: (q) => { setSearchQuery(q); handleSearch(q); setIsSettingsOpen(false); }, triggerFeedback, onSyncEvent: handleSyncEvent }}
                syncStats={syncStats}
            />
            {isEggGameOpen && (
                <div className="fixed inset-0 z-[200] bg-black text-white bg-scanlines font-mono flex flex-col items-center justify-center overflow-hidden animate-circle-expand crt-flicker">
                     {/* Retro Grid / Scanlines Overlay */}
                     <div className="absolute inset-0 bg-gradient-to-b from-transparent to-primary/10 pointer-events-none"></div>
                     
                     {/* Game Header */}
                     <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-primary uppercase tracking-widest opacity-70">Score</span>
                            <span className="text-2xl font-bold glitch-text">{gameScore.toLocaleString().padStart(6, '0')}</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-secondary uppercase tracking-widest opacity-70">Level</span>
                            <span className="text-2xl font-bold">{gameLevel}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-red-500 uppercase tracking-widest opacity-70">Time</span>
                            <span className={`text-2xl font-bold ${gameTimer < 10 ? 'animate-pulse text-red-500' : ''}`}>
                                {gameTimer}s
                            </span>
                        </div>
                     </div>

                     {/* Main Game Area */}
                     <div className="relative z-10 w-full max-w-2xl px-6 flex flex-col items-center">
                        {gameState === 'playing' ? (
                            <>
                                <div className="mb-12 text-center">
                                    <span className="text-xs text-primary uppercase tracking-[0.3em] mb-4 block animate-pulse">Identify the Artist</span>
                                    <h2 className="text-3xl md:text-5xl font-black tracking-tighter leading-tight mb-2 uppercase italic">
                                        "{currentQuestion?.song}"
                                    </h2>
                                    <div className="h-1 w-24 bg-primary mx-auto mt-4"></div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                                    {currentQuestion?.options.map((option, idx) => (
                                        <button
                                            key={idx}
                                            disabled={removedOptions.includes(option)}
                                            onClick={() => handleAnswer(option)}
                                            className={`
                                                group relative p-6 border-2 transition-all duration-300 text-left overflow-hidden
                                                ${removedOptions.includes(option) ? 'opacity-20 grayscale cursor-not-allowed border-zinc-800' : 'border-white/20 hover:border-primary hover:bg-primary/10 active:scale-95'}
                                            `}
                                        >
                                            <span className="absolute top-2 left-2 text-[10px] opacity-30 group-hover:opacity-100 transition-opacity">0{idx + 1}</span>
                                            <span className="text-lg font-bold tracking-tight block truncate pr-4">{option}</span>
                                            <div className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-500 w-0 group-hover:w-full"></div>
                                        </button>
                                    ))}
                                </div>

                                {/* Powerups */}
                                <div className="mt-12 flex gap-6">
                                    <button 
                                        onClick={() => usePowerup('split')}
                                        disabled={powerups.split === 0}
                                        className={`flex flex-col items-center gap-2 group ${powerups.split === 0 ? 'opacity-30' : 'hover:scale-110'}`}
                                    >
                                        <div className="w-12 h-12 rounded-full border-2 border-primary flex items-center justify-center group-hover:bg-primary group-hover:text-black transition-all">
                                            <span className="font-bold">50</span>
                                        </div>
                                        <span className="text-[10px] uppercase tracking-widest">Split</span>
                                    </button>
                                    <button 
                                        onClick={() => usePowerup('freeze')}
                                        disabled={powerups.freeze === 0}
                                        className={`flex flex-col items-center gap-2 group ${powerups.freeze === 0 ? 'opacity-30' : 'hover:scale-110'}`}
                                    >
                                        <div className={`w-12 h-12 rounded-full border-2 border-secondary flex items-center justify-center group-hover:bg-secondary group-hover:text-black transition-all ${isFrozen ? 'bg-secondary text-black animate-pulse' : ''}`}>
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        </div>
                                        <span className="text-[10px] uppercase tracking-widest">Freeze</span>
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div className="text-center animate-zoom-in">
                                <h2 className="text-6xl md:text-8xl font-black mb-4 glitch-text italic tracking-tighter">GAME OVER</h2>
                                <div className="space-y-2 mb-12">
                                    <p className="text-xl opacity-70 uppercase tracking-widest">Final Score</p>
                                    <p className="text-5xl font-bold text-primary">{gameScore.toLocaleString()}</p>
                                </div>
                                <div className="flex flex-col md:flex-row gap-4 justify-center">
                                    <button 
                                        onClick={startArcadeGame}
                                        className="px-12 py-4 bg-primary text-black font-black text-xl uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                                    >
                                        Retry
                                    </button>
                                    <button 
                                        onClick={() => setIsEggGameOpen(false)}
                                        className="px-12 py-4 border-2 border-white/20 hover:border-white text-white font-black text-xl uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
                                    >
                                        Exit
                                    </button>
                                </div>
                            </div>
                        )}
                     </div>

                     {/* Streak Indicator */}
                     {streak > 1 && gameState === 'playing' && (
                         <div className="absolute bottom-12 left-1/2 -translate-x-1/2 animate-bounce">
                             <span className="text-primary font-black text-2xl italic tracking-tighter">
                                 {streak}X STREAK!
                             </span>
                         </div>
                     )}

                     {/* Footer Info */}
                     <div className="absolute bottom-6 left-6 right-6 flex justify-between text-[10px] uppercase tracking-widest opacity-30">
                         <span>Lyricist Arcade v1.0</span>
                         <span>© 2026 Saisriram Sr</span>
                     </div>
                </div>
            )}
          </>
      )}
    </div>
  );
};

export default App;
