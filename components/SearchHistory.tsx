
import React from 'react';

interface SearchHistoryProps {
  history: string[];
  onSelect: (query: string) => void;
  onClear: () => void;
  compact?: boolean;
}

export const SearchHistory: React.FC<SearchHistoryProps> = ({ history, onSelect, onClear, compact = false }) => {
  if (history.length === 0) return null;

  if (compact) {
    return (
      <div className="w-full max-w-4xl mb-3 pointer-events-auto transition-all duration-500 ease-out animate-slide-up-fade overflow-x-auto no-scrollbar px-4">
          <div className="flex flex-nowrap items-center justify-center gap-2 min-w-max mx-auto">
             <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mr-2">Recent</span>
             {history.map((query, index) => (
               <button
                 key={`${query}-${index}`}
                 onClick={() => onSelect(query)}
                 className="group flex items-center gap-2 px-3 py-1.5 bg-white/40 dark:bg-black/40 backdrop-blur-md border border-zinc-200/50 dark:border-white/10 rounded-full hover:bg-white dark:hover:bg-white/10 hover:border-primary/30 transition-all active:scale-95"
               >
                 <svg className="w-3 h-3 text-zinc-400 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                 <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[120px]">{query}</span>
               </button>
             ))}
             <button 
                onClick={onClear} 
                className="w-6 h-6 rounded-full flex items-center justify-center bg-zinc-200/50 dark:bg-white/5 hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-colors ml-1"
                title="Clear History"
             >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
             </button>
          </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl animate-fade-in px-4 mt-8">
      <div className="flex justify-between items-end mb-4 border-b border-zinc-200 dark:border-white/10 pb-2">
        <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          Recent Searches
        </h3>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="text-[10px] font-bold text-zinc-500 hover:text-red-500 dark:text-zinc-600 dark:hover:text-red-400 transition-colors uppercase tracking-wider bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 px-2 py-1"
          style={{ borderRadius: 'var(--radius-sm)' }}
        >
          Clear History
        </button>
      </div>
      <div className="flex flex-wrap gap-3">
        {history.map((query, index) => (
          <button
            key={`${query}-${index}`}
            onClick={() => onSelect(query)}
            className="group flex items-center gap-2 px-4 py-2 bg-white/[var(--bg-opacity)] dark:bg-surface/[var(--bg-opacity)] backdrop-blur-[var(--blur)] hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-white/5 hover:border-primary/30 transition-all duration-500 ease-silky text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:scale-105 active:scale-95 shadow-sm"
            style={{ borderRadius: 'var(--radius)' }}
          >
            <span className="truncate max-w-[200px] text-sm font-medium">{query}</span>
            <svg className="w-3 h-3 text-zinc-400 group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100 -mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
};
