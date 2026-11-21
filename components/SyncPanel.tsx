import React, { useState, useEffect, useRef } from 'react';
import { SyncStatus, SyncState } from '../types';
import { io, Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';

interface SyncPanelProps {
  onSyncStateChange: (state: Partial<SyncState>) => void;
  syncState: SyncState;
  triggerFeedback?: (type: any) => void;
  choirs?: { name: string; code: string }[];
  onSaveChoir?: (name: string, code: string) => void;
}

export const SyncPanel: React.FC<SyncPanelProps> = ({ 
  onSyncStateChange, syncState, triggerFeedback, choirs = [], onSaveChoir 
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [inputCode, setInputCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [choirName, setChoirName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isWakeLockActive, setIsWakeLockActive] = useState(false);
  const wakeLockRef = useRef<any>(null);

  useEffect(() => {
    const newSocket = io(window.location.origin, {
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    setSocket(newSocket);

    newSocket.on('room-created', ({ code }) => {
      onSyncStateChange({ roomCode: code, status: 'host' });
      setIsConnecting(false);
      triggerFeedback?.('success');
    });

    newSocket.on('room-joined', ({ code, state }) => {
      onSyncStateChange({ roomCode: code, status: 'guest', ...state });
      setIsConnecting(false);
      triggerFeedback?.('success');
      
      // Punt feature: Auto-snap to current line if we were behind
      if (state.currentStanzaIndex !== undefined && state.currentLineIndex !== undefined) {
        window.dispatchEvent(new CustomEvent('remote-sync-event', { 
          detail: { type: 'scroll', payload: { stanzaIdx: state.currentStanzaIndex, lineIdx: state.currentLineIndex } } 
        }));
      }
    });

    newSocket.on('room-stats', ({ count }) => {
      onSyncStateChange({ participantCount: count });
    });

    newSocket.on('sync-update', (event) => {
      // Handle incoming sync events from host
      if (syncState.status === 'guest') {
        window.dispatchEvent(new CustomEvent('remote-sync-event', { detail: event }));
      }
    });

    newSocket.on('room-closed', () => {
      onSyncStateChange({ roomCode: null, status: 'idle' });
      triggerFeedback?.('error');
      setError('Room closed by host');
    });

    newSocket.on('error', ({ message }) => {
      setError(message);
      setIsConnecting(false);
      triggerFeedback?.('error');
    });

    // Handle deep linking
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl && syncState.status === 'idle') {
      newSocket.emit('join-room', { code: roomFromUrl });
    }

    return () => {
      newSocket.close();
      if (wakeLockRef.current) wakeLockRef.current.release();
    };
  }, []);

  // QR Scanner Logic
  useEffect(() => {
    if (isScanning) {
      const scanner = new Html5QrcodeScanner("qr-reader", { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      }, false);
      
      scanner.render((decodedText) => {
        try {
          const url = new URL(decodedText);
          const code = url.searchParams.get('room');
          if (code) {
            socket?.emit('join-room', { code: code.toUpperCase() });
            setIsScanning(false);
            scanner.clear();
          }
        } catch (e) {
          // If not a URL, try as raw code
          if (decodedText.length === 4) {
            socket?.emit('join-room', { code: decodedText.toUpperCase() });
            setIsScanning(false);
            scanner.clear();
          }
        }
      }, (error) => {
        // Silent
      });

      return () => {
        scanner.clear().catch(console.error);
      };
    }
  }, [isScanning, socket]);

  const toggleWakeLock = async () => {
    if (!isWakeLockActive) {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
          setIsWakeLockActive(true);
          triggerFeedback?.('success');
        }
      } catch (err) {
        console.error("Wake Lock failed:", err);
      }
    } else {
      if (wakeLockRef.current) {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        setIsWakeLockActive(false);
        triggerFeedback?.('toggle');
      }
    }
  };

  // Listen for local events to send to server if host
  useEffect(() => {
    if (syncState.status === 'host' && socket && syncState.roomCode) {
      const handleLocalEvent = (e: any) => {
        socket.emit('sync-event', {
          code: syncState.roomCode,
          event: e.detail
        });
      };
      window.addEventListener('local-sync-event', handleLocalEvent);
      return () => window.removeEventListener('local-sync-event', handleLocalEvent);
    }
  }, [syncState.status, socket, syncState.roomCode]);

  const handleCreateRoom = () => {
    if (!socket) return;
    setIsConnecting(true);
    socket.emit('create-room', {
      songTitle: syncState.songTitle,
      artist: syncState.artist,
      lyrics: syncState.lyrics,
      isFocusMode: syncState.isFocusMode,
      currentStanzaIndex: syncState.currentStanzaIndex,
      currentLineIndex: syncState.currentLineIndex
    });
  };

  const handleJoinRoom = () => {
    if (!socket || !inputCode) return;
    setIsConnecting(true);
    socket.emit('join-room', { code: inputCode.toUpperCase() });
  };

  const handleLeaveRoom = () => {
    onSyncStateChange({ roomCode: null, status: 'idle' });
    socket?.emit('leave-room');
    // Remove room from URL
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.toString());
  };

  const copyLink = () => {
    const link = `${window.location.origin}?room=${syncState.roomCode}`;
    navigator.clipboard.writeText(link);
    triggerFeedback?.('success');
  };

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
          Chorus Sync
        </h2>
        {syncState.status !== 'idle' && (
          <button 
            onClick={handleLeaveRoom}
            className="text-xs font-bold text-red-500 hover:bg-red-500/10 px-3 py-1 rounded-full transition-colors"
          >
            Leave
          </button>
        )}
      </div>

      {syncState.status === 'idle' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={handleCreateRoom}
              disabled={isConnecting}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
              </div>
              <span className="text-xs font-bold text-primary">Host Session</span>
            </button>
            <button 
              onClick={() => setIsScanning(true)}
              className="flex flex-col items-center justify-center p-4 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 hover:bg-zinc-200 dark:hover:bg-white/10 transition-all group"
            >
              <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-white/10 text-zinc-600 dark:text-zinc-400 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h3m-3-3h-3m10 5V8a2 2 0 00-2-2h-5M6 7l3 3m0 0l-3 3m3-3H3" /></svg>
              </div>
              <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Scan to Sing</span>
            </button>
          </div>

          {isScanning && (
            <div className="fixed inset-0 z-[110] bg-black flex flex-col items-center justify-center p-6 animate-fade-in">
              <div className="w-full max-w-md aspect-square bg-zinc-900 rounded-3xl overflow-hidden relative border-2 border-primary/50 shadow-[0_0_50px_rgba(var(--color-primary),0.3)]">
                <div id="qr-reader" className="w-full h-full"></div>
                <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-primary animate-pulse rounded-2xl"></div>
              </div>
              <p className="mt-8 text-white font-bold text-center">Point camera at Host's QR Code</p>
              <button 
                onClick={() => setIsScanning(false)}
                className="mt-12 px-8 py-4 bg-white/10 text-white rounded-full font-black hover:bg-white/20 transition-all"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-200 dark:border-white/5"></div></div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-black text-zinc-400 bg-transparent px-2">Or enter code</div>
          </div>

          <div className="flex flex-col gap-2">
            <input 
              type="text" 
              placeholder="4-Letter Code"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase().slice(0, 4))}
              className="w-full p-3 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-center font-black tracking-widest text-lg focus:ring-2 focus:ring-primary outline-none"
            />
            <button 
              onClick={handleJoinRoom}
              disabled={isConnecting || inputCode.length < 4}
              className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black font-bold text-xs disabled:opacity-50 transition-opacity"
            >
              Join Room
            </button>
          </div>
          {error && <p className="text-xs text-red-500 text-center font-medium">{error}</p>}
          
          {/* Saved Choirs */}
          {choirs.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Your Choirs</h3>
              <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto pr-1">
                {choirs.map((choir, idx) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      setInputCode(choir.code);
                      socket?.emit('join-room', { code: choir.code });
                    }}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 hover:border-primary/30 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {choir.name[0].toUpperCase()}
                      </div>
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200 group-hover:text-primary transition-colors">{choir.name}</span>
                    </div>
                    <span className="text-[10px] font-black text-zinc-400 tracking-widest">{choir.code}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-[10px] text-zinc-500 text-center uppercase tracking-widest font-bold opacity-60">
            Sync lyrics with friends in real-time
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-6 items-center">
            {/* QR Code Section */}
            {syncState.status === 'host' && (
              <div className="p-4 bg-white rounded-3xl shadow-xl border border-zinc-100 shrink-0 animate-zoom-in">
                <QRCodeSVG 
                  value={`${window.location.origin}?room=${syncState.roomCode}`}
                  size={140}
                  level="H"
                  includeMargin={false}
                />
              </div>
            )}

            <div className="flex-1 w-full space-y-4">
              <div className="p-4 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 flex flex-col items-center relative group">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Room Code</span>
                <div className="text-4xl font-black text-primary tracking-[0.1em]">{syncState.roomCode}</div>
                
                {syncState.status === 'host' && !choirs.find(c => c.code === syncState.roomCode) && (
                  <button 
                    onClick={() => setShowSaveDialog(true)}
                    className="absolute top-2 right-2 p-2 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-all opacity-0 group-hover:opacity-100"
                    title="Save as Recurring Choir"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    {[...Array(Math.min(3, syncState.participantCount || 1))].map((_, i) => (
                      <div key={i} className="w-6 h-6 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-200 dark:bg-white/10 flex items-center justify-center text-[8px] font-bold">
                        {String.fromCharCode(65 + i)}
                      </div>
                    ))}
                  </div>
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    {syncState.participantCount || 1} Singers Synced
                  </span>
                </div>
                
                <button 
                  onClick={toggleWakeLock}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${isWakeLockActive ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-zinc-100 dark:bg-white/5 border-zinc-200 dark:border-white/10 text-zinc-500'}`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  <span className="text-[9px] font-black uppercase tracking-widest">{isWakeLockActive ? 'Awake' : 'Sleep'}</span>
                </button>
              </div>
            </div>
          </div>

          {showSaveDialog && (
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 animate-zoom-in">
              <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">Name your Choir</p>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={choirName}
                  onChange={(e) => setChoirName(e.target.value)}
                  placeholder="e.g. Sunday Morning"
                  className="flex-1 p-2 rounded-lg bg-white dark:bg-zinc-900 border border-primary/20 text-xs font-bold outline-none"
                />
                <button 
                  onClick={() => {
                    if (choirName && syncState.roomCode) {
                      onSaveChoir?.(choirName, syncState.roomCode);
                      setShowSaveDialog(false);
                      setChoirName('');
                      triggerFeedback?.('success');
                    }
                  }}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={copyLink}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 text-xs font-bold hover:bg-zinc-200 dark:hover:bg-white/10 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
              Copy Link
            </button>
            <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
              {syncState.status === 'host' ? 'Hosting' : 'Joined'}
            </div>
          </div>

          {syncState.status === 'host' && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 leading-tight">
                You are the leader. Your scrolls and song changes will sync to all guests.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
