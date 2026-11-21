
import React from 'react';

export const SONG_POOL = [
  // Global Pop / Rock
  "Bohemian Rhapsody - Queen",
  "Blinding Lights - The Weeknd",
  "Hotel California - Eagles",
  "Vampire - Olivia Rodrigo",
  "Someone Like You - Adele",
  "Lose Yourself - Eminem",
  "Shape of You - Ed Sheeran",
  "Smells Like Teen Spirit - Nirvana",
  "Billie Jean - Michael Jackson",
  "Rolling in the Deep - Adele",
  "Stairway to Heaven - Led Zeppelin",
  "Imagine - John Lennon",
  "Hallelujah - Leonard Cohen",
  "Sweet Child O' Mine - Guns N' Roses",
  "Hey Jude - The Beatles",
  "Thriller - Michael Jackson",
  "Like a Rolling Stone - Bob Dylan",
  "Purple Rain - Prince",
  "Wonderwall - Oasis",
  "Uptown Funk - Mark Ronson",
  "Bad Guy - Billie Eilish",
  "Thinking Out Loud - Ed Sheeran",
  "Perfect - Ed Sheeran",
  "Despacito - Luis Fonsi",
  "Believer - Imagine Dragons",
  "Thunder - Imagine Dragons",
  "Radioactive - Imagine Dragons",
  "Shallow - Lady Gaga & Bradley Cooper",
  "Hello - Adele",
  "Love Story - Taylor Swift",
  "Shake It Off - Taylor Swift",
  "Blank Space - Taylor Swift",
  "Anti-Hero - Taylor Swift",
  "Flowers - Miley Cyrus",
  "As It Was - Harry Styles",
  "Stay - The Kid LAROI & Justin Bieber",
  "Heat Waves - Glass Animals",
  "Levitating - Dua Lipa",
  "Peaches - Justin Bieber",
  "Driver's License - Olivia Rodrigo",
  "Good 4 U - Olivia Rodrigo",
  "Montero (Call Me By Your Name) - Lil Nas X",
  "Industry Baby - Lil Nas X",
  "Kiss Me More - Doja Cat",
  "Positions - Ariana Grande",
  "34+35 - Ariana Grande",
  "Save Your Tears - The Weeknd",
  "Beggin' - Måneskin",
  "I Wanna Be Your Slave - Måneskin",
  
  // K-Pop
  "Butter - BTS",
  "Dynamite - BTS",
  "Permission to Dance - BTS",
  "Boy With Luv - BTS",
  "How You Like That - Blackpink",
  "Kill This Love - Blackpink",
  "Money - Lisa",
  "Gangnam Style - PSY",
  "Cupid - Fifty Fifty",

  // Latin / Reggaeton
  "Dakiti - Bad Bunny & Jhay Cortez",
  "Yonaguni - Bad Bunny",
  "Todo De Ti - Rauw Alejandro",
  "Pepas - Farruko",
  "In Da Getto - J Balvin & Skrillex",
  "Gasolina - Daddy Yankee",
  "Hips Don't Lie - Shakira",

  // Indian (Tamil, Hindi, etc) - For Regional Difficulty
  "Why This Kolaveri Di - Anirudh Ravichander",
  "Vaathi Coming - Anirudh Ravichander",
  "Arabic Kuthu - Anirudh Ravichander",
  "Tum Hi Ho - Arijit Singh",
  "Chaiyya Chaiyya - A.R. Rahman",
  "Jai Ho - A.R. Rahman",
  "Naatu Naatu - M.M. Keeravani",
  "Rowdy Baby - Yuvan Shankar Raja",
  "Enjoy Enjaami - Dhee & Arivu",
  "Butta Bomma - Armaan Malik",
  "Srivalli - Sid Sriram",
  "Kesariya - Arijit Singh",
  "Apna Bana Le - Arijit Singh",
  "Verithanam - A.R. Rahman",
  "Aalaporan Thamizhan - A.R. Rahman",
  "Ullathil Nalla Ullam - Kannadasan",
  "Vaseegara - Harris Jayaraj",
  "New York Nagaram - A.R. Rahman",
  "Oo Antava - Indravathi Chauhan",
  "Ranjithame - Thaman S"
];

