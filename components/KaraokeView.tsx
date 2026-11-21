import React, { useState, useMemo, useEffect, useRef } from 'react';
import YouTube, { YouTubeProps } from 'react-youtube';
import { motion, AnimatePresence } from 'motion/react';
import { LyricsResult } from '../types';

interface KaraokeViewProps {
  data: LyricsResult;
  onClose: () => void;
  isSyncing?: boolean;
}

interface LyricLine {
  id: number;
  text: string;
  startTime?: number;
}

export const KaraokeView: React.FC<KaraokeViewProps> = ({ data, onClose, isSyncing }) => {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [syncOffset, setSyncOffset] = useState(0); // in seconds
  const [isRecordMode, setIsRecordMode] = useState(false);
  const playerRef = useRef<any>(null);

  // Use local state for timed lyrics to allow manual adjustments
  const [lyricLines, setLyricLines] = useState<LyricLine[]>([]);

  // Initialize lyricLines
  useEffect(() => {
    let lines: LyricLine[] = [];
    if (data.timedLyrics && data.timedLyrics.length > 0) {
      lines = data.timedLyrics.map((line, index) => ({
        id: index,
        text: line.text,
        startTime: line.startTime
      }));
    } else if (data.text) {
      lines = data.text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('[')) 
        .map((line, index) => ({
          id: index,
          text: line,
        }));
    }
    setLyricLines(lines);
  }, [data.text, data.timedLyrics]);

  // Player logic for auto-sync using requestAnimationFrame for ultra-smooth updates
  useEffect(() => {
    if (!lyricLines.some(l => l.startTime !== undefined) || isRecordMode) return;

    let rafId: number;
    const updateTime = () => {
      if (playerRef.current && isPlaying) {
        const rawTime = playerRef.current.getCurrentTime();
        // Fallback for weird player behaviors
        const time = Math.max(0, rawTime + syncOffset);
        setCurrentTime(rawTime);
        
        if (isAutoScrollEnabled) {
          // Find the active line using the adjusted time
          let activeIndex = -1;
          for (let i = 0; i < lyricLines.length; i++) {
            if (lyricLines[i].startTime !== undefined && lyricLines[i].startTime! <= time) {
              activeIndex = i;
            } else if (lyricLines[i].startTime !== undefined && lyricLines[i].startTime! > time) {
              break;
            }
          }
          
          if (activeIndex !== -1 && activeIndex !== currentLineIndex) {
            setCurrentLineIndex(activeIndex);
          }
        }
      }
      rafId = requestAnimationFrame(updateTime);
    };

    rafId = requestAnimationFrame(updateTime);
    return () => cancelAnimationFrame(rafId);
  }, [lyricLines, isPlaying, currentLineIndex, isAutoScrollEnabled, syncOffset, isRecordMode]);

  // Handle manual sync capture
  const captureTiming = () => {
    if (!playerRef.current) return;
    const time = playerRef.current.getCurrentTime();
    
    setLyricLines(prev => {
      const newLines = [...prev];
      newLines[currentLineIndex] = {
        ...newLines[currentLineIndex],
        startTime: time
      };
      return newLines;
    });

    // Move to next line automatically in record mode
    if (currentLineIndex < lyricLines.length - 1) {
      setCurrentLineIndex(prev => prev + 1);
    }
  };

  // Keyboard support for space sync
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isRecordMode) {
        e.preventDefault();
        captureTiming();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecordMode, currentLineIndex, lyricLines]);
  
  const handleNext = () => {
    const nextIdx = Math.min(currentLineIndex + 1, lyricLines.length - 1);
    setCurrentLineIndex(nextIdx);
    if (lyricLines[nextIdx].startTime !== undefined && playerRef.current) {
      playerRef.current.seekTo(lyricLines[nextIdx].startTime - syncOffset, true);
    } else {
      setIsAutoScrollEnabled(false);
    }
  };

  const handlePrev = () => {
    const prevIdx = Math.max(currentLineIndex - 1, 0);
    setCurrentLineIndex(prevIdx);
    if (lyricLines[prevIdx].startTime !== undefined && playerRef.current) {
      playerRef.current.seekTo(lyricLines[prevIdx].startTime - syncOffset, true);
    } else {
      setIsAutoScrollEnabled(false);
    }
  };

  const adjustSync = (amount: number) => {
    setSyncOffset(prev => Math.round((prev + amount) * 100) / 100);
  };

  const handleLineClick = (index: number) => {
    if (index < 0 || index >= lyricLines.length) return;
    setCurrentLineIndex(index);
    const targetLine = lyricLines[index];
    if (targetLine.startTime !== undefined && playerRef.current) {
      playerRef.current.seekTo(targetLine.startTime - syncOffset, true);
    } else {
      setIsAutoScrollEnabled(false);
    }
  };

  const toggleAutoScroll = () => {
    setIsAutoScrollEnabled(prev => !prev);
  };

  const prevLine = lyricLines[currentLineIndex - 1];
  const currentLine = lyricLines[currentLineIndex];
  const nextLine = lyricLines[currentLineIndex + 1];

  const onPlayerReady: YouTubeProps['onReady'] = (event) => {
    playerRef.current = event.target;
    setDuration(event.target.getDuration());
    event.target.playVideo();
  };

  const onPlayerStateChange: YouTubeProps['onStateChange'] = (event) => {
    // 1 = playing, 2 = paused
    if (event.data === 1) setIsPlaying(true);
    if (event.data === 2) setIsPlaying(false);
  };

  const videoOptions: YouTubeProps['opts'] = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1,
      controls: 0,
      modestbranding: 1,
      rel: 0,
      iv_load_policy: 3,
      disablekb: 1,
    },
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Calculate progress within the current line
  const lineProgress = useMemo(() => {
    if (currentLineIndex < 0 || currentLineIndex >= lyricLines.length) return 0;
    const currentLineStart = lyricLines[currentLineIndex].startTime;
    const nextLineStart = lyricLines[currentLineIndex + 1]?.startTime || (lyricLines[currentLineIndex + 1] ? undefined : duration);
    
    if (currentLineStart === undefined || nextLineStart === undefined) return isRecordMode ? 0 : 100;
    
    const timeInLine = currentTime + syncOffset - currentLineStart;
    const lineDuration = nextLineStart - currentLineStart;
    
    if (lineDuration <= 0) return 0;
    return Math.min(100, Math.max(0, (timeInLine / lineDuration) * 100));
  }, [currentLineIndex, lyricLines, currentTime, duration, syncOffset, isRecordMode]);

  // Lead-in progress for the next line (starts 2 seconds before nextLineStart)
  const nextLineLeadIn = useMemo(() => {
    if (!nextLine || nextLine.startTime === undefined) return 0;
    const timeToNext = nextLine.startTime - (currentTime + syncOffset);
    if (timeToNext > 2 || timeToNext < 0) return 0;
    return ((2 - timeToNext) / 2) * 100;
  }, [nextLine, currentTime, syncOffset]);

  return (
    <div className="fixed inset-0 z-[200] bg-black text-white font-space flex flex-col items-center justify-center p-4 overflow-hidden">
      
      {/* Background elements */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-black to-black opacity-60"></div>
      
      {data.metadata?.image && (
        <motion.img 
          key={data.metadata.image}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.15 }}
          src={data.metadata.image} 
          className="absolute inset-0 w-full h-full object-cover blur-[80px] pointer-events-none" 
          alt="background"
        />
      )}

      {/* Header Info */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-6 left-6 z-20 flex items-center gap-4"
      >
        {data.metadata?.image && (
          <img src={data.metadata.image} className="w-12 h-12 rounded-lg shadow-lg border border-white/10" alt="Album" />
        )}
        <div className="flex flex-col">
          <span className="text-sm font-black tracking-widest text-primary uppercase">{data.metadata?.title}</span>
          <span className="text-xs font-bold text-zinc-400">{data.metadata?.artist}</span>
        </div>
      </motion.div>

      {/* Sync Adjustment Panel */}
      {lyricLines.some(l => l.startTime !== undefined) && (
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute top-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-white/5 backdrop-blur-md rounded-full px-4 py-2 border border-white/10"
        >
          <button 
            onClick={() => adjustSync(-0.01)} 
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-white/40 hover:text-white"
            title="Lyrics earlier (-0.01s)"
          >
            <span className="text-[10px] font-bold">-0.01</span>
          </button>
          <button 
            onClick={() => adjustSync(-0.05)} 
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-white/60 hover:text-white"
            title="Lyrics earlier (-0.05s)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <div className="flex flex-col items-center min-w-[80px]">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sync Audio</span>
            <button 
              onClick={() => setSyncOffset(0)}
              className={`text-sm font-mono font-bold hover:scale-110 transition-transform ${syncOffset === 0 ? 'text-zinc-400' : syncOffset > 0 ? 'text-primary' : 'text-red-400'}`}
              title="Reset offset to 0.00s"
            >
              {syncOffset > 0 ? '+' : ''}{syncOffset.toFixed(2)}s
            </button>
          </div>
          <button 
            onClick={() => adjustSync(0.05)} 
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-white/60 hover:text-white"
            title="Lyrics later (+0.05s)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
          </button>
          <button 
            onClick={() => adjustSync(0.01)} 
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-white/40 hover:text-white"
            title="Lyrics later (+0.01s)"
          >
            <span className="text-[10px] font-bold">+0.01</span>
          </button>
        </motion.div>
      )}

      {/* Close Button */}
      <motion.button 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        onClick={onClose} 
        className="absolute top-6 right-6 z-20 w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-colors border border-white/10"
        aria-label="Close Karaoke Mode"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </motion.button>

      {/* Manual Navigation Controls */}
      <motion.div 
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="absolute bottom-10 left-6 z-20 flex flex-col space-y-3"
      >
          <button
              onClick={handlePrev}
              disabled={currentLineIndex === 0}
              className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 active:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 shadow-lg group relative"
              title="Previous line"
          >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
              <span className="absolute left-full ml-4 px-2 py-1 bg-black/80 rounded text-[10px] opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">Back</span>
          </button>
          
          <button
              onClick={toggleAutoScroll}
              className={`w-14 h-14 rounded-full backdrop-blur-md flex items-center justify-center transition-all border shadow-lg group relative ${isAutoScrollEnabled ? 'bg-primary border-primary text-black' : 'bg-white/10 border-white/10 text-white'}`}
              title={isAutoScrollEnabled ? "Auto-sync ON" : "Auto-sync OFF"}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <span className="absolute left-full ml-4 px-2 py-1 bg-black/80 rounded text-[10px] opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">{isAutoScrollEnabled ? 'Sync Logic ON' : 'Sync Logic OFF'}</span>
          </button>

          <button
              onClick={() => setIsRecordMode(!isRecordMode)}
              className={`w-14 h-14 rounded-full backdrop-blur-md flex items-center justify-center transition-all border shadow-lg group relative ${isRecordMode ? 'bg-red-500 border-red-500 text-white animate-pulse' : 'bg-white/10 border-white/10 text-white'}`}
              title={isRecordMode ? "Stop Recording" : "Record Custom Sync"}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            <span className="absolute left-full ml-4 px-2 py-1 bg-black/80 rounded text-[10px] opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">{isRecordMode ? 'STOP RECORDING' : 'RECORD CUSTOM SYNC'}</span>
          </button>

          <button
              onClick={handleNext}
              disabled={currentLineIndex >= lyricLines.length - 1}
              className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 active:bg-white/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed border border-white/10 shadow-lg group relative"
              title="Next line"
          >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              <span className="absolute left-full ml-4 px-2 py-1 bg-black/80 rounded text-[10px] opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">Forward</span>
          </button>
      </motion.div>

      {/* Manual Sync Trigger Button (Visible in record mode) */}
      <AnimatePresence>
        {isRecordMode && (
          <motion.button
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            onClick={captureTiming}
            className="absolute bottom-24 right-1/2 translate-x-1/2 z-40 bg-red-600 hover:bg-red-700 text-white px-12 py-6 rounded-full font-black text-2xl shadow-2xl border-4 border-white transform transition-all active:scale-95 active:bg-red-800"
          >
            TAP TO SYNC NEXT LINE
            <p className="text-[10px] font-bold opacity-70 mt-1 uppercase tracking-widest">or press SPACEBAR</p>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full pt-20 pb-10">
        
        {/* Progress Bar Container */}
        <div className="w-full max-w-2xl px-6 mb-12">
          <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden border border-white/5">
            <motion.div 
              className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary),0.5)]"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ ease: "linear", duration: 0.1 }}
            />
          </div>
          <div className="flex justify-between mt-2 text-[10px] font-mono text-zinc-500 uppercase tracking-widest">
            <span>{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}</span>
            <span>{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-5xl text-center px-4 overflow-hidden relative">
            <AnimatePresence mode="wait">
              <motion.div 
                key={currentLineIndex}
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -40, scale: 0.95 }}
                transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                className="w-full"
              >
                {/* Previous Line */}
                <button 
                  onClick={() => handleLineClick(currentLineIndex - 1)}
                  disabled={!prevLine}
                  className="block w-full text-xl md:text-2xl text-zinc-400 font-bold opacity-30 hover:opacity-100 transition-all duration-300 mb-10 min-h-[2rem] cursor-pointer focus:outline-none"
                >
                  {prevLine ? prevLine.text : ''}
                </button>

                {/* Current Line */}
                <div className="relative inline-block py-4">
                  {currentTime + syncOffset < (currentLine?.startTime || 0) - 2 ? (
                    <div className="flex flex-col items-center gap-4">
                       <span className="text-xl font-bold text-primary uppercase tracking-[0.4em] animate-pulse">Instrumental Break</span>
                       <div className="flex gap-2">
                         <div className="w-2 h-2 rounded-full bg-primary/20"></div>
                         <div className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:0.2s]"></div>
                         <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0.4s]"></div>
                       </div>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter leading-tight text-white/20 px-4 relative overflow-hidden">
                        {currentLine?.text || "..."}
                        {/* Fill effect */}
                        <motion.span 
                          style={{ width: `${lineProgress}%` }}
                          className="absolute top-0 left-0 h-full text-white px-4 overflow-hidden whitespace-nowrap drop-shadow-[0_0_20px_rgba(var(--primary),0.5)] border-r-2 border-primary"
                        >
                          {currentLine?.text || "..."}
                        </motion.span>
                      </h2>
                      <motion.div 
                        layoutId="active-underline"
                        className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent"
                      />
                    </>
                  )}
                </div>

                {/* Next Line */}
                <button 
                  onClick={() => handleLineClick(currentLineIndex + 1)}
                  disabled={!nextLine}
                  className="block w-full mt-10 text-xl md:text-2xl text-zinc-400 font-bold opacity-50 hover:opacity-100 transition-all duration-300 min-h-[2rem] cursor-pointer focus:outline-none group relative overflow-hidden"
                >
                  <span className="relative z-10">{nextLine ? nextLine.text : ''}</span>
                  {/* Lead-in bar */}
                  {nextLineLeadIn > 0 && (
                    <motion.div 
                      className="absolute bottom-0 left-0 h-0.5 bg-primary/40 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${nextLineLeadIn}%` }}
                      transition={{ ease: "linear", duration: 0.1 }}
                    />
                  )}
                  {nextLineLeadIn > 0 && (
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] text-primary font-black uppercase tracking-[0.3em] animate-pulse">
                      Ready
                    </span>
                  )}
                </button>
              </motion.div>
            </AnimatePresence>
            
            {/* Sync Status Badge */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-16 flex flex-col items-center gap-2"
            >
              {isSyncing ? (
                <div className="px-4 py-1.5 rounded-full bg-primary/20 border border-primary text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                  AI is Synchronizing...
                </div>
              ) : !lyricLines.some(l => l.startTime !== undefined) ? (
                <div className="px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">
                  Static Mode: No Timestamps
                </div>
              ) : isRecordMode ? (
                <div className="px-4 py-1.5 rounded-full bg-red-500/20 border border-red-500 text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                  Recording Custom Sync...
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all duration-500 border shadow-sm flex items-center gap-2 ${isAutoScrollEnabled ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-red-500/10 border border-red-500/20 text-red-500'}`}>
                    {isAutoScrollEnabled ? (
                      <>
                        <span className="w-1 h-1 rounded-full bg-primary animate-pulse"></span>
                        {data.metadata?.syncSource ? `${data.metadata.syncSource} Sync` : 'AI Optimized Sync'}
                      </>
                    ) : 'Sync Paused'}
                  </div>
                  {isAutoScrollEnabled && data.metadata?.syncConfidence && (
                    <div className="flex items-center gap-1.5 opacity-40">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                           <div 
                             key={i} 
                             className={`w-1.5 h-1 rounded-full ${i/5 <= (data.metadata?.syncConfidence || 0) ? 'bg-primary' : 'bg-white/20'}`}
                           ></div>
                        ))}
                      </div>
                      <span className="text-[8px] font-black uppercase tracking-tighter">Confidence</span>
                    </div>
                  )}
                </div>
              )}
              {isRecordMode && (
                <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  Line {currentLineIndex + 1} of {lyricLines.length}
                </span>
              )}
            </motion.div>
        </div>

        {/* YouTube Player Wrapper */}
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-[180px] md:max-w-xs aspect-video rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10 mt-auto group relative transition-transform hover:scale-105 duration-500"
        >
          <YouTube 
            videoId={data.metadata?.youtubeId}
            opts={videoOptions}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
            className="w-full h-full"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <span className="text-[10px] font-bold uppercase tracking-widest bg-black/60 px-3 py-1.5 rounded border border-white/10 backdrop-blur-md">Official Video</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
