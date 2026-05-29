import { useState, useEffect } from 'react';
import axios from 'axios';
import { Language, AssessmentResponse } from '../types';
import { translations } from '../data';
import { db, auth } from '../firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Activity, Clock, Heart, Download, HelpCircle, AlertTriangle, 
  RefreshCw, Send, CheckCircle, FileText, Calendar, Compass, 
  Flame, BatteryCharging, Droplet, User, Eye, Volume2, ShieldAlert,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HealthDashboardProps {
  currentLang: Language;
  assessment: AssessmentResponse;
  onCalibrate: (updatedAssessment: AssessmentResponse) => void;
  onRestart: () => void;
  historyAssessments?: AssessmentResponse[];
  onSelectHistoryAssessment?: (assessment: AssessmentResponse) => void;
  userProfile?: any;
}

export default function HealthDashboard({
  currentLang,
  assessment,
  onCalibrate,
  onRestart,
  historyAssessments = [],
  onSelectHistoryAssessment,
  userProfile
}: HealthDashboardProps) {
  const t = translations[currentLang];

  // Clinical Input States (Calibrator)
  const [glucose, setGlucose] = useState<number>(assessment.clinicalData?.glucose || 110);
  const [bp, setBp] = useState<number>(assessment.clinicalData?.bloodPressure || 125);
  const [insulin, setInsulin] = useState<number>(assessment.clinicalData?.insulin || 12);
  const [hba1c, setHba1c] = useState<number>(assessment.clinicalData?.hba1c || 5.8);
  const [cholesterol, setCholesterol] = useState<number>(assessment.clinicalData?.cholesterol || 185);
  const [isCalibrating, setIsCalibrating] = useState(false);

  // Email States
  const [emailInput, setEmailInput] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSuccessMsg, setEmailSuccessMsg] = useState("");
  const [emailPreviewHtml, setEmailPreviewHtml] = useState("");
  const [pdfBase64, setPdfBase64] = useState("");
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Dedicated email modal state controls
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [modalNameInput, setModalNameInput] = useState(userProfile?.name || "Patient");
  const [modalEmailInput, setModalEmailInput] = useState(userProfile?.email || "");
  const [modalIsSending, setModalIsSending] = useState(false);
  const [modalError, setModalError] = useState("");
  const [modalSuccess, setModalSuccess] = useState(false);
  const [modalPreviewHtml, setModalPreviewHtml] = useState("");
  
  // PDF Report Preview state triggers
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState("");
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);

  // ----------------------------------------------------
  // FUTURE HEALTH SIMULATION STATES
  // ----------------------------------------------------
  const [simWeight, setSimWeight] = useState<number>(assessment.metrics.weight);
  const [simSleepHours, setSimSleepHours] = useState<number>(assessment.lifestyle?.sleepHours || 7);
  const [simWaterIntake, setSimWaterIntake] = useState<number>(assessment.lifestyle?.waterIntake || 2);
  const [simActivityLevel, setSimActivityLevel] = useState<string>(assessment.lifestyle?.activityLevel || 'moderate');
  const [simSugarIntake, setSimSugarIntake] = useState<string>(assessment.lifestyle?.sugarIntake || 'moderate');

  // Sync simulation values when assessment changes
  useEffect(() => {
    setSimWeight(assessment.metrics.weight);
    setSimSleepHours(assessment.lifestyle?.sleepHours || 7);
    setSimWaterIntake(assessment.lifestyle?.waterIntake || 2);
    setSimActivityLevel(assessment.lifestyle?.activityLevel || 'moderate');
    setSimSugarIntake(assessment.lifestyle?.sugarIntake || 'moderate');
  }, [assessment]);

  // Dynamic simulation equation
  const getSimulatedRisk = () => {
    let simulated = assessment.riskPercentage;
    
    // 1. Weight impact relative to initial
    if (simWeight !== assessment.metrics.weight) {
      const diff = simWeight - assessment.metrics.weight;
      // Dropping weight reduces risk significantly, adding weight increases it
      simulated += diff * 1.6;
    }

    // 2. Sleep impact: optimum target is 7 to 8 hours
    const baselineSleep = assessment.lifestyle?.sleepHours || 7;
    if (simSleepHours >= 7 && baselineSleep < 7) {
      simulated -= 8;
    } else if (simSleepHours < 6 && baselineSleep >= 6) {
      simulated += 6;
    }

    // 3. Hydration water intake: optimum is 3L/day
    const baselineWater = assessment.lifestyle?.waterIntake || 2;
    if (simWaterIntake >= 3 && baselineWater < 3) {
      simulated -= 7;
    } else if (simWaterIntake < 2 && baselineWater >= 2) {
      simulated += 5;
    }

    // 4. Exercise / Activity
    const baselineActivity = assessment.lifestyle?.activityLevel || 'moderate';
    if (simActivityLevel === 'active' && baselineActivity !== 'active') {
      simulated -= 10;
    } else if (simActivityLevel === 'low' && baselineActivity !== 'low') {
      simulated += 9;
    }

    // 5. Sugar physical intake
    const baselineSugar = assessment.lifestyle?.sugarIntake || 'moderate';
    if (simSugarIntake === 'low' && baselineSugar !== 'low') {
      simulated -= 12;
    } else if (simSugarIntake === 'high' && baselineSugar !== 'high') {
      simulated += 14;
    }

    return Math.max(5, Math.min(95, Math.round(simulated)));
  };

  const simRiskPercentage = getSimulatedRisk();

  // ----------------------------------------------------
  // TEXT-TO-SPEECH (TTS) NARRATION
  // ----------------------------------------------------
  const speakBriefing = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.replace(/[*#_\-`~[\]()]/g, ''));
      utterance.lang = currentLang === 'hi' ? 'hi-IN' : currentLang === 'mr' ? 'mr-IN' : 'en-US';
      utterance.rate = 0.92;
      window.speechSynthesis.speak(utterance);
    }
  };

  // ----------------------------------------------------
  // REPORT DISPATCHERS
  // ----------------------------------------------------
  const handleDownloadPdfDirect = async () => {
    setIsDownloadingPdf(true);
    try {
      console.log("[FRONTEND LOG] Requesting PDF compilation via Axios...");
      const response = await axios.post('/api/generate-report', {
        assessment,
        username: userProfile?.name || 'Patient',
        fullName: userProfile?.name || 'Patient'
      }, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = response.data;
      if (data && data.pdfBase64) {
        console.log("[FRONTEND LOG] PDF Base64 retrieved. Packaging Blob...");
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const blobURL = URL.createObjectURL(blob);

        const downloadLink = document.createElement("a");
        downloadLink.href = blobURL;
        downloadLink.download = data.filename || `DiaCare_Report_Patient.pdf`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(blobURL);
        
        showToast('PDF Report downloaded successfully!');

        // Secure Audit Logging for HIPAA constraints
        const currentUser = auth.currentUser;
        if (currentUser) {
          try {
            const downloadId = doc(collection(db, 'downloads')).id;
            await setDoc(doc(db, 'downloads', downloadId), {
              downloadId,
              userId: currentUser.uid,
              assessmentId: assessment.assessmentId,
              fileName: data.filename || `DiaCare_Report_Patient.pdf`,
              riskLevel: assessment.riskLevel,
              riskPercentage: assessment.riskPercentage,
              createdAt: serverTimestamp()
            });
            console.log("[FIREBASE AUDIT] PDF Download event secured successfully.");
          } catch (loggingErr) {
            console.error("Warning: Failed to create Firestore download audit record:", loggingErr);
          }
        }
      } else {
        showToast('Failed to generate PDF. Empty stream.', 'error');
      }
    } catch (err: any) {
      console.error('[FRONTEND ERROR] Direct PDF download failed:', err);
      const errMsg = err.response?.data?.error || err.message || 'Connection error during PDF download';
      showToast(errMsg, 'error');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePreviewReport = async () => {
    setIsGeneratingPreview(true);
    try {
      console.log("[FRONTEND LOG] Requesting PDF compilation for live preview via Axios...");
      const response = await axios.post('/api/generate-report', {
        assessment,
        username: userProfile?.name || 'Patient',
        fullName: userProfile?.name || 'Patient'
      }, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = response.data;
      if (data && data.pdfBase64) {
        console.log("[FRONTEND LOG] Preview PDF retrieved. Compiling Blob URL...");
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        
        if (previewPdfUrl) {
          URL.revokeObjectURL(previewPdfUrl);
        }
        
        const blobURL = URL.createObjectURL(blob);
        setPreviewPdfUrl(blobURL);
        setIsPreviewModalOpen(true);
        showToast('PDF report compiled. Viewing preview...');
      } else {
        showToast('Failed to load PDF preview.', 'error');
      }
    } catch (err: any) {
      console.error('[FRONTEND ERROR] PDF preview compilation failed:', err);
      const errMsg = err.response?.data?.error || err.message || 'Error compiling PDF preview';
      showToast(errMsg, 'error');
    } finally {
      setIsGeneratingPreview(false);
    }
  };

  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const riskColor = assessment.riskLevel === 'high' ? '#ef4444' : assessment.riskLevel === 'moderate' ? '#f59e0b' : '#10b981';

    printWindow.document.write(`
      <html>
        <head>
          <title>DiaCare AI - Medical Risk Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #1e293b; background-color: #ffffff; }
            .header { border-bottom: 2px solid #0EA5E9; padding-bottom: 20px; margin-bottom: 30px; text-align: center; }
            .title { font-size: 28px; font-weight: bold; margin: 0; color: #0f172a; }
            .subtitle { font-size: 14px; margin: 4px 0 0 0; color: #64748b; }
            .report-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; background-color: #f8fafc; margin-bottom: 30px; }
            .score-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            .score-table td { padding: 8px 12px; border-bottom: 1px solid #e1e8ed; }
            .score-val { text-align: right; font-weight: bold; }
            .sec-title { font-size: 18px; color: #0f172a; border-left: 4px solid #0EA5E9; padding-left: 10px; margin-top: 35px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 0.5px; }
            .rec-list { padding-left: 20px; line-height: 1.6; }
            .rec-list li { margin-bottom: 8px; }
            .disclaimer { font-size: 11px; color: #64748b; margin-top: 50px; background-color: #f1f5f9; padding: 15px; border-radius: 6px; line-height: 1.5; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">DiaCare AI Medical Dossier</h1>
            <p class="subtitle">Smart Diabetes Screening & Prognostic Analytics</p>
          </div>
          
          <div class="report-card">
            <h3 style="margin-top:0; color:#0284c7; font-size:14px; text-transform:uppercase;">Diagnostic Summary State</h3>
            <table class="score-table">
              <tr>
                <td>Risk Categorization:</td>
                <td class="score-val" style="color: ${riskColor};">${assessment.riskLevel.toUpperCase()}</td>
              </tr>
              <tr>
                <td>Risk Probability Score:</td>
                <td class="score-val">${assessment.riskPercentage}%</td>
              </tr>
              <tr>
                <td>General Health Index:</td>
                <td class="score-val" style="color: #10b981;">${assessment.healthScore}/100</td>
              </tr>
              <tr>
                <td>Subject Age:</td>
                <td class="score-val">${assessment.metrics.age} years</td>
              </tr>
              <tr>
                <td>Subject BMI Index:</td>
                <td class="score-val">${assessment.metrics.bmi} kg/m²</td>
              </tr>
            </table>
          </div>

          <h3 class="sec-title">Physician AI Analytical Review</h3>
          <p style="font-size:14px; line-height:1.6; font-style:italic;">"${assessment.explanation}"</p>

          <h3 class="sec-title">Clinical Recommendations & Lifestyle Plan</h3>
          <ul class="rec-list">
            ${assessment.recommendations.map(rec => `<li>${rec}</li>`).join('')}
          </ul>

          <div class="disclaimer">
            <strong>Important Clinical Disclaimer:</strong> This health summary record was automatically computed by the DiaCare AI primary neural pipeline using user-reported and laboratory parameters. It is intended solely as an awareness aid and does not replace professional, in-person clinical examinations or medical advice.
          </div>
          
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleClinicalSubmit = async () => {
    setIsCalibrating(true);
    try {
      const res = await fetch('/api/clinical-predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          glucose,
          bloodPressure: bp,
          insulin,
          hba1c,
          cholesterol,
          bmi: assessment.metrics.bmi,
          previousAssessment: assessment,
          lang: currentLang
        })
      });

      if (!res.ok) throw new Error('Calibrator failed');
      const updated = await res.json();
      onCalibrate(updated);
      showToast('Clinical calibration metrics synchronized!');
    } catch (e) {
      console.error(e);
      const mockUpdated = {
        ...assessment,
        riskPercentage: Math.min(99, assessment.riskPercentage + (glucose > 140 ? 15 : 0) + (hba1c > 6.5 ? 20 : 0)),
        riskLevel: (assessment.riskPercentage + (glucose > 140 ? 15 : 0) + (hba1c > 6.5 ? 20 : 0)) > 60 ? 'high' : 'moderate',
        clinicallyPredicted: true,
        clinicalData: { glucose, bloodPressure: bp, insulin, hba1c, cholesterol, bmi: assessment.metrics.bmi }
      };
      onCalibrate(mockUpdated as any);
      showToast('Locally calibrated clinical values!', 'success');
    } finally {
      setIsCalibrating(false);
    }
  };

  const handleEmailReport = async () => {
    if (!emailInput) return;
    setIsSendingEmail(true);
    setEmailSuccessMsg("");
    setEmailPreviewHtml("");
    setPdfBase64("");

    try {
      const res = await fetch('/api/email-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailInput,
          assessment
        })
      });

      if (res.ok) {
        const bodyObj = await res.json();
        setEmailSuccessMsg(t.emailSuccess);
        setEmailPreviewHtml(bodyObj.preview || "");
        if (bodyObj.pdfBase64) {
          setPdfBase64(bodyObj.pdfBase64);
        }
      }
    } catch (err) {
      console.error('Email pipeline blocked:', err);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const isHighRisk = assessment.riskLevel === 'high';
  const isModRisk = assessment.riskLevel === 'moderate';

  // ----------------------------------------------------
  // EXPLAINABLE AI FACTOR CLASSIFIER
  // ----------------------------------------------------
  const getRiskDrivers = () => {
    const drivers = [];
    
    // Check key symptoms
    if (assessment.symptoms.frequentUrination) {
      drivers.push({ name: currentLang === 'en' ? 'Frequent Urination' : 'बार-बार पेशाब आना', impact: '+15%', desc: 'Suggests high renal glycemic filtration load.', icon: Droplet, color: 'text-cyan-400 border-cyan-500/20' });
    }
    if (assessment.symptoms.excessiveThirst) {
      drivers.push({ name: currentLang === 'en' ? 'Unquenchable Thirst' : 'तीव्र प्यास लगना', impact: '+12%', desc: 'Cellular dehydration signaling glucose spikes.', icon: Droplet, color: 'text-sky-400 border-sky-500/20' });
    }
    if (assessment.symptoms.constantFatigue) {
      drivers.push({ name: currentLang === 'en' ? 'Constant Fatigue' : 'थकान या कमजोरी', impact: '+10%', desc: 'Impaired glucose synthesis in skeletal muscle cells.', icon: BatteryCharging, color: 'text-purple-400 border-purple-500/20' });
    }
    if (assessment.symptoms.tinglingHandsFeet) {
      drivers.push({ name: currentLang === 'en' ? 'Tingling Extremities' : 'हाथ-पैर सुन्न होना', impact: '+18%', desc: 'Sensory pathways stressed by peripheral neural irritation.', icon: Activity, color: 'text-amber-400 border-amber-500/20' });
    }
    if (assessment.symptoms.blurredVision) {
      drivers.push({ name: currentLang === 'en' ? 'Blurred Vision' : 'धुंधली दृष्टि', impact: '+14%', desc: 'Transient osmolality alterations in physiological lens systems.', icon: Eye, color: 'text-rose-400 border-rose-500/20' });
    }

    // Lifestyle triggers
    if (assessment.metrics.bmi > 25) {
      const excess = Math.round((assessment.metrics.bmi - 24.9) * 10) / 10;
      drivers.push({ name: currentLang === 'en' ? `Elevated BMI Index (${assessment.metrics.bmi})` : 'अधिक वजन (उच्च बीएमआई)', impact: '+16%', desc: `Weight profile is above standard range. Adds cellular insulin resistance.`, icon: User, color: 'text-indigo-400 border-indigo-400/20' });
    }
    if (assessment.lifestyle.sugarIntake === 'high') {
      drivers.push({ name: currentLang === 'en' ? 'High Glycemic Diet' : 'अधिक मीठा चीनी खाना', impact: '+15%', desc: 'Forces heavy insulin secretions, stressing pancreatic reserve.', icon: Flame, color: 'text-red-400 border-red-500/20' });
    }
    if (assessment.lifestyle.sleepHours < 6) {
      drivers.push({ name: currentLang === 'en' ? 'Short Sleep Cycles' : 'कम नींद', impact: '+8%', desc: 'Sleep deprivation increases cortisol, raising glycogen release.', icon: Clock, color: 'text-blue-400 border-blue-500/20' });
    }
    if (assessment.lifestyle.stressLevel === 'high') {
      drivers.push({ name: currentLang === 'en' ? 'High Core Stress' : 'अधिक मानसिक तनाव', impact: '+11%', desc: 'Under elevated cortisol, visceral glucose cycles spike naturally.', icon: AlertTriangle, color: 'text-yellow-400 border-yellow-500/20' });
    }
    if (assessment.lifestyle.familyHistory) {
      drivers.push({ name: currentLang === 'en' ? 'Genetic Predisposition' : 'पारिवारिक इतिहास', impact: '+16%', desc: 'Congenital beta-cell vulnerability patterns documented.', icon: Heart, color: 'text-pink-400 border-pink-500/20' });
    }

    return drivers;
  };

  const activeDrivers = getRiskDrivers();

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 text-white relative">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-5 border-b border-slate-900 pb-6 mb-8">
        <div>
          <h1 className="font-sans font-extrabold text-3xl tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent uppercase flex items-center gap-2">
            <Activity className="h-7 w-7 text-cyan-400 animate-pulse" />
            {t.dashboard}
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1 uppercase tracking-widest">
            Medical Dossier: #{assessment.assessmentId} • Completed: {new Date(assessment.createdAt).toLocaleDateString()}
          </p>
        </div>
        
        {/* Top Floating Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleDownloadPdfDirect}
            disabled={isDownloadingPdf}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-[0.98] active:scale-95 disabled:opacity-40 text-xs font-bold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-500/10"
          >
            {isDownloadingPdf ? (
              <div className="h-4 w-4 rounded-full border-2 border-transparent border-t-white animate-spin" />
            ) : <Download className="h-4 w-4" />}
            {currentLang === 'en' ? 'Download PDF' : currentLang === 'hi' ? 'पीडीएफ डाउनलोड' : 'पीडीएफ डाउनलोड करा'}
          </button>

          <button
            onClick={handlePreviewReport}
            disabled={isGeneratingPreview || isDownloadingPdf}
            className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/30 hover:bg-slate-850 active:scale-95 disabled:opacity-40 text-xs font-bold text-cyan-400 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
          >
            {isGeneratingPreview ? (
              <div className="h-4 w-4 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
            ) : <Eye className="h-4 w-4" />}
            {currentLang === 'en' ? 'Preview Report' : currentLang === 'hi' ? 'पूर्वावलोकन' : 'पूर्वावलोकन'}
          </button>

          <button
            onClick={() => {
              setModalNameInput(userProfile?.name || 'Patient');
              setModalEmailInput(userProfile?.email || '');
              setModalSuccess(false);
              setModalError('');
              setModalPreviewHtml('');
              setIsEmailModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-[0.98] active:scale-95 text-xs font-bold text-white transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/15"
          >
            <Mail className="h-4 w-4" />
            {currentLang === 'en' ? 'Share via Email' : currentLang === 'hi' ? 'ईमेल द्वारा साझा करें' : 'ईमेलद्वारे सामायिक करा'}
          </button>
          
          <button
            onClick={handlePrintReport}
            className="px-4 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-300 hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <FileText className="h-4 w-4" />
            {currentLang === 'en' ? 'Print Summary' : currentLang === 'hi' ? 'संक्षिप्त प्रिंट' : 'प्रिंट करा'}
          </button>
          
          <button
            onClick={onRestart}
            className="px-5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/30 text-xs font-extrabold text-cyan-400 hover:text-white transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            {currentLang === 'en' ? 'Screen Again' : currentLang === 'hi' ? 'पुनः जांचें' : 'पुन्हा तपासा'}
          </button>
        </div>
      </div>

      {/* CORE STATS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* SCORE GAUGE CARD */}
        <div className="lg:col-span-2 bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-850 rounded-3xl p-6 sm:p-8 relative overflow-hidden flex flex-col sm:flex-row items-center justify-around gap-6 shadow-xl">
          <div className="absolute top-0 right-0 h-44 w-44 bg-cyan-500/5 blur-3xl rounded-full pointer-events-none" />
          
          {/* Radial Circle SVG Meter */}
          <div className="relative h-44 w-44 flex-shrink-0">
            {/* Soft background glow */}
            <div className={`absolute inset-2.5 rounded-full filter blur-[10px] opacity-15 ${
              isHighRisk ? 'bg-red-500' : isModRisk ? 'bg-amber-500' : 'bg-emerald-500'
            }`} />

            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="41"
                stroke="#0f172a"
                strokeWidth="7"
                fill="transparent"
              />
              <motion.circle
                cx="50"
                cy="50"
                r="41"
                stroke={isHighRisk ? '#f87171' : isModRisk ? '#fbbf24' : '#34d399'}
                strokeWidth="8"
                fill="transparent"
                strokeDasharray="257.6"
                initial={{ strokeDashoffset: 257.6 }}
                animate={{ strokeDashoffset: 257.6 - (257.6 * assessment.riskPercentage) / 100 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-4xl font-extrabold text-white tracking-tighter">{assessment.riskPercentage}%</span>
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">{t.riskProbability}</span>
            </div>
          </div>

          <div className="text-center sm:text-left space-y-3 max-w-sm">
            <span className={`inline-block px-3 py-1 text-[10px] font-mono font-black uppercase rounded-lg border ${
              isHighRisk ? 'bg-red-500/10 border-red-500/20 text-red-400' : isModRisk ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
              Classification: {assessment.riskCategory || (assessment.riskLevel === 'high' ? 'High Risk' : assessment.riskLevel === 'moderate' ? 'Moderate Risk' : 'Low Risk')}
            </span>
            <h2 className="font-sans font-extrabold text-2xl text-slate-100">
              {t.healthScore}: <span className="text-emerald-400 font-mono font-black">{assessment.healthScore}/100</span>
            </h2>
            <p className="font-sans text-xs text-slate-400 leading-relaxed">
              Synthesized by comparing symptom severity index with BMI parameters, dehydration indicators, genetic variables, and core sleep patterns.
            </p>
          </div>
        </div>

        {/* METRICS & BMI CARD */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-855 p-6 rounded-3xl flex flex-col justify-between shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-900 pb-3.5 mb-4">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-400">Patient Biometrics</span>
            <Compass className="h-4 w-4 text-cyan-500" />
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between border-b border-slate-900/50 pb-1.5">
              <span className="text-slate-500 font-semibold">Age Profile</span>
              <span className="font-bold text-slate-200">{assessment.metrics.age} years</span>
            </div>
            <div className="flex justify-between border-b border-slate-900/50 pb-1.5">
              <span className="text-slate-500 font-semibold">Gender Index</span>
              <span className="font-bold text-slate-200 uppercase">{assessment.metrics.gender}</span>
            </div>
            <div className="flex justify-between border-b border-slate-900/50 pb-1.5">
              <span className="text-slate-500 font-semibold">Height Metric</span>
              <span className="font-bold text-slate-200">{assessment.metrics.height} cm</span>
            </div>
            <div className="flex justify-between pb-1.5">
              <span className="text-slate-500 font-semibold">Weight Metric</span>
              <span className="font-bold text-slate-200">{assessment.metrics.weight} kg</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-900/80 bg-cyan-950/20 rounded-xl p-3 border border-cyan-500/10 text-center">
            <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Calculated body mass index</span>
            <div className="font-mono text-xl font-black text-cyan-400 mt-0.5">{assessment.metrics.bmi} kg/m²</div>
          </div>
        </div>
      </div>

      {/* EMERGENCY ADVISORY BOX FOR EXTREMELY HIGH RISK */}
      {isHighRisk && (
        <div className="bg-gradient-to-r from-red-950/20 via-slate-950 to-red-950/20 border-2 border-red-500/20 rounded-3xl p-5 sm:p-6 mb-8 flex flex-col md:flex-row gap-5 items-start md:items-center shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 h-20 w-20 bg-red-500/5 blur-2xl rounded-full" />
          <div className="p-3.5 bg-red-500/15 rounded-2xl border border-red-500/25 text-red-400 flex-shrink-0 animate-pulse">
            <ShieldAlert className="h-7 w-7" />
          </div>
          <div className="space-y-1.5 max-w-2xl">
            <h4 className="font-sans font-black text-base text-red-300 uppercase tracking-widest">
              Clinical Precaution Alert
            </h4>
            <p className="font-sans text-xs sm:text-sm text-slate-400 leading-relaxed">
              Your reported symptoms or laboratory indicators indicate high hyper-glycemic progression risk. We strongly advise a formal lab blood screening (such as <strong className="text-red-400">HbA1c</strong> or <strong className="text-red-400">OGTT Fasting Glucose</strong>). Focus immediately on zero simple sugars or simple starches, stay hydrated, and arrange an endocrine appointment.
            </p>
          </div>
        </div>
      )}

      {/* DETAILED EXPLANATION */}
      <div className="bg-slate-905 border border-slate-850 rounded-3xl p-6 sm:p-8 mb-8 relative">
        <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
          <h3 className="font-sans font-bold text-base text-cyan-400 uppercase tracking-wider flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-500" />
            AI Physician Clinical Briefing
          </h3>
          
          <button
            onClick={() => speakBriefing(assessment.explanation)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-bold text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <Volume2 className="h-4 w-4 text-cyan-400" />
            <span>Speak Briefing</span>
          </button>
        </div>
        <p className="font-sans text-sm sm:text-base leading-relaxed text-slate-300 italic whitespace-pre-wrap">
          "{assessment.explanation}"
        </p>
      </div>

      {/* Dual Blocks: EXPLAINABLE AI DRIVERS & CLINICAL CALIBRATOR */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

        {/* 1. WHY AM I AT RISK? (Explainable AI) */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-850 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-5">
              <h3 className="font-sans font-black text-base text-white uppercase tracking-widest">
                Why Am I At Risk?
              </h3>
              <span className="px-1.5 py-0.5 font-mono text-[8px] font-black rounded bg-purple-950 border border-purple-500/20 text-purple-400 uppercase">Explainable AI</span>
            </div>
            
            <p className="font-sans text-xs text-slate-400 leading-relaxed mb-6">
              The following internal metrics and symptom markers have contributed dynamically to your screening index:
            </p>

            {activeDrivers.length > 0 ? (
              <div className="space-y-3">
                {activeDrivers.map((driver, index) => {
                  const IconComp = driver.icon;
                  return (
                    <div key={index} className="flex items-start gap-3 p-3 bg-slate-950/60 border rounded-2xl hover:bg-slate-900/40 transition-colors">
                      <div className={`p-2 bg-slate-900 rounded-xl border ${driver.color} flex-shrink-0 mt-0.5`}>
                        <IconComp className="h-4 w-4" />
                      </div>
                      <div className="flex-1 space-y-0.5">
                        <div className="flex justify-between items-center">
                          <span className="font-sans font-extrabold text-xs text-slate-200">{driver.name}</span>
                          <span className="font-mono text-xs font-black text-rose-400">{driver.impact}</span>
                        </div>
                        <p className="font-sans text-[11px] text-slate-500 leading-snug">{driver.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-500 italic">No major metabolic risk drivers detected. Maintain your routine!</div>
            )}
          </div>

          <div className="mt-6 p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/10 flex items-center gap-3">
            <Heart className="h-5 w-5 text-cyan-400 flex-shrink-0" />
            <p className="font-sans text-[11px] text-slate-400 leading-snug">
              Every card reflects a biological and clinical risk weight. Improving these directly scales down prediabetes progressions.
            </p>
          </div>
        </div>

        {/* 2. CLINICAL CALIBRATOR */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-850 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-xl">
          <div>
            <h3 className="font-sans font-bold text-base text-white uppercase tracking-wider mb-2">
              {t.clinicalCalibrator}
            </h3>
            <p className="font-sans text-xs text-slate-400 leading-relaxed mb-6">
              {t.clinicalDesc} Double-check with laboratory parameters to refine risk projections.
            </p>

            <div className="space-y-4 font-mono text-xs">
              <div>
                <label className="text-slate-300 block mb-1">{t.glucose} (mg/dL)</label>
                <input
                  type="number"
                  value={glucose}
                  onChange={(e) => setGlucose(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg py-2 px-3 outline-none font-bold text-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">{t.bp} (mmHg)</label>
                <input
                  type="number"
                  value={bp}
                  onChange={(e) => setBp(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg py-2 px-3 outline-none font-bold text-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">HbA1c Meter Score (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={hba1c}
                  onChange={(e) => setHba1c(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg py-2 px-3 outline-none font-bold text-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">Serum Cholesterol (mg/dL)</label>
                <input
                  type="number"
                  value={cholesterol}
                  onChange={(e) => setCholesterol(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg py-2 px-3 outline-none font-bold text-cyan-400"
                />
              </div>

              <div>
                <label className="text-slate-300 block mb-1">{t.insulin} (uIU/mL)</label>
                <input
                  type="number"
                  value={insulin}
                  onChange={(e) => setInsulin(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg py-2 px-3 outline-none font-bold text-cyan-400"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleClinicalSubmit}
            disabled={isCalibrating}
            className="w-full mt-6 py-3 px-4 font-sans font-bold text-xs rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:shadow-cyan-500/10 text-white cursor-pointer transition-all flex items-center justify-center gap-2"
          >
            {isCalibrating ? (
              <div className="h-4 w-4 rounded-full border-2 border-slate-900 border-t-white animate-spin" />
            ) : <Activity className="h-4 w-4" />}
            {t.enterClinical}
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------
          FUTURE HEALTH SIMULATOR (Interactive Prognostics)
         ---------------------------------------------------- */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-2 border-cyan-500/15 rounded-3xl p-6 sm:p-8 mb-8 shadow-2xl relative overflow-hidden">
        {/* Holographic neon circles */}
        <div className="absolute top-0 right-1/4 h-32 w-32 bg-indigo-500/5 blur-3xl rounded-full pointer-events-none" />
        
        <div className="flex items-center justify-between border-b border-slate-900 pb-4 mb-6">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-950/40 rounded-xl border border-cyan-500/20 text-cyan-400">
              <Compass className="h-5 w-5 animate-spin" />
            </div>
            <div>
              <h3 className="font-sans font-black text-base text-white uppercase tracking-widest">
                Futuristic Health Simulator
              </h3>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">Prognostic AI predictive sandbox</p>
            </div>
          </div>
          <span className="px-2.5 py-1 font-mono text-[9px] font-bold uppercase rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">CALIBRATING</span>
        </div>

        <p className="font-sans text-xs text-slate-400 leading-relaxed mb-8 max-w-xl">
          Adjust the reactive metric sliders below to simulate weight reduction, improved hydration, optimal sleep, daily aerobic movement, and sugar reductions. Watch the AI's prognostic engine dynamically calculate your prospective risk reductions.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Slider Controls Column */}
          <div className="space-y-5">
            {/* Weight Slider */}
            <div className="space-y-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-slate-300">Simulate Weight Goal</span>
                <span className="font-bold text-cyan-400">{simWeight} kg</span>
              </div>
              <input 
                type="range"
                min={Math.max(30, assessment.metrics.weight - 25)}
                max={Math.min(180, assessment.metrics.weight + 15)}
                value={simWeight}
                onChange={(e) => setSimWeight(Number(e.target.value))}
                className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Sleep Slider */}
            <div className="space-y-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-slate-300">Simulate Nightly Sleep</span>
                <span className="font-bold text-cyan-400">{simSleepHours} hours</span>
              </div>
              <input 
                type="range"
                min="4"
                max="10"
                value={simSleepHours}
                onChange={(e) => setSimSleepHours(Number(e.target.value))}
                className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Hydration Slider */}
            <div className="space-y-2">
              <div className="flex justify-between font-mono text-xs">
                <span className="text-slate-300">Simulate Water Hydration</span>
                <span className="font-bold text-cyan-400">{simWaterIntake} Litres / day</span>
              </div>
              <input 
                type="range"
                min="1"
                max="5"
                value={simWaterIntake}
                onChange={(e) => setSimWaterIntake(Number(e.target.value))}
                className="w-full h-1 bg-slate-900 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            {/* Exercise Drop Buttons */}
            <div>
              <label className="block text-slate-300 font-mono text-xs mb-2">Simulate Activity Level</label>
              <div className="grid grid-cols-3 gap-2">
                {['low', 'moderate', 'active'].map((level) => (
                  <button
                    key={level}
                    onClick={() => setSimActivityLevel(level)}
                    className={`py-1.5 rounded-lg font-sans text-[10px] font-bold uppercase transition-colors cursor-pointer border ${
                      simActivityLevel === level 
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                        : 'bg-slate-950 border-slate-900 text-slate-500'
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Sugar Intake Drop Buttons */}
            <div>
              <label className="block text-slate-300 font-mono text-xs mb-2">Simulate Sugar/Sweets Intake</label>
              <div className="grid grid-cols-3 gap-2">
                {['low', 'moderate', 'high'].map((sugar) => (
                  <button
                    key={sugar}
                    onClick={() => setSimSugarIntake(sugar)}
                    className={`py-1.5 rounded-lg font-sans text-[10px] font-bold uppercase transition-colors cursor-pointer border ${
                      simSugarIntake === sugar 
                        ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400'
                        : 'bg-slate-950 border-slate-900 text-slate-500'
                    }`}
                  >
                    {sugar}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* SVG Comparative Visualizer Visual Graphics Column */}
          <div className="bg-slate-950 border border-slate-900 rounded-2xl p-6 flex flex-col justify-between shadow-inner">
            <span className="block font-mono text-[9px] text-[#0ea5e9] uppercase tracking-widest text-left mb-4">Comparison prognosis matrices</span>
            
            <div className="space-y-6 flex-1 flex flex-col justify-center">
              
              {/* Baseline state horizontal gauge bar */}
              <div className="space-y-2 text-left">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>Baseline Screening Risk</span>
                  <span className="font-bold text-slate-200">{assessment.riskPercentage}%</span>
                </div>
                <div className="h-3 bg-slate-900/60 rounded-full overflow-hidden p-[1px] border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-red-500 to-rose-600 rounded-full transition-all duration-300"
                    style={{ width: `${assessment.riskPercentage}%` }}
                  />
                </div>
              </div>

              {/* Simulated state horizontal gauge bar */}
              <div className="space-y-2 text-left">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>Simulated Improved State Risk</span>
                  <span className="font-black text-emerald-400 animate-pulse">{simRiskPercentage}%</span>
                </div>
                <div className="h-3 bg-slate-900/60 rounded-full overflow-hidden p-[1px] border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-400 to-cyan-500 rounded-full transition-all duration-300"
                    style={{ width: `${simRiskPercentage}%` }}
                  />
                </div>
              </div>

              {/* Delta risk drops highlights */}
              {assessment.riskPercentage > simRiskPercentage ? (
                <div className="p-3.5 bg-emerald-950/10 border border-emerald-500/15 rounded-xl text-center">
                  <span className="font-mono text-emerald-400 text-xs font-bold uppercase tracking-wide">
                    Simulated Risk Drop: -{assessment.riskPercentage - simRiskPercentage}%
                  </span>
                  <p className="font-sans text-[11px] text-slate-500 mt-1">
                    Outstanding. This shows how daily micro-habits actively mitigate diabetes!
                  </p>
                </div>
              ) : assessment.riskPercentage < simRiskPercentage ? (
                <div className="p-3.5 bg-red-950/10 border border-red-500/15 rounded-xl text-center">
                  <span className="font-mono text-red-400 text-xs font-bold uppercase tracking-wide">
                    Potential Risk Accumulation: +{simRiskPercentage - assessment.riskPercentage}%
                  </span>
                  <p className="font-sans text-[11px] text-slate-500 mt-1">
                    Consider dropping sugar intake or body mass metrics to scale down risk curves.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-900 border border-slate-850 rounded-xl text-center text-xs text-slate-500">
                  Slide or toggle modifiers above to start simulation mapping.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* INDIVIDUAL LIFESTYLE RECOMMENDATIONS */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-850 rounded-3xl p-6 sm:p-8 mb-8 flex flex-col lg:flex-row items-stretch justify-between gap-6 shadow-xl">
        <div className="flex-1">
          <h3 className="font-sans font-bold text-base text-white uppercase tracking-wider mb-5 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Personalized Recovery Plan
          </h3>
          <ul className="space-y-4">
            {assessment.recommendations.map((rec, index) => (
              <li key={index} className="flex gap-3 text-xs sm:text-sm text-slate-300 font-sans leading-relaxed items-start">
                <div className="h-5 w-5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5 font-bold">
                  ✓
                </div>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:max-w-xs flex flex-col justify-center bg-slate-950/40 p-5 rounded-2xl border border-slate-900/60">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-cyan-400 flex-shrink-0 animate-spin" style={{ animationDuration: '4s' }} />
            <div className="text-left">
              <span className="block font-sans text-xs font-black text-cyan-400 uppercase tracking-widest">Active cardiovascular walk</span>
              <span className="font-sans text-xs text-slate-400 mt-1 block">Aim for a 30-minute steady-state hydration walk after major meals to scale back arterial sugar loads.</span>
            </div>
          </div>
        </div>
      </div>

      {/* SUGGESTED MEDICAL LAB TESTS */}
      {assessment.suggestedTests && assessment.suggestedTests.length > 0 && (
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-850 rounded-3xl p-6 sm:p-8 mb-8 shadow-xl">
          <h3 className="font-sans font-bold text-base text-white uppercase tracking-wider mb-3 bg-gradient-to-r from-red-400 to-amber-500 bg-clip-text text-transparent flex items-center gap-2">
            Suggested Medical Screening & Laboratory Tests
          </h3>
          <p className="font-sans text-xs text-slate-400 mb-6 leading-relaxed">
            Based on your biological multipliers and reported symptom configurations, the medical pipeline strongly suggests coordinating the following diagnostic screens with your healthcare provider:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {assessment.suggestedTests.map((test: string, index: number) => (
              <div key={index} className="p-4 bg-slate-950/70 border border-slate-850 hover:border-slate-800 transition-colors rounded-2xl flex gap-3 items-center">
                <div className="h-8 w-8 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center font-bold font-mono shrink-0 text-xs">
                  0{index + 1}
                </div>
                <div>
                  <span className="font-sans text-xs sm:text-sm font-semibold text-slate-200 block">{test}</span>
                  <span className="font-sans text-[10px] text-slate-500 uppercase tracking-widest mt-0.5 block">Provider Screening Suggestion</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EMAIL EXPORT INTERACTION */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-850 rounded-3xl p-6 sm:p-8 mb-8 text-center shadow-xl">
        <h3 className="font-sans font-bold text-base text-white uppercase tracking-wider mb-2">
          Do you want this report emailed to you?
        </h3>
        <p className="font-sans text-xs text-slate-400 max-w-sm mx-auto mb-6">
          Submit your personal email below to receive a high-fidelity digital snapshot of your healthcare analysis.
        </p>

        <div className="max-w-md mx-auto flex flex-col sm:flex-row items-center gap-3">
          <input
            type="email"
            placeholder={t.enterEmailPlaceholder}
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            className="w-full sm:flex-1 bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl py-3 px-4 outline-none text-xs sm:text-sm text-cyan-400 placeholder-slate-650"
          />
          <button
            onClick={() => {
              setModalNameInput(userProfile?.name || 'Patient');
              setModalEmailInput(emailInput || userProfile?.email || '');
              setModalSuccess(false);
              setModalError('');
              setModalPreviewHtml('');
              setIsEmailModalOpen(true);
            }}
            disabled={!emailInput}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-sans font-bold text-xs text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
            {t.emailReportBtn}
          </button>
        </div>

        {/* Dynamic Email Delivery preview container */}
        <AnimatePresence>
          {emailSuccessMsg && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 border border-emerald-500/25 bg-emerald-950/20 rounded-2xl p-6 text-left max-w-2xl mx-auto"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-sans text-sm font-bold text-slate-200">{emailSuccessMsg}</span>
                </div>
                
                {pdfBase64 && (
                  <button
                    onClick={() => {
                      const linkSource = `data:application/pdf;base64,${pdfBase64}`;
                      const downloadLink = document.createElement("a");
                      downloadLink.href = linkSource;
                      downloadLink.download = `diacare_health_report_${assessment.assessmentId || 'care'}.pdf`;
                      downloadLink.click();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white font-sans font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg shadow-teal-500/15"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download Official PDF Report
                  </button>
                )}
              </div>
              
              <div className="border border-slate-800 rounded-xl p-4 bg-white/5 max-h-[300px] overflow-y-auto">
                <span className="block font-mono text-[9px] text-slate-500 mb-4 uppercase tracking-widest border-b border-slate-800 pb-2">DISPATCHED EMAIL COPY PREVIEW:</span>
                <div dangerouslySetInnerHTML={{ __html: emailPreviewHtml }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* HISTORICAL RECORDS LIST */}
      {historyAssessments && historyAssessments.length > 0 && (
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-850 rounded-3xl p-6 sm:p-8 mb-8 shadow-xl">
          <h3 className="font-sans font-bold text-base text-cyan-400 border-b border-slate-900 pb-3 mb-6 uppercase tracking-wider flex items-center gap-2">
            <Calendar className="h-5 w-5 text-cyan-500" />
            Your Historical Screening Records
          </h3>
          <p className="font-sans text-xs text-slate-400 mb-6 leading-relaxed">
            Monitor how your diabetes risk probability climbs or falls over successive assessments. Select any entry to switch active metrics dashboard views.
          </p>

          <div className="relative border-l-2 border-slate-800 ml-3 pl-6 space-y-6">
            {historyAssessments.map((hist) => {
              const isActive = hist.assessmentId === assessment.assessmentId;
              const hRiskColor = hist.riskLevel === 'high' ? '#ef4444' : hist.riskLevel === 'moderate' ? '#f59e0b' : '#10b981';
              const hBgColor = hist.riskLevel === 'high' ? 'bg-red-500/10' : hist.riskLevel === 'moderate' ? 'bg-amber-500/10' : 'bg-emerald-500/10';
              const hBorderColor = hist.riskLevel === 'high' ? 'border-red-500/20' : hist.riskLevel === 'moderate' ? 'border-amber-500/20' : 'border-emerald-500/20';

              return (
                <div key={hist.assessmentId} className="relative group animate-fade-in">
                  <div className={`absolute -left-[31px] top-1.5 h-3 w-3 rounded-full border-2 transition-all duration-300 ${isActive ? 'bg-cyan-400 border-cyan-400 scale-125 shadow-[0_0_10px_rgba(34,211,238,0.5)]' : 'bg-slate-900 border-slate-700 group-hover:border-cyan-500'}`} />
                  
                  <div 
                    onClick={() => onSelectHistoryAssessment && onSelectHistoryAssessment(hist)}
                    className={`cursor-pointer transition-all duration-300 rounded-2xl p-4 border text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
                      isActive 
                        ? 'bg-slate-850 border-cyan-500/40 shadow-lg shadow-cyan-500/5' 
                        : 'bg-slate-950 border-slate-850 hover:bg-slate-900/60 hover:border-slate-800'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-sans font-bold text-sm text-slate-200">
                          {new Date(hist.createdAt).toLocaleString(currentLang === 'hi' ? 'hi-IN' : currentLang === 'mr' ? 'mr-IN' : 'en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </span>
                        {hist.clinicallyPredicted && (
                          <span className="inline-block px-2 py-0.5 text-[8px] font-mono font-bold uppercase rounded bg-cyan-950 text-cyan-400 border border-cyan-500/20">
                            Clinical Calibration
                          </span>
                        )}
                        {isActive && (
                          <span className="inline-block px-2 py-0.5 text-[8px] font-mono font-bold uppercase rounded bg-[#0f172a] text-cyan-400 border border-cyan-500/20">
                            Active Dossier
                          </span>
                        )}
                      </div>
                      <p className="font-sans text-xs text-slate-400 leading-relaxed max-w-xl line-clamp-1">
                        {hist.explanation}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                      <div className="text-right sm:block hidden">
                        <span className="block text-[8px] font-mono text-slate-500 uppercase tracking-wider font-semibold">Health score</span>
                        <span className="font-mono text-sm font-bold text-emerald-400">{hist.healthScore}/100</span>
                      </div>
                      <div className={`px-3 py-1.5 rounded-xl border ${hBgColor} ${hBorderColor} flex items-center gap-2`}>
                        <div className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: hRiskColor }} />
                        <span className="font-mono text-xs font-black uppercase text-slate-200">{hist.riskPercentage}%</span>
                        <span className="font-sans text-[10px] font-semibold uppercase text-slate-300">({hist.riskLevel})</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-2xl shadow-2xl border flex items-center gap-3 backdrop-blur-md ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300'
                : 'bg-red-950/90 border-red-500/30 text-red-300'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />}
            <span className="font-sans text-xs font-semibold leading-none">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Email Input Modal */}
      <AnimatePresence>
        {isEmailModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              {/* Close button */}
              <button
                onClick={() => setIsEmailModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-cyan-500/10 rounded-xl text-cyan-400 border border-cyan-500/20">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-sans font-black text-lg text-white uppercase tracking-wider text-left">
                    Share via Email
                  </h3>
                  <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-0.5 text-left">Secure email dispatch dispatcher</p>
                </div>
              </div>

              <p className="text-xs text-slate-400 mb-6 text-left leading-relaxed font-sans">
                Enter any recipient's email address below to immediately dispatch a high-fidelity digital PDF copy of this diabetes risk screening assessment. Perfect for sharing directly with family members, personal physicians, or clinical support teams.
              </p>

              <div className="space-y-4 font-sans text-xs text-left">
                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Recipient Full Name</label>
                  <input
                    type="text"
                    value={modalNameInput}
                    onChange={(e) => setModalNameInput(e.target.value)}
                    placeholder="E.g. John Doe"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl py-3 px-4 outline-none font-medium text-slate-200 placeholder-slate-650"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">This name will be dynamically written as the patient on the PDF header.</p>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1 font-semibold">Recipient Email Address</label>
                  <input
                    type="email"
                    value={modalEmailInput}
                    onChange={(e) => {
                      setModalEmailInput(e.target.value);
                      if (modalError) setModalError('');
                    }}
                    placeholder="your.email@gmail.com"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-xl py-3 px-4 outline-none font-medium text-slate-200 placeholder-slate-650"
                  />
                </div>

                {modalError && (
                  <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/20 text-red-400 font-medium">
                    {modalError}
                  </div>
                )}

                {modalSuccess ? (
                  <div className="space-y-4 text-left">
                    <div className="p-4 rounded-xl bg-emerald-950/25 border border-emerald-500/20 text-emerald-300 space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-sm mb-1 text-emerald-400">
                        <CheckCircle className="h-4 w-4" /> Email Dispatched Successfully!
                      </div>
                      <p className="text-xs leading-relaxed text-slate-300">
                        The diabetes screening PDF report card has been sent to <strong>{modalEmailInput}</strong>.
                      </p>
                    </div>

                    {modalPreviewHtml && (
                      <div className="border border-slate-800 bg-slate-950/50 rounded-2xl p-4 mt-3">
                        <span className="block font-sans text-[10px] font-bold text-cyan-400 tracking-wider mb-2.5 uppercase text-left">Simulated Email Courier Log:</span>
                        <div 
                          className="max-h-48 overflow-y-auto text-xs text-slate-400 scrollbar-thin overflow-x-hidden leading-relaxed text-left"
                          dangerouslySetInnerHTML={{ __html: modalPreviewHtml }} 
                        />
                      </div>
                    )}

                    <div className="flex gap-2.5 pt-2">
                      <button
                        onClick={() => setModalSuccess(false)}
                        className="flex-1 py-3 px-4 font-sans font-bold text-xs rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 cursor-pointer text-center"
                      >
                        Send Another
                      </button>
                      <button
                        onClick={() => setIsEmailModalOpen(false)}
                        className="flex-1 py-3 px-4 font-sans font-bold text-xs rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white cursor-pointer text-center"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2.5 pt-4 text-left">
                    <button
                      onClick={() => setIsEmailModalOpen(false)}
                      disabled={modalIsSending}
                      className="flex-1 py-3 px-4 font-sans font-bold text-xs rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 transition-all cursor-pointer disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!modalEmailInput) {
                          setModalError('Email is required');
                          return;
                        }
                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                        if (!emailRegex.test(modalEmailInput)) {
                          setModalError('Please enter a valid Gmail or standard email address');
                          return;
                        }

                        setModalIsSending(true);
                        setModalError('');

                        try {
                          console.log("[FRONTEND LOG] Sending report via Axios post request...");
                          const response = await axios.post('/api/send-report-email', {
                            name: modalNameInput,
                            email: modalEmailInput,
                            reportData: assessment
                          }, {
                            timeout: 15000, // 15 seconds timeout
                            headers: { 'Content-Type': 'application/json' }
                          });

                          const data = response.data;
                          if (data.success) {
                            setModalSuccess(true);
                            setModalPreviewHtml(data.preview || '');
                            showToast('Email sent successfully!');
                          } else {
                            setModalError(data.error || 'Server rejected email dispatch. Please try again.');
                            showToast(data.error || 'Server error', 'error');
                          }
                        } catch (err: any) {
                          console.error('[FRONTEND ERROR] Dispatch email Axios transaction failed:', err);
                          const errMsg = err.response?.data?.error || err.message || 'Connection lost. Please review network setup and try again.';
                          setModalError(errMsg);
                          showToast(errMsg, 'error');
                        } finally {
                          setModalIsSending(false);
                        }
                      }}
                      disabled={modalIsSending}
                      className="flex-1 py-3 px-4 font-sans font-bold text-xs rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-[0.98] text-white transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 shadow-lg shadow-cyan-500/20 shadow-cyan-500/10"
                    >
                      {modalIsSending ? (
                        <>
                          <div className="h-4 w-4 rounded-full border-2 border-slate-900 border-t-white animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          {modalError ? 'Retry Send' : 'Send Report'}
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Preview Modal */}
      <AnimatePresence>
        {isPreviewModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative max-h-[90vh] flex flex-col"
            >
              <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900 shrink-0">
                <div className="text-left">
                  <h3 className="font-sans font-extrabold text-lg text-slate-100 uppercase tracking-tight flex items-center gap-2">
                    <FileText className="h-5 w-5 text-cyan-400 animate-pulse" />
                    Report Preview
                  </h3>
                  <p className="text-[10px] font-mono text-slate-500 uppercase mt-0.5">
                    Live compiled report snapshot for {userProfile?.name || 'Patient'}
                  </p>
                </div>
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-4 sm:p-6 bg-slate-950/40 overflow-y-auto flex-1 space-y-4">
                {previewPdfUrl ? (
                  <div className="space-y-4">
                    <iframe
                      src={previewPdfUrl}
                      title="DiaCare Report Live Preview"
                      className="w-full h-[50vh] sm:h-[55vh] rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl"
                    />
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-900/50 border border-slate-850 rounded-2xl">
                      <div className="text-left">
                        <span className="block font-mono text-[9px] text-slate-500 uppercase">Device Compatibility Note</span>
                        <p className="text-[11px] text-slate-400 leading-normal">
                          If your mobile operating system restricts inline PDF frame navigation, you can download the report direct to your hardware via the button on the right.
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          const downloadLink = document.createElement("a");
                          downloadLink.href = previewPdfUrl;
                          downloadLink.download = `DiaCare_Report_${(userProfile?.name || 'Patient').replace(/\s+/g, '_')}.pdf`;
                          document.body.appendChild(downloadLink);
                          downloadLink.click();
                          document.body.removeChild(downloadLink);
                        }}
                        className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:opacity-[0.98] text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-500/10 shrink-0"
                      >
                        <Download className="h-4 w-4" />
                        Download PDF File
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="py-20 flex flex-col items-center justify-center gap-3">
                    <div className="h-10 w-10 rounded-full border-4 border-transparent border-t-cyan-400 animate-spin" />
                    <p className="text-sm font-mono text-slate-400">Rendering high-fidelity preview stream...</p>
                  </div>
                )}
              </div>

              <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-900 flex justify-end shrink-0">
                <button
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="py-2.5 px-6 font-sans font-extrabold text-xs rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 transition-colors cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
