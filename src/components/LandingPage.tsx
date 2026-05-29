import { Language } from '../types';
import { translations } from '../data';
import { 
  ShieldAlert, Activity, Sparkles, BrainCircuit, Heart, 
  HelpCircle, ArrowRight, MessageSquareCode, DownloadCloud, FileSpreadsheet, Lock 
} from 'lucide-react';
import { motion } from 'motion/react';

interface LandingPageProps {
  currentLang: Language;
  onStartAnalysis: () => void;
  onActiveTabChange: (tab: string) => void;
}

export default function LandingPage({
  currentLang,
  onStartAnalysis,
  onActiveTabChange
}: LandingPageProps) {
  const t = translations[currentLang];

  return (
    <div className="relative text-white min-h-screen overflow-hidden">
      {/* Premium Ambient Background Accents */}
      <div className="absolute top-20 left-1/4 -translate-y-1/2 w-[350px] h-[350px] bg-cyan-700/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 translate-y-1/2 w-[450px] h-[450px] bg-blue-900/10 blur-[150px] rounded-full pointer-events-none" />

      {/* 1. HERO SECTION */}
      <section className="relative pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center md:max-w-3xl mx-auto">
          {/* Futuristic Header Badge */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-400 font-mono text-xs mb-6 uppercase tracking-widest"
          >
            <Sparkles className="h-3 w-3 animate-spin" />
            Empowering Preventative Care
          </motion.div>

          {/* Heading */}
          <motion.h1 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-sans font-extrabold text-4xl sm:text-6xl tracking-tight text-white leading-tight"
          >
            {t.heroTitle}{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent block sm:inline">
              DiaCare AI
            </span>
          </motion.h1>

          {/* Subtext */}
          <motion.p 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 text-base sm:text-lg text-slate-300 font-sans leading-relaxed"
          >
            {t.heroSubtitle}
          </motion.p>

          {/* Glowing CTA Button */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={onStartAnalysis}
              className="group relative px-8 py-4 w-full sm:w-auto font-sans font-semibold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 transition-all hover:scale-[1.02] cursor-pointer flex items-center justify-center gap-2 text-base"
            >
              <span>{t.startBtn}</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => {
                const stepSec = document.getElementById('how-it-works-sec');
                if (stepSec) stepSec.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-6 py-4 w-full sm:w-auto text-slate-300 font-sans font-medium bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 transition-colors flex items-center justify-center gap-2"
            >
              {t.howItWorks}
            </button>
          </motion.div>

          <p className="mt-4 text-[11px] text-slate-500 font-mono italic">
            {t.securedData}
          </p>
        </div>
      </section>

      {/* 2. WARNING REMINDER AND STATS SECTION */}
      <section className="px-4 py-8 mb-12 max-w-7xl mx-auto">
        <div className="bg-gradient-to-b from-slate-900/60 to-slate-950 border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="flex-shrink-0 p-4 bg-cyan-950/40 rounded-xl border border-cyan-500/20">
            <ShieldAlert className="h-8 w-8 text-cyan-400" />
          </div>
          <div className="text-left">
            <h4 className="font-sans font-semibold text-lg text-slate-200">
              Important Health Advisory Notice
            </h4>
            <p className="mt-2 font-sans text-sm text-slate-400 leading-relaxed">
              {t.disclaimer} {t.warningMsg}
            </p>
          </div>
        </div>
      </section>

      {/* 3. HOW IT WORKS SECTION */}
      <section id="how-it-works-sec" className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-12">
        <div className="text-center mb-12">
          <h2 className="font-sans font-bold text-3xl tracking-tight text-white mb-4">
            {t.howItWorks}
          </h2>
          <div className="h-1.5 w-24 bg-gradient-to-r from-cyan-400 to-blue-500 mx-auto rounded-full" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-slate-950/40 border border-slate-800 p-6 rounded-2xl relative hover:border-cyan-500/20 transition-colors">
            <span className="absolute top-3 right-4 font-mono font-black text-2xl text-slate-800">01</span>
            <div className="h-12 w-12 rounded-xl bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center mb-5">
              <MessageSquareCode className="h-6 w-6 text-cyan-400" />
            </div>
            <h3 className="font-sans font-bold text-lg mb-2">{t.step1}</h3>
            <p className="font-sans text-sm text-slate-400 leading-relaxed">{t.step1Desc}</p>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 p-6 rounded-2xl relative hover:border-cyan-500/20 transition-colors">
            <span className="absolute top-3 right-4 font-mono font-black text-2xl text-slate-800">02</span>
            <div className="h-12 w-12 rounded-xl bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center mb-5">
              <BrainCircuit className="h-6 w-6 text-cyan-400" />
            </div>
            <h3 className="font-sans font-bold text-lg mb-2">{t.step2}</h3>
            <p className="font-sans text-sm text-slate-400 leading-relaxed">{t.step2Desc}</p>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 p-6 rounded-2xl relative hover:border-cyan-500/20 transition-colors">
            <span className="absolute top-3 right-4 font-mono font-black text-2xl text-slate-800">03</span>
            <div className="h-12 w-12 rounded-xl bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center mb-5">
              <Activity className="h-6 w-6 text-cyan-400" />
            </div>
            <h3 className="font-sans font-bold text-lg mb-2">{t.step3}</h3>
            <p className="font-sans text-sm text-slate-400 leading-relaxed">{t.step3Desc}</p>
          </div>

          <div className="bg-slate-950/40 border border-slate-800 p-6 rounded-2xl relative hover:border-cyan-500/20 transition-colors">
            <span className="absolute top-3 right-4 font-mono font-black text-2xl text-slate-800">04</span>
            <div className="h-12 w-12 rounded-xl bg-cyan-950/40 border border-cyan-500/20 flex items-center justify-center mb-5">
              <DownloadCloud className="h-6 w-6 text-cyan-400" />
            </div>
            <h3 className="font-sans font-bold text-lg mb-2">{t.step4}</h3>
            <p className="font-sans text-sm text-slate-400 leading-relaxed">{t.step4Desc}</p>
          </div>
        </div>
      </section>

      {/* 4. CLINICAL FEATURES LIST */}
      <section className="py-16 bg-slate-950/50 border-y border-slate-900 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-sans font-bold text-3xl tracking-tight text-white mb-4">
              AI Diagnostic Capabilities
            </h2>
            <p className="text-slate-400 text-sm font-sans max-w-lg mx-auto">
              Early awareness is the first and strongest barrier against long-term diabetic complications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/80 hover:border-cyan-500/20 transition-all flex flex-col items-center text-center">
              <div className="p-4 bg-cyan-500/5 text-cyan-400 rounded-2xl mb-6">
                <BrainCircuit className="h-8 w-8" />
              </div>
              <h3 className="font-sans font-semibold text-lg mb-3">{t.feat1Title}</h3>
              <p className="font-sans text-sm text-slate-400 leading-relaxed">{t.feat1Desc}</p>
            </div>

            <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/80 hover:border-cyan-500/20 transition-all flex flex-col items-center text-center">
              <div className="p-4 bg-cyan-500/5 text-cyan-400 rounded-2xl mb-6">
                <FileSpreadsheet className="h-8 w-8" />
              </div>
              <h3 className="font-sans font-semibold text-lg mb-3">{t.feat2Title}</h3>
              <p className="font-sans text-sm text-slate-400 leading-relaxed">{t.feat2Desc}</p>
            </div>

            <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800/80 hover:border-cyan-500/20 transition-all flex flex-col items-center text-center">
              <div className="p-4 bg-cyan-500/5 text-cyan-400 rounded-2xl mb-6">
                <Heart className="h-8 w-8" />
              </div>
              <h3 className="font-sans font-semibold text-lg mb-3">{t.feat3Title}</h3>
              <p className="font-sans text-sm text-slate-400 leading-relaxed">{t.feat3Desc}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. METABOLIC INSIGHTS AND DATA VECTORS */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-r from-cyan-950/20 via-slate-950 to-blue-950/20 rounded-3xl border border-cyan-500/10 p-8 md:p-12 flex flex-col lg:flex-row items-center justify-between gap-10">
          <div className="max-w-xl text-left">
            <h2 className="font-sans font-extrabold text-2xl sm:text-3xl tracking-tight text-white mb-4">
              Why Diabetes Early Detection Matters
            </h2>
            <div className="space-y-4 text-slate-300 text-sm font-sans leading-relaxed">
              <p>
                Over <strong>460 million people</strong> worldwide are actively living with diabetes. Nearly half of these individuals remain undiagnosed due to asymptomatic progressions in early pre-diabetic windows.
              </p>
              <p>
                Prolonged hyper-glycemic indices silently weaken arterial pathways, taxing internal kidney functions, cardiovascular grids, and ocular networks. Simple proactive intervention can halt or reverse prediabetes trajectory completely.
              </p>
            </div>
          </div>
          <div className="w-full lg:max-w-md bg-slate-900/60 rounded-2xl p-6 border border-slate-800 text-left font-mono text-xs text-slate-400">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
              <span className="text-cyan-400 font-bold uppercase tracking-widest text-[10px]">Medical Screening Guide</span>
              <Lock className="h-3 w-3 text-slate-500" />
            </div>
            <div className="space-y-3.5">
              <div>
                <dt className="text-slate-200">Normal Fasting Glucose</dt>
                <dd className="text-emerald-400 font-bold mt-1 text-sm">&lt; 100 mg/dL</dd>
              </div>
              <div>
                <dt className="text-slate-200">Prediabetes Glucose Spectrum</dt>
                <dd className="text-yellow-400 font-bold mt-1 text-sm">100 - 125 mg/dL</dd>
              </div>
              <div>
                <dt className="text-slate-200">Diabetic Glucose Diagnosis</dt>
                <dd className="text-red-400 font-bold mt-1 text-sm">&ge; 126 mg/dL</dd>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FAQS */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <h2 className="font-sans font-bold text-2xl text-center mb-10">{t.faqs}</h2>
        <div className="space-y-6">
          <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-2xl">
            <h4 className="font-sans font-bold text-base text-cyan-300 flex items-start gap-2.5">
              <HelpCircle className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              {t.faq1Q}
            </h4>
            <p className="mt-2.5 font-sans text-sm text-slate-400 leading-relaxed ps-7">
              {t.faq1A}
            </p>
          </div>

          <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-2xl">
            <h4 className="font-sans font-bold text-base text-cyan-300 flex items-start gap-2.5">
              <HelpCircle className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              {t.faq2Q}
            </h4>
            <p className="mt-2.5 font-sans text-sm text-slate-400 leading-relaxed ps-7">
              {t.faq2A}
            </p>
          </div>

          <div className="p-6 bg-slate-950/40 border border-slate-800 rounded-2xl">
            <h4 className="font-sans font-bold text-base text-cyan-300 flex items-start gap-2.5">
              <HelpCircle className="h-5 w-5 text-cyan-400 flex-shrink-0 mt-0.5" />
              {t.faq3Q}
            </h4>
            <p className="mt-2.5 font-sans text-sm text-slate-400 leading-relaxed ps-7">
              {t.faq3A}
            </p>
          </div>
        </div>
      </section>

      {/* 8. FOOTER / CONTACT */}
      <footer className="py-12 bg-slate-950 border-t border-slate-900 px-4 sm:px-6 lg:px-8 text-center text-slate-500 font-sans text-xs">
        <div className="flex justify-center gap-6 mb-6">
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-white transition-colors">{t.contactUs}</a>
        </div>
        <p>© 2026 DiaCare AI Technologies Private Limited. All Rights Reserved.</p>
        <p className="mt-2 text-slate-600 font-mono text-[10px]">Cloud Run Sandbox Ingress Zone 3000</p>
      </footer>
    </div>
  );
}
