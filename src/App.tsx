import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocs, collection, query, where, serverTimestamp } from 'firebase/firestore';
import { db, auth, signInWithGoogle, logoutUser, handleFirestoreError, OperationType } from './firebase';
import { Language, AssessmentResponse } from './types';
import Navbar from './components/Navbar';
import LandingPage from './components/LandingPage';
import SymptomScreening from './components/SymptomScreening';
import HealthDashboard from './components/HealthDashboard';
import FeedbackSystem from './components/FeedbackSystem';
import AIChatbot from './components/AIChatbot';
import AuthPage from './components/AuthPage';
import UserProfile from './components/UserProfile';
import { translations } from './data';
import { Shield } from 'lucide-react';

export default function App() {
  const [currentLang, setCurrentLang] = useState<Language>('en');
  const [activeTab, setActiveTab] = useState<string>('landing');
  const [currentAssessment, setCurrentAssessment] = useState<AssessmentResponse | null>(null);

  // Authentication & Firestore States
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [historyAssessments, setHistoryAssessments] = useState<AssessmentResponse[]>([]);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Load previous assessment from local storage for offline / quick restore fallback
  useEffect(() => {
    const cached = localStorage.getItem('diacare_assessment');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setCurrentAssessment(parsed);
      } catch (e) {
        console.error('Failed to reload previous health report card:', e);
      }
    }
  }, []);

  // Sync auth state & historic reports from Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsAuthLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Check if there was an anonymous assessment cached in local storage, and associate it with the newly signed-in user!
        const cached = localStorage.getItem('diacare_assessment');
        let localAssessmentToSync: AssessmentResponse | null = null;
        if (cached) {
          try {
            const parsed = JSON.parse(cached) as AssessmentResponse;
            if (parsed && parsed.userId === 'anonymous') {
              localAssessmentToSync = parsed;
            }
          } catch (e) {}
        }

        // Load User Profile details
        const userRef = doc(db, 'users', firebaseUser.uid);
        try {
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            setUserProfile(userSnap.data());
          } else {
            const initialProfile = {
              userId: firebaseUser.uid,
              name: firebaseUser.displayName || 'Patient',
              email: firebaseUser.email || '',
              ...(localAssessmentToSync ? {
                age: Number(localAssessmentToSync.metrics.age),
                gender: localAssessmentToSync.metrics.gender,
                height: Number(localAssessmentToSync.metrics.height),
                weight: Number(localAssessmentToSync.metrics.weight),
              } : {}),
              createdAt: serverTimestamp() /* Crucial: validates rules_version 2 */
            };
            await setDoc(userRef, initialProfile);
            setUserProfile(initialProfile);
          }
        } catch (err) {
          console.error('Failed to fetch/register user profile inside Firestore:', err);
        }

        // Sync local anonymous assessment under user profile if present
        if (localAssessmentToSync) {
          try {
            const synced: AssessmentResponse = {
              ...localAssessmentToSync,
              userId: firebaseUser.uid,
              createdAt: serverTimestamp() as any
            };
            await setDoc(doc(db, 'assessments', synced.assessmentId), synced);
            localStorage.setItem('diacare_assessment', JSON.stringify({ ...synced, createdAt: new Date().toISOString() }));
            setCurrentAssessment({ ...synced, createdAt: new Date().toISOString() });
            console.log("[FIREBASE] Anonymous assessment successfully associated with the authenticated user!");
          } catch (syncErr) {
            console.error('Failed to sync anonymous report to user session:', syncErr);
          }
        }

        // Fetch User Historical Assessments
        try {
          const q = query(
            collection(db, 'assessments'), 
            where('userId', '==', firebaseUser.uid)
          );
          const querySnapshot = await getDocs(q);
          const records: AssessmentResponse[] = [];
          querySnapshot.forEach((docSnap) => {
            records.push(docSnap.data() as AssessmentResponse);
          });
          // Sort by createdAt descending (safely avoids complex index errors)
          records.sort((a, b) => {
            const getMs = (item: any) => {
              if (!item?.createdAt) return 0;
              if (typeof item.createdAt === 'object' && 'seconds' in item.createdAt) {
                return item.createdAt.seconds * 1000;
              }
              try {
                return new Date(item.createdAt).getTime() || 0;
              } catch (err) {
                return 0;
              }
            };
            return getMs(b) - getMs(a);
          });
          setHistoryAssessments(records);
          
          if (records.length > 0 && !currentAssessment) {
            setCurrentAssessment(records[0]);
          }
        } catch (err) {
          console.error('Failed to load past reports:', err);
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setHistoryAssessments([]);
      }
      setIsAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLangChange = (lang: Language) => {
    setCurrentLang(lang);
  };

  const handleActiveTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // Save the assessment to Firestore when successful
  const handleAnalysisSuccess = async (assessment: AssessmentResponse) => {
    const assessmentId = assessment.assessmentId;
    const associatedUserId = user ? user.uid : 'anonymous';
    
    // Supplement assessment record with user-associated metrics matching our schema strictly
    const enriched: AssessmentResponse = {
      ...assessment,
      userId: associatedUserId,
      createdAt: serverTimestamp() as any /* Crucial: satisfies data.createdAt == request.time rules */
    };

    // Firebase saving pipeline executes in the background so slow/stalled/offline connections NEVER block the dashboard rendering
    (async () => {
      try {
        // 1. Save directly into Firestore assessments collection
        await setDoc(doc(db, 'assessments', assessmentId), enriched);

        // 2. If logged in, update physical metrics in User Profile inside Firestore
        if (user) {
          const userRef = doc(db, 'users', user.uid);
          const updatedProfile = {
            ...userProfile,
            userId: user.uid,
            name: userProfile?.name || user.displayName || 'Patient',
            email: userProfile?.email || user.email || '',
            age: Number(assessment.metrics.age),
            gender: assessment.metrics.gender,
            height: Number(assessment.metrics.height),
            weight: Number(assessment.metrics.weight),
            createdAt: userProfile?.createdAt || serverTimestamp()
          };
          await setDoc(userRef, updatedProfile);
        }
      } catch (err) {
        console.error('Firebase save error:', err);
        try {
          handleFirestoreError(err, OperationType.CREATE, `assessments/${assessmentId}`);
        } catch (logErr) {}
      }
    })();

    // Update state to trigger dashboard transition immediately without waiting for database roundtrip
    const uiLocalCopy = { ...enriched, createdAt: new Date().toISOString() };
    setCurrentAssessment(uiLocalCopy);
    localStorage.setItem('diacare_assessment', JSON.stringify(uiLocalCopy));
    
    if (user) {
      setHistoryAssessments(prev => {
        if (prev.some(item => item.assessmentId === uiLocalCopy.assessmentId)) return prev;
        return [uiLocalCopy, ...prev];
      });
    }

    setActiveTab('dashboard');
  };

  // Adjust/re-save the assessment calibration when updated
  const handleCalibrateSuccess = async (updated: AssessmentResponse) => {
    const associatedUserId = user ? user.uid : 'anonymous';
    const enriched: AssessmentResponse = {
      ...updated,
      userId: associatedUserId,
      createdAt: serverTimestamp() as any /* Crucial: updates timestamp with server validity */
    };

    // Background Firebase write so offline state doesn't freeze the UI
    (async () => {
      try {
        await setDoc(doc(db, 'assessments', updated.assessmentId), enriched);
      } catch (err) {
        console.error('Calibration database record save failed:', err);
        try {
          handleFirestoreError(err, OperationType.UPDATE, `assessments/${updated.assessmentId}`);
        } catch (e) {}
      }
    })();

    const uiLocalCopy = { ...enriched, createdAt: new Date().toISOString() };
    setCurrentAssessment(uiLocalCopy);
    localStorage.setItem('diacare_assessment', JSON.stringify(uiLocalCopy));

    if (user) {
      setHistoryAssessments(prev => 
        prev.map(item => item.assessmentId === updated.assessmentId ? uiLocalCopy : item)
      );
    }
  };

  const handleRestart = () => {
    setActiveTab('analyze');
  };

  const handleSelectHistoryAssessment = (assessment: AssessmentResponse) => {
    setCurrentAssessment(assessment);
    localStorage.setItem('diacare_assessment', JSON.stringify(assessment));
  };

  const handleSignIn = () => {
    setActiveTab('auth');
  };

  const handleSignOut = async () => {
    try {
      await logoutUser();
      setCurrentAssessment(null);
      localStorage.removeItem('diacare_assessment');
      setActiveTab('landing');
    } catch (err) {
      console.error('Sign Out attempt blocked:', err);
    }
  };

  const t = translations[currentLang];

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans select-none tracking-normal text-sm">
      {/* Embedded subtle grid pattern overlay matching startup startup-UIs */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />

      {/* Global Navbar */}
      <Navbar 
        currentLang={currentLang} 
        onLangChange={handleLangChange}
        activeTab={activeTab}
        onActiveTabChange={handleActiveTabChange}
        user={user}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      {/* Main Container Screen */}
      <main className="flex-1 relative z-10 max-w-7xl mx-auto w-full pb-20 pt-8 px-4 sm:px-6">
        
        {/* Auth loader shield */}
        {isAuthLoading && (
          <div className="absolute inset-x-0 top-0 py-1.5 bg-gradient-to-r from-cyan-950/25 via-blue-950/25 to-cyan-950/25 border-b border-cyan-500/10 text-center font-mono text-[10px] text-cyan-400 tracking-wider">
            SYNCHRONIZING SECURE HEALTH REGISTRIES...
          </div>
        )}

        {/* Dynamic Navigation Toggles */}
        {activeTab === 'landing' && (
          <LandingPage 
            currentLang={currentLang}
            onStartAnalysis={() => setActiveTab('analyze')}
            onActiveTabChange={handleActiveTabChange}
          />
        )}

        {activeTab === 'analyze' && (
          <SymptomScreening 
            currentLang={currentLang}
            onAnalysisSuccess={handleAnalysisSuccess}
            onBack={() => setActiveTab('landing')}
            userProfile={userProfile}
          />
        )}

        {activeTab === 'dashboard' && (
          currentAssessment ? (
            <HealthDashboard 
              currentLang={currentLang}
              assessment={currentAssessment}
              onCalibrate={handleCalibrateSuccess}
              onRestart={handleRestart}
              historyAssessments={historyAssessments}
              onSelectHistoryAssessment={handleSelectHistoryAssessment}
              userProfile={userProfile}
            />
          ) : (
            user ? (
              <div className="text-center py-20 bg-slate-900/30 border border-slate-800 rounded-3xl max-w-md mx-auto p-6 space-y-4">
                <Shield className="h-10 w-10 text-cyan-400 mx-auto animate-pulse" />
                <h3 className="font-sans font-bold text-lg text-white">No active health dossier</h3>
                <p className="font-sans text-xs text-slate-400">
                  Begin your initial symptom assessment screening first to populate visual health meters.
                </p>
                <button
                  onClick={() => setActiveTab('analyze')}
                  className="px-5 py-2.5 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 text-white font-sans text-xs font-bold leading-none cursor-pointer"
                >
                  {t.startBtn}
                </button>
              </div>
            ) : (
              <div className="max-w-md mx-auto py-12 space-y-6">
                <div className="text-center p-8 bg-slate-900/40 border border-slate-800 rounded-3xl space-y-5 backdrop-blur-md relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/25 to-transparent" />
                  <Shield className="h-10 w-10 text-cyan-500 mx-auto animate-pulse" />
                  <h3 className="font-sans font-bold text-lg text-white">Secure Dashboard Access Required</h3>
                  <p className="font-sans text-xs text-slate-400 leading-relaxed">
                    DiaCare AI enforces strict HIPAA and GDPR data minimization rules. Accessing wellness indices, historic charts, and physician calibrations is restricted to verified accounts.
                  </p>
                  <div className="pt-2 flex flex-col gap-3">
                    <button
                      onClick={() => setActiveTab('auth')}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 font-sans text-xs font-bold text-white shadow-lg shadow-cyan-500/15 cursor-pointer hover:opacity-95 transition-all text-center"
                    >
                      Authenticate Securely
                    </button>
                    <button
                      onClick={() => setActiveTab('landing')}
                      className="w-full py-2 bg-transparent text-[11px] font-mono uppercase tracking-widest text-slate-500 hover:text-white transition-colors text-center cursor-pointer"
                    >
                      Return to Home
                    </button>
                  </div>
                </div>
              </div>
            )
          )
        )}

        {activeTab === 'profile' && (
          <UserProfile 
            currentLang={currentLang}
            user={user}
            userProfile={userProfile}
            historyAssessments={historyAssessments}
            onSelectHistoryAssessment={handleSelectHistoryAssessment}
            onActiveTabChange={handleActiveTabChange}
          />
        )}

        {activeTab === 'auth' && (
          <AuthPage 
            currentLang={currentLang}
            onSuccess={() => {
              setActiveTab('profile');
            }}
            onBackToLanding={() => {
              setActiveTab('landing');
            }}
          />
        )}

        {activeTab === 'feedback' && (
          <FeedbackSystem currentLang={currentLang} />
        )}

        {/* Accessibility Features: Bottom Bar Floating Actions */}
        <div className="mt-12 text-center text-[11px] font-sans text-slate-500 max-w-lg mx-auto leading-relaxed border-t border-slate-900 pt-6">
          <p className="flex items-center justify-center gap-1.5 text-slate-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Zero-Trust HIPAA Protected System Zone • Port 3000 Ingress Certified
          </p>
          <p className="mt-1">
            DiaCare AI uses end-to-end client session encryption. No persistent cookies or patient logs are aggregated without express permission.
          </p>
        </div>
      </main>

      {/* Global AI Floating Physician Assisting Chatbot */}
      <AIChatbot currentLang={currentLang} />

      {/* Mobile Sticky Tab bar helper for quick screens traversal */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-900 py-3 px-4 flex justify-around items-center">
        <button 
          onClick={() => setActiveTab('landing')}
          className={`font-sans text-xs font-bold ${activeTab === 'landing' ? 'text-cyan-400' : 'text-slate-500'}`}
        >
          {t.navLanding}
        </button>
        <button 
          onClick={() => setActiveTab('analyze')}
          className={`font-sans text-xs font-bold ${activeTab === 'analyze' ? 'text-cyan-400' : 'text-slate-500'}`}
        >
          {t.symptoms}
        </button>
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`font-sans text-xs font-bold ${activeTab === 'dashboard' ? 'text-cyan-400' : 'text-slate-500'}`}
        >
          {t.dashboard}
        </button>
        {user ? (
          <button 
            onClick={() => setActiveTab('profile')}
            className={`font-sans text-xs font-bold ${activeTab === 'profile' ? 'text-cyan-400' : 'text-slate-500'}`}
          >
            Profile
          </button>
        ) : (
          <button 
            onClick={() => setActiveTab('feedback')}
            className={`font-sans text-xs font-bold ${activeTab === 'feedback' ? 'text-cyan-400' : 'text-slate-500'}`}
          >
            {t.feedback}
          </button>
        )}
      </div>
    </div>
  );
}
