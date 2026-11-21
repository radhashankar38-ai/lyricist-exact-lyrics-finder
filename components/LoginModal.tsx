
import React, { useState } from 'react';
import { User, FeedbackType } from '../types';
import { supabase } from '../services/supabaseClient';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: User) => void;
  triggerFeedback: (type: FeedbackType) => void;
  blocking?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLogin, triggerFeedback, blocking = false }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGuestLogin = () => {
      triggerFeedback('tap');
      const guestUser: User = {
          id: 'guest-' + Date.now(),
          username: 'Guest',
          email: undefined,
          avatarColor: '#71717a', 
          joinedDate: new Date().toLocaleDateString(),
          provider: 'local'
      };
      onLogin(guestUser);
      if (!blocking) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSuccessMessage(null);

    if (!email || !password) {
      triggerFeedback('error');
      setAuthError("Email and Password are required.");
      return;
    }

    setIsAuthenticating(true);
    triggerFeedback('tap');

    try {
        let error, data;
        if (isRegister) {
            const res = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { username: username || email.split('@')[0], avatar_color: `hsl(${Math.random() * 360}, 70%, 60%)` }
                }
            });
            error = res.error;
            data = res.data;
        } else {
            const res = await supabase.auth.signInWithPassword({
                email,
                password
            });
            error = res.error;
            data = res.data;
        }

        if (error) {
            if (error.message.includes("Invalid login credentials")) {
                throw new Error("Incorrect email or password.");
            }
            if (error.message.includes("User already registered")) {
                throw new Error("Account exists. Please sign in.");
            }
            throw error;
        }

        // Handle Sign Up with Email Confirmation
        if (isRegister && data.user && !data.session) {
            setSuccessMessage("Account created! Check your email to confirm.");
            triggerFeedback('success');
            setIsAuthenticating(false);
            return;
        }

        // Handle Successful Login / Auto-Login after Signup (if no confirm needed)
        if (data.user && data.session) {
            const userMetadata = data.user.user_metadata || {};
            const newUser: User = {
                id: data.user.id,
                username: userMetadata.username || email.split('@')[0],
                email: email,
                avatarColor: userMetadata.avatar_color || `hsl(${Math.random() * 360}, 70%, 60%)`,
                joinedDate: new Date(data.user.created_at).toLocaleDateString(),
                provider: 'supabase'
            };

            triggerFeedback('success');
            onLogin(newUser);
            if (!blocking) onClose();
        } 

    } catch (err: any) {
        console.error("Auth Error:", err);
        triggerFeedback('error');
        setAuthError(err.message || "Authentication failed.");
    } finally {
        setIsAuthenticating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* Ambient Backlights to enhance Glass Effect */}
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden">
           <div className="w-[80vw] h-[80vw] md:w-[600px] md:h-[600px] bg-blue-600/20 rounded-full blur-[120px] absolute -top-[10%] -left-[10%] animate-pulse-slow"></div>
           <div className="w-[80vw] h-[80vw] md:w-[600px] md:h-[600px] bg-purple-600/20 rounded-full blur-[120px] absolute -bottom-[10%] -right-[10%] animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xl animate-fade-in z-10"
        onClick={blocking ? undefined : onClose}
      />

      <div className="relative z-20 w-full max-w-[420px] animate-zoom-in">
        {blocking && (
           <div className="mb-10 flex flex-col items-center animate-slide-up">
                <h1 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60 mb-2 drop-shadow-2xl" style={{ fontFamily: 'Space Grotesk' }}>Lyricist</h1>
           </div>
        )}
        
        {/* Glass Card */}
        <div className={`
          relative overflow-hidden
          bg-white/5 backdrop-blur-2xl
          border border-white/20
          shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5),inset_0_0_20px_rgba(255,255,255,0.05)]
          rounded-[2.5rem] p-8 md:p-10
        `}>
          {/* Shine effect */}
          <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none rotate-12"></div>

          <div className="relative z-10 flex flex-col items-center">
            
            <header className="text-center mb-10 w-full">
              <h2 className="text-3xl font-bold text-white tracking-tight mb-2 drop-shadow-md" style={{ fontFamily: 'Space Grotesk' }}>
                {isRegister ? 'Join us' : 'Welcome back'}
              </h2>
              <p className="text-white/60 text-sm font-medium">
                {isRegister ? 'Create an account to sync your library.' : 'Enter your credentials to continue.'}
              </p>
            </header>

            {isAuthenticating ? (
              <div className="w-full py-12 flex flex-col items-center justify-center space-y-4 animate-fade-in">
                <div className="w-14 h-14 rounded-full border-4 border-white/10 border-t-lime-accent animate-spin" />
                <p className="text-sm font-bold text-white/50 tracking-widest uppercase">Verifying</p>
              </div>
            ) : (
              <div className="w-full space-y-6 animate-fade-in">
                {authError && (
                    <div className="p-3 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-200 text-xs font-bold text-center backdrop-blur-sm">
                        {authError}
                    </div>
                )}
                {successMessage && (
                    <div className="p-3 rounded-2xl bg-green-500/20 border border-green-500/30 text-green-200 text-xs font-bold text-center backdrop-blur-sm">
                        {successMessage}
                    </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  {isRegister && (
                    <div className="group relative">
                        <input 
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-6 py-4 bg-black/30 border border-white/10 rounded-2xl focus:outline-none focus:border-white/30 focus:bg-black/40 text-white transition-all text-sm font-bold placeholder-white/30"
                        placeholder="Username"
                        required
                        />
                    </div>
                  )}
                  <div className="group relative">
                    <input 
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-6 py-4 bg-black/30 border border-white/10 rounded-2xl focus:outline-none focus:border-white/30 focus:bg-black/40 text-white transition-all text-sm font-bold placeholder-white/30"
                        placeholder="Email"
                        required
                    />
                  </div>
                  <div className="group relative">
                    <input 
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-6 py-4 bg-black/30 border border-white/10 rounded-2xl focus:outline-none focus:border-white/30 focus:bg-black/40 text-white transition-all text-sm font-bold placeholder-white/30"
                        placeholder="Password"
                        required
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-4 mt-2 rounded-[1.2rem] font-bold text-black bg-gradient-to-r from-lime-accent to-lime-300 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 text-base shadow-[0_0_20px_rgba(204,255,0,0.3)]"
                  >
                    {isRegister ? 'Create Account' : 'Sign In'}
                  </button>
                </form>
                
                <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-white/10"></div>
                    <span className="flex-shrink-0 mx-4 text-white/30 text-xs font-bold uppercase tracking-wider">Or</span>
                    <div className="flex-grow border-t border-white/10"></div>
                </div>

                <button 
                    onClick={handleGuestLogin}
                    className="w-full py-4 rounded-[1.2rem] font-bold text-white bg-white/5 hover:bg-white/10 transition-all text-sm uppercase tracking-wide border border-white/10 hover:border-white/20"
                >
                    Continue as Guest
                </button>
              </div>
            )}

            <footer className="mt-8 text-center">
              {!isAuthenticating && (
                <button 
                  onClick={() => { setIsRegister(!isRegister); setAuthError(null); setSuccessMessage(null); triggerFeedback('light'); }}
                  className="text-xs text-white/50 hover:text-lime-accent transition-colors font-bold tracking-wide"
                >
                  {isRegister ? 'Already have an account? Log In' : "Don't have an account? Register"}
                </button>
              )}
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
};