export const getRandomSongs = (customPool: string[] = []): string[] => {
  // Validate customPool input
  const validCustomPool = Array.isArray(customPool) ? customPool : [];

  // If we have personalized recommendations, prioritize them
  if (validCustomPool.length > 0) {
    // Shuffle the custom pool
    const shuffledCustom = [...validCustomPool].sort(() => 0.5 - Math.random());
    // Shuffle the default pool
    const shuffledDefault = [...SONG_POOL].sort(() => 0.5 - Math.random());
    
    // Strategy: Pick up to 6 songs from custom history to keep it fresh but relevant
    // Fill the remaining spots (up to 8 total) with default popular songs
    const fromCustom = shuffledCustom.slice(0, 6);
    const needed = 8 - fromCustom.length;
    const fromDefault = shuffledDefault.slice(0, needed);
    
    // Combine and shuffle again so the order isn't predictable
    return [...fromCustom, ...fromDefault].sort(() => 0.5 - Math.random());
  }

  // Fallback to purely random default songs
  const shuffled = [...SONG_POOL].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 8);
};

interface SongSuggestionsProps {
  songs: string[];
  onSelect: (query: string) => void;
  variant?: 'grid' | 'pill-scroll';
}

export const SongSuggestions: React.FC<SongSuggestionsProps> = ({ songs, onSelect, variant = 'grid' }) => {
  // Defensive check for songs prop
  if (!songs || !Array.isArray(songs)) return null;

  if (variant === 'pill-scroll') {
      return (
        <div className="w-full overflow-x-auto pb-4 px-4 no-scrollbar flex justify-center">
            <div className="flex flex-wrap justify-center gap-2">
                 {songs.slice(0, 6).map((song, index) => { // Limit to 6 pills for cleaner look
                     if (!song) return null;
                     const title = song.split(' - ')[0];
                     return (
                         <button
                            key={`${song}-${index}`}
                            onClick={() => onSelect(song)}
                            className="px-4 py-2 rounded-full bg-white/40 dark:bg-black/40 backdrop-blur-md border border-white/20 dark:border-white/10 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all shadow-sm hover:text-primary dark:hover:text-primary animate-fade-in"
                            style={{ animationDelay: `${index * 50}ms` }}
                         >
                             {title}
                         </button>
                     )
                 })}
            </div>
        </div>
      );
  }

  return (
    <div className="w-full mt-8 mb-12 px-4">
      <h3 className="text-zinc-500 text-xs font-bold uppercase tracking-widest mb-6 flex items-center justify-center gap-2 opacity-80 animate-fade-in">
        <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
        </svg>
        {songs.some(s => !SONG_POOL.includes(s)) ? 'Recommended For You' : 'Trending Now'}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {songs.map((song, index) => {
          if (!song) return null; // Skip invalid entries
          const parts = song.split(' - ');
          const title = parts[0];
          const artist = parts.length > 1 ? parts.slice(1).join(' - ') : '';
          
          return (
            <button
              key={`${song}-${index}`}
              onClick={() => onSelect(song)}
              className="group relative p-4 bg-white/[var(--bg-opacity)] dark:bg-surface/[var(--bg-opacity)] backdrop-blur-[var(--blur)] border border-zinc-200 dark:border-white/5 hover:border-primary/30 text-left transition-all duration-500 ease-liquid hover:bg-white dark:hover:bg-white/5 hover:scale-[1.03] active:scale-98 hover:shadow-lg hover:shadow-primary/5 overflow-hidden animate-fade-in cursor-pointer"
              style={{ 
                animationDelay: `${index * 100}ms`,
                animationFillMode: 'both',
                borderRadius: 'var(--radius)'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <div className="text-zinc-800 dark:text-zinc-100 font-semibold text-sm truncate group-hover:text-primary transition-all duration-300 group-hover:drop-shadow-[0_0_8px_rgba(var(--color-primary),0.4)]">
                  {title}
                </div>
                {artist && (
                  <div className="text-zinc-500 text-xs mt-1 truncate group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                    {artist}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
