import { Language } from '../types';
import { translations } from '../data';
import { Activity, Languages, LogIn, LogOut, User as UserIcon } from 'lucide-react';

interface NavbarProps {
  currentLang: Language;
  onLangChange: (lang: Language) => void;
  activeTab: string;
  onActiveTabChange: (tab: string) => void;
  user: any;
  onSignIn: () => void;
  onSignOut: () => void;
}

export default function Navbar({
  currentLang,
  onLangChange,
  activeTab,
  onActiveTabChange,
  user,
  onSignIn,
  onSignOut
}: NavbarProps) {
  const t = translations[currentLang];

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-slate-950/70 border-b border-cyan-500/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={() => onActiveTabChange('landing')}
          >
            <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20">
              <Activity className="h-6 w-6 text-white animate-pulse" />
            </div>
            <div>
              <span className="font-sans font-extrabold text-xl tracking-wide bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
                {t.appName}
              </span>
              <span className="hidden sm:block text-[9px] font-mono text-cyan-400 uppercase tracking-widest leading-none">
                AI Biospheres
              </span>
            </div>
          </div>

          {/* Tab Options */}
          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={() => onActiveTabChange('landing')}
              className={`font-sans text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'landing' 
                  ? 'text-cyan-400 hover:text-cyan-300 border-b-2 border-cyan-400 pb-1' 
                  : 'text-slate-400 hover:text-white pb-1'
              }`}
            >
              {t.navLanding}
            </button>
            <button
              onClick={() => onActiveTabChange('analyze')}
              className={`font-sans text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'analyze' 
                  ? 'text-cyan-400 hover:text-cyan-300 border-b-2 border-cyan-400 pb-1' 
                  : 'text-slate-400 hover:text-white pb-1'
              }`}
            >
              {t.navAnalyze}
            </button>
            <button
              onClick={() => onActiveTabChange('dashboard')}
              className={`font-sans text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'text-cyan-400 hover:text-cyan-300 border-b-2 border-cyan-400 pb-1' 
                  : 'text-slate-400 hover:text-white pb-1'
              }`}
            >
              {t.dashboard}
            </button>
            {user && (
              <button
                onClick={() => onActiveTabChange('profile')}
                className={`font-sans text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'profile'
                    ? 'text-cyan-400 hover:text-cyan-300 border-b-2 border-cyan-400 pb-1' 
                    : 'text-slate-400 hover:text-white pb-1'
                }`}
              >
                Profile & History
              </button>
            )}
          </div>

          {/* Interactive controls (Languages, Profile) */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-900/45 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <Languages className="h-4 w-4 text-cyan-400" />
              <select
                value={currentLang}
                onChange={(e) => onLangChange(e.target.value as Language)}
                className="bg-transparent text-xs font-medium text-slate-300 outline-none cursor-pointer focus:text-white"
              >
                <option value="en" className="bg-slate-950 text-slate-300">ENG</option>
                <option value="hi" className="bg-slate-950 text-slate-300">HIN</option>
                <option value="mr" className="bg-slate-950 text-slate-300">MAR</option>
              </select>
            </div>

            {/* Google Authentication Segment */}
            {user ? (
              <div className="flex items-center gap-2">
                <div 
                  onClick={() => onActiveTabChange('profile')}
                  className="flex items-center gap-2 bg-gradient-to-r from-cyan-950/40 to-blue-950/40 hover:from-cyan-900/50 hover:to-blue-900/50 px-3 py-1.5 rounded-lg border border-cyan-500/20 cursor-pointer transition-colors"
                >
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || "User"} 
                      className="h-4 w-4 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserIcon className="h-4 w-4 text-cyan-400" />
                  )}
                  <span className="hidden sm:inline text-xs font-mono font-medium text-slate-300">
                    {user.displayName || t.anonymousUser}
                  </span>
                </div>
                <button
                  onClick={onSignOut}
                  title="Sign Out"
                  className="p-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 hover:text-red-400 border border-slate-800 transition-colors text-slate-400 cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-white font-sans text-xs font-bold shadow-md shadow-cyan-500/15 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
