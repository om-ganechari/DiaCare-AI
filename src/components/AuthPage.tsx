import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  updateProfile 
} from 'firebase/auth';
import { auth, signInWithGoogle } from '../firebase';
import { translations } from '../data';
import { Language } from '../types';
import { 
  Shield, Mail, Lock, User, Eye, EyeOff, ArrowRight, 
  CheckCircle, AlertTriangle, KeyRound, LogIn 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthPageProps {
  currentLang: Language;
  onSuccess: () => void;
  onBackToLanding: () => void;
}

type AuthMode = 'login' | 'signup' | 'forgot';

export default function AuthPage({ currentLang, onSuccess, onBackToLanding }: AuthPageProps) {
  const t = translations[currentLang];
  const [mode, setMode] = useState<AuthMode>('login');

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI helpers
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError('');
    setSuccessMsg('');
  };

  const handleModeChange = (newMode: AuthMode) => {
    setMode(newMode);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    // Basic Validations
    if (!email) {
      setError('Email address is required.');
      setIsLoading(false);
      return;
    }

    if (mode !== 'forgot' && !password) {
      setError('Password is required.');
      setIsLoading(false);
      return;
    }

    try {
      if (mode === 'signup') {
        if (!name) {
          setError('Full name is required.');
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setIsLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Password must be at least 6 characters long.');
          setIsLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        setSuccessMsg('Account created successfully! Preparing dashboard...');
        setTimeout(() => {
          onSuccess();
        }, 1200);

      } else if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        setSuccessMsg('Signed in successfully! Transitioning...');
        setTimeout(() => {
          onSuccess();
        }, 1000);

      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg('Password reset link sent to your email. Please check your inbox.');
      }
    } catch (err: any) {
      console.error('Firebase authentication failure:', err);
      let userFriendlyMessage = err.message;

      if (err.code === 'auth/email-already-in-use') {
        userFriendlyMessage = 'This email is already registered. Try logging in instead.';
      } else if (err.code === 'auth/weak-password') {
        userFriendlyMessage = 'The password is too weak. Choose at least 6 characters.';
      } else if (err.code === 'auth/invalid-email') {
        userFriendlyMessage = 'The email address is badly formatted.';
      } else if (err.code === 'auth/user-not-found') {
        userFriendlyMessage = 'No registered user was found under this email.';
      } else if (err.code === 'auth/wrong-password') {
        userFriendlyMessage = 'Incorrect password. Please verify and try again.';
      } else if (err.code === 'auth/operation-not-allowed') {
        userFriendlyMessage = 'Email/Password authentication provider is not enabled in Firebase. Please toggle it in the console on Spark plan.';
      } else if (err.code === 'auth/invalid-credential') {
        userFriendlyMessage = 'Invalid credentials entered or account doesn\'t exist.';
      }
      setError(userFriendlyMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleClick = async () => {
    setError('');
    setIsLoading(true);
    try {
      await signInWithGoogle();
      onSuccess();
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      setError(err.message || 'Google sign-in attempt was rejected.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="auth-page-container" className="max-w-md mx-auto w-full pt-8 pb-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="bg-slate-900/40 border border-slate-800 rounded-3xl p-8 backdrop-blur-md relative overflow-hidden"
      >
        {/* Absolute dynamic top glowing highlight */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 mb-4 animate-pulse">
            <Shield className="h-6 w-6 text-white" />
          </div>
          
          <h2 className="font-sans font-extrabold text-2xl tracking-normal text-white">
            {mode === 'login' && 'Access DiaCare AI'}
            {mode === 'signup' && 'Create Secure Account'}
            {mode === 'forgot' && 'Reset Password'}
          </h2>
          <p className="font-sans text-xs text-slate-400 mt-1.5 leading-relaxed">
            {mode === 'login' && 'Unlock personalized health screening, report logs & prediction diagnostics.'}
            {mode === 'signup' && 'Register now to securely catalog all clinical assessment histories.'}
            {mode === 'forgot' && 'Provide your registered email to dispatch recovery guidelines.'}
          </p>
        </div>

        {/* Status Messages */}
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 p-3 rounded-xl bg-red-950/30 border border-red-500/25 flex items-start gap-2.5"
            >
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <div className="text-xs text-red-300 font-sans leading-relaxed">
                {error}
                {error.includes('not enabled') && (
                  <p className="mt-1 font-mono text-[10px] text-red-400 leading-snug bg-black/40 p-2 rounded">
                    To enable: Go to Firebase Console &gt; Build &gt; Authentication &gt; Sign-In Method, and toggle on "Email/Password".
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {successMsg && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-5 p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/25 flex items-start gap-2.5"
            >
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <span className="text-xs text-emerald-300 font-sans leading-relaxed">
                {successMsg}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Auth form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-mono font-medium text-cyan-400 uppercase tracking-widest pl-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="e.g. John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all font-sans"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-mono font-medium text-cyan-400 uppercase tracking-widest pl-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                placeholder="e.g. name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all font-sans"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between pl-1">
                  <label className="text-[11px] font-mono font-medium text-cyan-400 uppercase tracking-widest">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => handleModeChange('forgot')}
                      className="text-[10px] font-sans font-semibold text-slate-400 hover:text-cyan-400 transition-colors"
                    >
                      Forgot?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-10 pr-10 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all font-sans"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono font-medium text-cyan-400 uppercase tracking-widest pl-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20 transition-all font-sans"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white py-3.5 px-4 font-sans font-bold text-xs shadow-lg shadow-cyan-500/10 cursor-pointer hover:opacity-95 active:scale-98 transition-all flex items-center justify-center gap-2 mt-2"
          >
            {isLoading ? (
              <div className="h-4 w-4 rounded-full border-2 border-slate-900 border-t-white animate-spin" />
            ) : (
              <>
                <span>
                  {mode === 'login' && 'Sign In'}
                  {mode === 'signup' && 'Register Account'}
                  {mode === 'forgot' && 'Send Reset Instructions'}
                </span>
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Divider separator */}
        <div className="flex items-center gap-3 my-6">
          <div className="h-px bg-slate-800 flex-1" />
          <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">or continue with</span>
          <div className="h-px bg-slate-800 flex-1" />
        </div>

        {/* Google Authentication Segment */}
        <button
          type="button"
          onClick={handleGoogleClick}
          disabled={isLoading}
          className="w-full rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800 hover:border-slate-700 py-3.5 px-4 text-slate-300 font-sans text-xs font-bold font-medium active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <LogIn className="h-4 w-4 text-cyan-400" />
          Google Account
        </button>

        {/* Mode Toggles */}
        <div className="mt-8 text-center border-t border-slate-900 pt-5 flex flex-col gap-2.5">
          {mode === 'login' && (
            <p className="text-xs text-slate-400 font-sans">
              Don't have an account?{' '}
              <button
                onClick={() => handleModeChange('signup')}
                className="text-cyan-400 hover:text-cyan-300 font-bold tracking-normal transition-colors cursor-pointer"
              >
                Sign Up Now
              </button>
            </p>
          )}

          {mode === 'signup' && (
            <p className="text-xs text-slate-400 font-sans">
              Already have an account?{' '}
              <button
                onClick={() => handleModeChange('login')}
                className="text-cyan-400 hover:text-cyan-300 font-bold tracking-normal transition-colors cursor-pointer"
              >
                Log In
              </button>
            </p>
          )}

          {mode === 'forgot' && (
            <p className="text-xs text-slate-400 font-sans">
              Remembered your credentials?{' '}
              <button
                onClick={() => handleModeChange('login')}
                className="text-cyan-400 hover:text-cyan-300 font-bold tracking-normal transition-colors cursor-pointer"
              >
                Back to Sign In
              </button>
            </p>
          )}

          <button
            onClick={onBackToLanding}
            className="text-[11px] font-mono uppercase tracking-widest text-slate-500 hover:text-white transition-colors mt-1 cursor-pointer"
          >
            ← Return to Homepage
          </button>
        </div>

        {/* Console Config Helper Warning */}
        <div className="mt-6 p-2 rounded-lg bg-cyan-950/10 border border-cyan-500/5 text-center">
          <p className="text-[9px] font-mono text-cyan-500/60 leading-normal uppercase tracking-wider">
            HIPAA Zero-Trust Protected Node • TLS 1.3 Encryption Active
          </p>
        </div>
      </motion.div>
    </div>
  );
}
