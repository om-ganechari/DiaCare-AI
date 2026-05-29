import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { translations } from '../data';
import { Language, AssessmentResponse, PdfDownload } from '../types';
import { 
  User, Mail, Calendar, Key, Shield, FileText, Download, 
  Activity, Clock, ChevronRight, BarChart2, ShieldAlert, BadgeCheck 
} from 'lucide-react';
import { motion } from 'motion/react';

interface UserProfileProps {
  currentLang: Language;
  user: any;
  userProfile: any;
  historyAssessments: AssessmentResponse[];
  onSelectHistoryAssessment: (assessment: AssessmentResponse) => void;
  onActiveTabChange: (tab: string) => void;
}

export default function UserProfile({
  currentLang,
  user,
  userProfile,
  historyAssessments,
  onSelectHistoryAssessment,
  onActiveTabChange
}: UserProfileProps) {
  const t = translations[currentLang];
  const [subTab, setSubTab] = useState<'reports' | 'predictions' | 'downloads'>('reports');
  const [downloadLogs, setDownloadLogs] = useState<PdfDownload[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

  // Fetch Download logs from firestore
  useEffect(() => {
    if (!user) return;
    
    const fetchDownloadLogs = async () => {
      setIsLogsLoading(true);
      try {
        const q = query(
          collection(db, 'downloads'),
          where('userId', '==', user.uid)
        );
        const querySnapshot = await getDocs(q);
        const records: PdfDownload[] = [];
        querySnapshot.forEach((docSnap) => {
          records.push(docSnap.data() as PdfDownload);
        });

        // Sort descending
        records.sort((a, b) => {
          const getMs = (item: any) => {
            if (!item?.createdAt) return 0;
            if (typeof item.createdAt === 'object' && 'seconds' in item.createdAt) {
              return (item.createdAt as any).seconds * 1000;
            }
            try {
              return new Date(item.createdAt).getTime() || 0;
            } catch (err) {
              return 0;
            }
          };
          return getMs(b) - getMs(a);
        });

        setDownloadLogs(records);
      } catch (err) {
        console.error('Failed to retrieve user download trails:', err);
      } finally {
        setIsLogsLoading(false);
      }
    };

    fetchDownloadLogs();
  }, [user]);

  if (!user) {
    return (
      <div id="no-user-profile-view" className="max-w-md mx-auto text-center py-20 bg-slate-900/30 border border-slate-850 rounded-3xl p-6 space-y-4">
        <ShieldAlert className="h-10 w-10 text-red-500 mx-auto animate-bounce" />
        <h3 className="font-sans font-bold text-lg text-white">Unsecured Session</h3>
        <p className="font-sans text-xs text-slate-400">
          You must be fully signed in under a HIPAA secure node to view health profiles and archives.
        </p>
      </div>
    );
  }

  // Filter between Symptoms-only screening and clinical predictions
  const screeningReports = historyAssessments.filter(item => !item.clinicallyPredicted);
  const clinicalPredictions = historyAssessments.filter(item => item.clinicallyPredicted);

  // Formatting date nicely
  const formatDate = (dateInput: any) => {
    if (!dateInput) return 'Today';
    let d: Date;
    if (typeof dateInput === 'object' && 'seconds' in dateInput) {
      d = new Date(dateInput.seconds * 1000);
    } else {
      d = new Date(dateInput);
    }
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRiskColor = (level: string) => {
    const l = level.toLowerCase();
    if (l === 'high') return 'text-red-400 border-red-500/20 bg-red-950/20';
    if (l === 'moderate') return 'text-amber-400 border-amber-500/20 bg-amber-950/20';
    return 'text-emerald-400 border-emerald-500/20 bg-emerald-950/20';
  };

  const getRiskBadge = (level: string) => {
    const l = level.toLowerCase();
    if (l === 'high') return 'bg-red-500/15 text-red-400 border-red-500/20';
    if (l === 'moderate') return 'bg-amber-500/15 text-amber-400 border-amber-500/20';
    return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
  };

  return (
    <div id="user-profile-layout" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      
      {/* 1. Left panel - User Stats & Credentials */}
      <div className="lg:col-span-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden"
        >
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/35 to-transparent" />
          
          <div className="text-center pb-6 border-b border-slate-850">
            {user.photoURL ? (
              <img 
                src={user.photoURL} 
                alt={user.displayName || 'User'} 
                className="h-20 w-20 rounded-2xl mx-auto object-cover border-2 border-cyan-500/20 shadow-lg shadow-cyan-500/10"
                referrerPolicy="referrer"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center mx-auto shadow-md">
                <User className="h-10 w-10 text-cyan-400" />
              </div>
            )}
            <h3 className="font-sans font-bold text-lg text-white mt-4 flex items-center justify-center gap-1.5">
              {user.displayName || userProfile?.name || 'Patient User'}
              <BadgeCheck className="h-4.5 w-4.5 text-cyan-400 shrink-0" />
            </h3>
            <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-500/80 bg-cyan-950/35 px-2 py-0.5 rounded border border-cyan-500/10 mt-1 inline-block">
              Patient Dossier
            </span>
          </div>

          <div className="py-6 space-y-4">
            <div className="flex items-start gap-3">
              <Mail className="h-4.5 w-4.5 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 leading-none">Registered Email</p>
                <p className="font-sans text-xs text-slate-200 mt-1 break-all">{user.email}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Calendar className="h-4.5 w-4.5 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 leading-none">Join Date</p>
                <p className="font-sans text-xs text-slate-200 mt-1">
                  {formatDate(user.metadata.creationTime)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Key className="h-4.5 w-4.5 text-slate-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-slate-500 leading-none">Security Reference UID</p>
                <p className="font-mono text-[10px] text-slate-400 mt-1 break-all bg-slate-950/60 p-2 rounded border border-slate-850 select-text">{user.uid}</p>
              </div>
            </div>
          </div>

          {/* Quick Metrics display if assessment existed */}
          {historyAssessments.length > 0 && (
            <div className="p-4 rounded-2xl bg-cyan-950/10 border border-cyan-500/10 space-y-3">
              <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest block">Last Reported Metrics</span>
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <span className="text-[10px] text-slate-500 block">Height / Weight</span>
                  <p className="font-sans font-bold text-xs text-white mt-0.5">
                    {userProfile?.height || historyAssessments[0].metrics?.height || '-'} cm / {userProfile?.weight || historyAssessments[0].metrics?.weight || '-'} kg
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Age / Gender</span>
                  <p className="font-sans font-bold text-xs text-white mt-0.5">
                    {userProfile?.age || historyAssessments[0].metrics?.age || '-'} yrs / <span className="capitalize">{userProfile?.gender || historyAssessments[0].metrics?.gender || '-'}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* 2. Right panel - Dynamic Archive Toggles */}
      <div className="lg:col-span-8 space-y-6">
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-md relative overflow-hidden flex flex-col"
        >
          {/* Internal subtab navigation */}
          <div className="flex border-b border-slate-850 pb-px mb-6 gap-6 overflow-x-auto">
            <button
              onClick={() => setSubTab('reports')}
              className={`pb-3 font-sans text-xs uppercase tracking-widest font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                subTab === 'reports' 
                  ? 'border-cyan-400 text-cyan-400' 
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Previous Screening Reports ({screeningReports.length})
            </button>
            <button
              onClick={() => setSubTab('predictions')}
              className={`pb-3 font-sans text-xs uppercase tracking-widest font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                subTab === 'predictions' 
                  ? 'border-cyan-400 text-cyan-400' 
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              Clinical Predictions ({clinicalPredictions.length})
            </button>
            <button
              onClick={() => setSubTab('downloads')}
              className={`pb-3 font-sans text-xs uppercase tracking-widest font-bold border-b-2 transition-all cursor-pointer shrink-0 ${
                subTab === 'downloads' 
                  ? 'border-cyan-400 text-cyan-400' 
                  : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              PDF Download History ({downloadLogs.length})
            </button>
          </div>

          {/* Subtab Content Panels */}
          <div>
            {/* TAB: SCREENING REPORTS */}
            {subTab === 'reports' && (
              <div className="space-y-4">
                {screeningReports.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-slate-800/45 rounded-2xl p-6">
                    <FileText className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                    <p className="font-sans text-xs text-slate-400">No previous screening logs available.</p>
                    <button
                      onClick={() => onActiveTabChange('analyze')}
                      className="mt-3 px-4 py-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-slate-200 font-sans text-xs font-bold transition-all cursor-pointer"
                    >
                      Run Initial Screening
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {screeningReports.map((report) => (
                      <div 
                        key={report.assessmentId}
                        onClick={() => {
                          onSelectHistoryAssessment(report);
                          onActiveTabChange('dashboard');
                        }}
                        className="p-4 rounded-2xl bg-slate-950/40 hover:bg-slate-950 border border-slate-850 hover:border-cyan-500/25 transition-all cursor-pointer flex items-center justify-between gap-4 group"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-sans font-bold text-sm text-white truncate">
                              Report #{report.assessmentId.substring(0, 8).toUpperCase()}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide border ${getRiskBadge(report.riskLevel)}`}>
                              {report.riskLevel} Risk
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-[10px] text-slate-500">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(report.createdAt)}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> Health Score: {report.healthScore}/100</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: CLINICAL PREDICTIONS */}
            {subTab === 'predictions' && (
              <div className="space-y-4">
                {clinicalPredictions.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-slate-800/45 rounded-2xl p-6">
                    <BarChart2 className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                    <p className="font-sans text-xs text-slate-400">No clinical physical predictions cataloged.</p>
                    <p className="font-sans text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                      Generate a screening report first, and utilize the Physio-Clinical Calibrator tool inside the health dashboard to record physical values.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {clinicalPredictions.map((report) => (
                      <div 
                        key={report.assessmentId}
                        onClick={() => {
                          onSelectHistoryAssessment(report);
                          onActiveTabChange('dashboard');
                        }}
                        className="p-4 rounded-2xl bg-slate-950/40 hover:bg-slate-950 border border-slate-850 hover:border-cyan-500/25 transition-all cursor-pointer flex items-center justify-between gap-4 group"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-sans font-bold text-sm text-white truncate">
                              Calibration Assessment #{report.assessmentId.substring(0, 8).toUpperCase()}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wide border ${getRiskBadge(report.riskLevel)}`}>
                              {report.riskLevel} Risk ({report.riskPercentage}%)
                            </span>
                          </div>
                          <div className="flex items-center gap-3 font-mono text-[10px] text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(report.createdAt)}</span>
                            <span>•</span>
                            <span>Glucose: {report.clinicalData?.glucose || 110} mg/dL</span>
                            <span>•</span>
                            <span>BP: {report.clinicalData?.bloodPressure || 120} mmHg</span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-500 group-hover:text-cyan-400 transition-colors shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB: PDF DOWNLOAD HISTORY */}
            {subTab === 'downloads' && (
              <div className="space-y-4">
                {isLogsLoading ? (
                  <div className="py-16 text-center space-y-2">
                    <div className="h-5 w-5 rounded-full border-2 border-slate-900 border-t-cyan-400 animate-spin mx-auto" />
                    <p className="font-mono text-[10px] text-cyan-400 uppercase tracking-widest">Compiling Secure Download Audits...</p>
                  </div>
                ) : downloadLogs.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-slate-800/45 rounded-2xl p-6">
                    <Download className="h-10 w-10 text-slate-600 mx-auto mb-3 animate-bounce" />
                    <p className="font-sans text-xs text-slate-400">No generated PDF downloads recorded.</p>
                    <p className="font-sans text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                      Navigate to your active health dashboard to download your official clinical PDF reports directly.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    {downloadLogs.map((log) => (
                      <div 
                        key={log.downloadId}
                        className="p-4 rounded-2xl bg-slate-950/40 border border-slate-850 flex items-start justify-between gap-4"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded bg-cyan-950/30 border border-cyan-500/10">
                              <Download className="h-3.5 w-3.5 text-cyan-400" />
                            </div>
                            <span className="font-sans font-bold text-xs text-slate-200 truncate pr-2">
                              {log.fileName}
                            </span>
                          </div>
                          
                          <p className="text-[11px] font-sans text-slate-400 pl-8 leading-snug">
                            Assessment reference:{' '}
                            <span className="font-mono text-[10px] bg-slate-900 px-1 py-0.5 rounded border border-slate-850 select-all">
                              #{log.assessmentId.substring(0, 10).toUpperCase()}
                            </span>
                          </p>

                          <div className="pl-8 pt-1 flex items-center gap-3 font-mono text-[10px] text-slate-500">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDate(log.createdAt)}</span>
                            <span>•</span>
                            <span className={`px-1 rounded-sm uppercase ${getRiskColor(log.riskLevel)}`}>{log.riskLevel} {log.riskPercentage}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>

    </div>
  );
}
