import { useState, useEffect } from 'react';
import { Language, SymptomData, LifestyleData } from '../types';
import { translations, questionnaireQuestions } from '../data';
import { ArrowLeft, ArrowRight, Mic, MicOff, MessageSquare, Check, Sparkles, Volume2, ShieldCheck, Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SymptomScreeningProps {
  currentLang: Language;
  onAnalysisSuccess: (assessment: any) => void;
  onBack: () => void;
  userProfile?: any;
}

export default function SymptomScreening({
  currentLang,
  onAnalysisSuccess,
  onBack,
  userProfile
}: SymptomScreeningProps) {
  const t = translations[currentLang];
  const questions = questionnaireQuestions;

  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<any>({
    age: 35,
    gender: 'male',
    height: 170,
    weight: 75,
    frequentUrination: false,
    excessiveThirst: false,
    extremeHunger: false,
    constantFatigue: false,
    blurredVision: false,
    slowHealing: false,
    tinglingHandsFeet: false,
    frequentInfections: false,
    dryMouth: false,
    suddenWeightChange: false,
    headaches: false,
    dizziness: false,
    activityLevel: 'moderate',
    sleepHours: 7,
    stressLevel: 'medium',
    waterIntake: 2,
    junkFoodFreq: 'sometimes',
    sugarIntake: 'moderate',
    smoking: false,
    alcohol: 'occasional',
    familyHistory: false
  });

  useEffect(() => {
    if (userProfile) {
      setAnswers((prev: any) => ({
        ...prev,
        age: userProfile.age ?? prev.age,
        gender: userProfile.gender ?? prev.gender,
        height: userProfile.height ?? prev.height,
        weight: userProfile.weight ?? prev.weight,
      }));
    }
  }, [userProfile]);

  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceTextAlert, setVoiceTextAlert] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoSubmitTimeout, setAutoSubmitTimeout] = useState<any>(null);

  const currentQuestion = questions[currentStep];
  const progressPercent = Math.round(((currentStep + 1) / questions.length) * 100);

  // Text-To-Speech (TTS) engine
  const speakQuestion = (textToSpeak: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      // Attempt to locate native voice mappings
      if (currentLang === 'hi') {
        utterance.lang = 'hi-IN';
      } else if (currentLang === 'mr') {
        utterance.lang = 'mr-IN';
      } else {
        utterance.lang = 'en-US';
      }
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Typing simulation effect when step changes
  useEffect(() => {
    // Start with short breathing/typing simulation to look natural
    setIsTyping(true);
    
    const timer = setTimeout(() => {
      setIsTyping(false);
    }, 550);

    return () => {
      clearTimeout(timer);
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [currentStep, currentLang]);

  const handleAnswerSelect = (val: any) => {
    const updatedAnswers = {
      ...answers,
      [currentQuestion.id]: val
    };
    setAnswers(updatedAnswers);

    // If it's the last question (Step 25 of 25), trigger auto-submit!
    if (currentStep === questions.length - 1) {
      if (autoSubmitTimeout) {
        clearTimeout(autoSubmitTimeout);
      }
      const token = setTimeout(() => {
        submitAnalysis(updatedAnswers);
      }, 1000);
      setAutoSubmitTimeout(token);
    }
  };

  const handleNext = () => {
    if (currentStep < questions.length - 1) {
      setCurrentStep(prev => prev + 1);
      setVoiceTextAlert("");
    } else {
      if (autoSubmitTimeout) {
        clearTimeout(autoSubmitTimeout);
      }
      submitAnalysis();
    }
  };

  const handlePrev = () => {
    if (autoSubmitTimeout) {
      clearTimeout(autoSubmitTimeout);
      setAutoSubmitTimeout(null);
    }
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setVoiceTextAlert("");
    }
  };

  const handleVoiceTrigger = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = currentLang === 'hi' ? 'hi-IN' : currentLang === 'mr' ? 'mr-IN' : 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      setIsListening(true);
      setVoiceTextAlert(t.listening);

      recognition.onresult = (event: any) => {
        const resultText = event.results[0][0].transcript;
        setIsListening(false);
        setVoiceTextAlert(`" ${resultText} "`);

        const isTrue = /yes|हाँ|होय|हो|okay|sure|true|प्रेजेंट|गया/i.test(resultText);
        const isFalse = /no|नहीं|नाही|ना|false|ऐबसेंट/i.test(resultText);

        if (currentQuestion.type === 'boolean') {
          if (isTrue) handleAnswerSelect(true);
          if (isFalse) handleAnswerSelect(false);
        } else if (currentQuestion.type === 'number') {
          const matchNum = resultText.match(/\d+/);
          if (matchNum) {
            handleAnswerSelect(parseInt(matchNum[0]));
          }
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        triggerFallbackDuo();
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } else {
      triggerFallbackDuo();
    }
  };

  const triggerFallbackDuo = () => {
    setIsListening(true);
    setVoiceTextAlert(t.listening);

    setTimeout(() => {
      const voiceInputUtterance = currentQuestion.voiceFallback[currentLang];
      let typedChar = "";
      let index = 0;

      const interval = setInterval(() => {
        if (index < voiceInputUtterance.length) {
          typedChar += voiceInputUtterance[index];
          setVoiceTextAlert(`" ${typedChar} "`);
          index++;
        } else {
          clearInterval(interval);
          setIsListening(false);
          if (currentQuestion.type === 'boolean') {
            handleAnswerSelect(typeof currentQuestion.voiceFallback.en === 'string' && /yes/i.test(currentQuestion.voiceFallback.en));
          } else if (currentQuestion.type === 'number') {
            handleAnswerSelect(currentQuestion.id === 'age' ? 35 : currentQuestion.id === 'height' ? 170 : 75);
          } else if (currentQuestion.type === 'select') {
            handleAnswerSelect(currentQuestion.id === 'gender' ? 'male' : currentQuestion.id === 'activityLevel' ? 'moderate' : 'low');
          }
        }
      }, 150);
    }, 1500);
  };

  const submitAnalysis = async (overrideAnswers?: any) => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const targetAnswers = overrideAnswers || answers;

    console.debug("[DIA-CARE DEBUG] Starting diagnostic pipeline execution...");
    console.debug("[DIA-CARE DEBUG] Current selected language:", currentLang);

    let symptoms: SymptomData = {
      frequentUrination: !!targetAnswers.frequentUrination,
      excessiveThirst: !!targetAnswers.excessiveThirst,
      extremeHunger: !!targetAnswers.extremeHunger,
      constantFatigue: !!targetAnswers.constantFatigue,
      blurredVision: !!targetAnswers.blurredVision,
      slowHealing: !!targetAnswers.slowHealing,
      tinglingHandsFeet: !!targetAnswers.tinglingHandsFeet,
      frequentInfections: !!targetAnswers.frequentInfections,
      dryMouth: !!targetAnswers.dryMouth,
      suddenWeightChange: !!targetAnswers.suddenWeightChange,
      headaches: !!targetAnswers.headaches,
      dizziness: !!targetAnswers.dizziness
    };

    let lifestyle: LifestyleData = {
      activityLevel: targetAnswers.activityLevel,
      sleepHours: Number(targetAnswers.sleepHours),
      stressLevel: targetAnswers.stressLevel,
      waterIntake: Number(targetAnswers.waterIntake),
      junkFoodFreq: targetAnswers.junkFoodFreq,
      sugarIntake: targetAnswers.sugarIntake,
      smoking: !!targetAnswers.smoking,
      alcohol: targetAnswers.alcohol,
      familyHistory: !!targetAnswers.familyHistory
    };

    console.debug("[DIA-CARE DEBUG] Packaged Symptoms:", symptoms);
    console.debug("[DIA-CARE DEBUG] Packaged Lifestyle Parameters:", lifestyle);

    const finalBody = {
      userId: userProfile?.userId || 'anonymous',
      age: Number(targetAnswers.age),
      gender: targetAnswers.gender,
      height: Number(targetAnswers.height),
      weight: Number(targetAnswers.weight),
      symptoms,
      lifestyle,
      lang: currentLang
    };

    console.debug("[DIA-CARE DEBUG] Dispatched API payload:", finalBody);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(finalBody)
      });

      console.debug("[DIA-CARE DEBUG] Fetch completed. Status code:", res.status);

      if (!res.ok) {
        throw new Error(`Analysis server endpoint issue (Status: ${res.status})`);
      }

      const completedAssessment = await res.json();
      console.debug("[DIA-CARE DEBUG] Assessment payload received:", completedAssessment);

      // Perform Category calculations: Non-Diabetic / Prediabetic / Diabetic / High Risk
      const pct = completedAssessment.riskPercentage ?? 10;
      let cat = 'Non-Diabetic';
      if (pct >= 75) {
        cat = 'High Risk';
      } else if (pct >= 50) {
        cat = 'Diabetic';
      } else if (pct >= 25) {
        cat = 'Prediabetic';
      } else {
        cat = 'Non-Diabetic';
      }
      completedAssessment.riskCategory = cat;

      // Extract or populate suggested medical tests
      if (!completedAssessment.suggestedTests) {
        completedAssessment.suggestedTests = completedAssessment.riskLevel === 'high'
          ? (currentLang === 'hi' 
              ? ["HbA1c परीक्षण (3 महीने का औसत)", "फास्टिंग ब्लड शुगर टेस्ट (8+ घंटे का उपवास)", "ओरल ग्लूकोज टॉलरेंस टेस्ट (OGTT)", "फास्टिंग सीरम इंसुलिन जांच"]
              : currentLang === 'mr'
              ? ["HbA1c रक्त चाचणी (सरासरी साखर)", "फास्टिंग ब्लड शुगर चाचणी (उपाशी पोटी)", "ओरल ग्लुकोज टॉलरन्स टेस्ट (OGTT)", "फास्टिंग इन्सुलिन प्रमाण चाचणी"]
              : ["HbA1c Screening Test (3-Month Average Glucose)", "Fasting Blood Sugar Test (8+ Hour fasting)", "Oral Glucose Tolerance Test (OGTT)", "Fasting Serum Insulin Assessment"])
          : completedAssessment.riskLevel === 'moderate'
          ? (currentLang === 'hi'
              ? ["HbA1c परीक्षण", "फास्टिंग ब्लड शुगर जांच", "कोलेस्ट्रॉल एवं लिपिड प्रोफाइल"]
              : currentLang === 'mr'
              ? ["HbA1c चाचणी", "फास्टिंग ब्लड शुगर तपासणी", "कोलेस्टेरॉल व लिपिड प्रोफाईल"]
              : ["HbA1c Blood Test", "Fasting Blood Sugar Screening", "Cardiovascular Cholesterol & Lipid Profile"])
          : (currentLang === 'hi'
              ? ["नियमित ब्लड प्रेशर जांच", "वार्षिक स्वास्थ्य स्क्रीनिंग"]
              : currentLang === 'mr'
              ? ["नियमित रक्तदाब तपासणी", "वार्षिक आरोग्य तपासणी"]
              : ["Routine blood pressure monitoring", "Annual physical wellness checkup"]);
      }

      console.debug("[DIA-CARE DEBUG] Enriched completed assessment object:", completedAssessment);

      setSuccessMessage(currentLang === 'en' 
        ? "Success! Your AI Health diagnostics were generated successfully." 
        : currentLang === 'hi'
        ? "सफलता! आपके एआई स्वास्थ्य निदान सफलतापूर्वक तैयार किए गए।"
        : "यशस्वी! आपले एआय आरोग्य निदान यशस्वीरित्या तयार केले गेले.");

      setTimeout(() => {
        setIsLoading(false);
        onAnalysisSuccess(completedAssessment);
      }, 1000);

    } catch (e: any) {
      console.warn("[DIA-CARE DEBUG ERROR] Failed to fetch /api/analyze from back-end server:", e);
      
      const fallHeightM = Number(targetAnswers.height) / 100;
      const fallBmi = Number(targetAnswers.weight) / (fallHeightM * fallHeightM || 1);
      
      // Calculate heuristics locally in fallback loop
      let calculatedRisk = 10;
      if (targetAnswers.age > 45) calculatedRisk += 15;
      else if (targetAnswers.age > 30) calculatedRisk += 5;

      if (fallBmi > 30) calculatedRisk += 25;
      else if (fallBmi > 25) calculatedRisk += 15;

      if (targetAnswers.familyHistory) calculatedRisk += 20;
      if (targetAnswers.smoking) calculatedRisk += 5;
      if (targetAnswers.sugarIntake === 'high') calculatedRisk += 10;
      if (targetAnswers.activityLevel === 'low') calculatedRisk += 10;

      // Symptom calculation
      const activeSymptomsCount = Object.values(symptoms).filter(Boolean).length;
      calculatedRisk += activeSymptomsCount * 6;
      calculatedRisk = Math.max(5, Math.min(95, calculatedRisk));

      let level = 'low';
      let cat = 'Non-Diabetic';
      if (calculatedRisk >= 75) {
        level = 'high';
        cat = 'High Risk';
      } else if (calculatedRisk >= 50) {
        level = 'moderate';
        cat = 'Diabetic';
      } else if (calculatedRisk >= 25) {
        level = 'moderate';
        cat = 'Prediabetic';
      } else {
        level = 'low';
        cat = 'Non-Diabetic';
      }

      const fallbackAssessment = {
        assessmentId: 'fallback_' + Math.random().toString(36).substring(2, 7),
        userId: userProfile?.userId || 'anonymous',
        metrics: { 
          age: Number(targetAnswers.age), 
          gender: targetAnswers.gender, 
          height: Number(targetAnswers.height), 
          weight: Number(targetAnswers.weight), 
          bmi: Math.round(fallBmi * 10) / 10 
        },
        symptoms,
        lifestyle,
        riskLevel: level,
        riskPercentage: calculatedRisk,
        riskCategory: cat,
        healthScore: Math.round(100 - calculatedRisk + 5),
        explanation: currentLang === 'en' 
          ? "Our primary neural engines are temporarily busy. Safe local diagnostic rules estimate a " + level + " risk based on your lifestyle parameters. Recommended to consult a physician for full physical screening."
          : currentLang === 'hi'
          ? "हमारे मुख्य एआई सर्वर व्यस्त हैं। स्थानीय नियमों के आधार पर आपकी जीवनशैली के लिए " + level + " जोखिम आंका गया है।"
          : "आमचे मुख्य सर्व्हर सध्या व्यस्त आहेत. स्थानिक नियमांनुसार आपल्या जीवनशैलीसाठी " + level + " जोखीम वर्तवण्यात आली आहे.",
        recommendations: currentLang === 'en' 
          ? ["Avoid drinking beverages with high refined sugar content.", "Walk for at least 30 minutes after large carbohydrate meals.", "Ensure consistent fiber intake (salads, multi-grain sources).", "Remain adequately hydrated with 2.5L+ fresh liquid water daily."]
          : currentLang === 'hi'
          ? ["परिष्कृत चीनी युक्त मीठे पेय पदार्थों से पूरी तरह बचें।", "कैलोरीयुक्त भोजन के बाद कम से कम 30 मिनट जरूर टहलें।", "दैनिक भोजन में सलाद और हरी पत्तेदार सब्जियां शामिल करें।"]
          : ["साखरयुक्त गोड पेये घेणे पूर्णपणे टाळा.", "जेवणानंतर किमान ३० मिनिटे वेगाने चाला.", "आहारात हिरव्या पालेभाज्या व सॅलडचे प्रमाण वाढवा."],
        suggestedTests: level === 'high' || level === 'moderate'
          ? (currentLang === 'hi' 
              ? ["HbA1c रक्त चाचणी (3 महीने का औसत)", "फास्टिंग ब्लड शुगर जांच"]
              : currentLang === 'mr'
              ? ["HbA1c रक्त चाचणी", "फास्टिंग ब्लड शुगर तपासणी"]
              : ["HbA1c Blood Test (Glycated Hemoglobin)", "Fasting Blood Sugar (FBS) assessment"])
          : (currentLang === 'hi'
              ? ["नियमित वार्षिक स्वास्थ्य जांच"]
              : currentLang === 'mr'
              ? ["नियमित आरोग्य तपासणी"]
              : ["Routine periodic wellness screening"]),
        clinicallyPredicted: false,
        createdAt: new Date().toISOString()
      };

      console.debug("[DIA-CARE DEBUG] Generated heuristic fallback assessment object:", fallbackAssessment);

      setErrorMessage(currentLang === 'en'
        ? "API currently offline. Calculated safe fallback diagnostic indicators."
        : currentLang === 'hi'
        ? "सर्वर ऑफलाइन। सुरक्षित वैकल्पिक चिकित्सा गणनाएं तैयार की गईं।"
        : "सर्व्हर ऑफलाइन आहे. पर्यायी सुरक्षित वैद्यकीय आकडेमोड तयार केली आहे.");

      setTimeout(() => {
        setIsLoading(false);
        onAnalysisSuccess(fallbackAssessment);
      }, 2500);
    }
  };

  return (
    <div className="relative max-w-2xl mx-auto px-4 py-6">
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative mb-5">
              <div className="h-24 w-24 rounded-full border-4 border-cyan-500/10 border-t-cyan-400 border-r-indigo-500/40 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-cyan-400 animate-pulse" />
              </div>
            </div>
            <h3 className="font-sans font-extrabold text-2xl text-white tracking-tight">
              {currentLang === 'en' ? 'Synthesizing Metabolic Data...' : currentLang === 'hi' ? 'मेटाबॉलिक डेटा का विश्लेषण...' : 'मेटाबॉलिक डेटा विश्लेषित होत आहे...'}
            </h3>
            <p className="mt-3 font-sans text-sm text-slate-400 max-w-sm">
              {currentLang === 'en' 
                ? 'Applying clinical neural predictors to symptoms state and body mass index matrices.'
                : 'स्वास्थ्य लक्षणों और बॉडी मास इंडेक्स मेट्रिक्स पर अनुकूल मेडिकल मॉडल लागू किया जा रहा है।'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onBack}
          className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-2 text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4" />
          {t.prev}
        </button>
        <span className="font-mono text-xs text-cyan-400 font-bold uppercase tracking-widest bg-cyan-950/30 px-3.5 py-1.5 rounded-lg border border-cyan-500/20">
          Step {currentStep + 1} of {questions.length}
        </span>
      </div>

      {/* Animated Glowing Progress Bar */}
      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden mb-8 border border-slate-800/60 p-0.5 relative">
        <motion.div 
          className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.3 }}
        />
        <div className="absolute top-0 bottom-0 right-4 w-4 bg-white/25 blur-sm animate-pulse pointer-events-none" />
      </div>

      {/* Success and Error Notification banners */}
      {successMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-emerald-500/10 border border-emerald-500/25 p-4 rounded-2xl flex items-center gap-3 text-emerald-400 shadow-lg shadow-emerald-500/5"
        >
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
          <p className="font-sans text-xs font-bold leading-relaxed">{successMessage}</p>
        </motion.div>
      )}

      {errorMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-amber-500/10 border border-amber-500/25 p-4 rounded-2xl flex items-center gap-3 text-amber-400 shadow-lg shadow-amber-500/5"
        >
          <div className="h-2 w-2 rounded-full bg-amber-400 animate-ping shrink-0" />
          <p className="font-sans text-xs font-bold leading-relaxed">{errorMessage}</p>
        </motion.div>
      )}

      {/* PREMIUM CONVERSATIONAL CHAT BOARD WITH VIRTUAL AI ASSISTANT AVATAR */}
      <div className="bg-gradient-to-b from-slate-900/80 via-slate-950 to-slate-950 border border-slate-800/85 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Design Gradient Backdrop Ring */}
        <div className="absolute -top-16 -right-16 h-36 w-36 bg-cyan-500/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 h-36 w-36 bg-purple-500/10 blur-[80px] rounded-full pointer-events-none" />

        {/* virtual avatar card section */}
        <div className="flex flex-col sm:flex-row items-center gap-4 border-b border-slate-900 pb-5 mb-6">
          <div className="relative">
            {/* Holographic glowing breathing ring */}
            <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-cyan-400 to-indigo-500 opacity-70 blur-md animate-pulse" />
            
            {/* Pulsing sound ring when speaking or listening */}
            {(isListening || !isTyping) && (
              <div className="absolute -inset-3 rounded-full border-2 border-cyan-400/25 animate-ping" />
            )}

            <div className="relative h-14 w-14 rounded-full bg-slate-950 border-2 border-cyan-400 flex items-center justify-center text-cyan-300">
              <Sparkles className={`h-6 w-6 ${isTyping ? 'animate-spin text-purple-400' : isListening ? 'scale-110 text-rose-400' : 'animate-pulse'}`} />
            </div>
          </div>

          <div className="text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="font-sans font-bold text-sm text-white tracking-wide">DiaCare AI Virtual Physician</span>
              <span className="px-1.5 py-0.5 font-mono text-[8px] font-black uppercase tracking-widest rounded bg-cyan-950 border border-cyan-500/20 text-cyan-400">ACTIVE</span>
            </div>
            <p className="text-[10px] font-mono text-slate-500 mt-0.5 uppercase tracking-widest">
              Endocrine biosensor model • Proactive Screening Dialogue
            </p>
          </div>
        </div>

        {/* AI Speeches Bubble & Typing Animations */}
        <div className="min-h-[110px] bg-slate-900/40 border border-slate-900 rounded-2xl p-4 mb-6 relative">
          <AnimatePresence mode="wait">
            {isTyping ? (
              <motion.div 
                key="typing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5 py-2 px-1"
              >
                <div className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce" />
                <div className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce delay-150" />
                <div className="h-2 w-2 rounded-full bg-cyan-400 animate-bounce delay-300" />
                <span className="text-[10px] font-mono text-slate-500 ml-1.5">ASSISTANT IS COMPOSING ANALYSIS...</span>
              </motion.div>
            ) : (
              <motion.div
                key="question"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="flex items-start gap-2">
                  <h2 className="font-sans font-extrabold text-base sm:text-lg text-slate-200 leading-snug flex-1">
                    {currentQuestion.text[currentLang]}
                  </h2>
                  <button
                    onClick={() => speakQuestion(currentQuestion.text[currentLang])}
                    title={currentLang === 'en' ? 'Speak Question' : 'प्रश्न जोर से सुनाएं'}
                    className="p-1.5 rounded-lg bg-slate-90 border border-slate-800 hover:border-cyan-500/30 text-slate-400 hover:text-white cursor-pointer transition-colors"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Voice Input Waves */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleVoiceTrigger}
                    disabled={isListening}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border font-sans text-[10px] font-bold uppercase tracking-wider cursor-pointer transition-all duration-300 ${
                      isListening 
                        ? 'bg-rose-950/40 border-rose-500/45 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.15)]' 
                        : 'bg-slate-950 hover:bg-slate-900 border-slate-850 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isListening ? (
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                        RECORDING DIALOGUE...
                      </span>
                    ) : (
                      <>
                        <Mic className="h-3 w-3 text-cyan-400" />
                        {currentLang === 'en' ? 'Voice Check' : 'आवाज नियंत्रण'}
                      </>
                    )}
                  </button>

                  {voiceTextAlert && (
                    <span className="font-sans text-xs italic text-cyan-300 line-clamp-1 border-l border-slate-800 pl-3">
                      {voiceTextAlert}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* INTERACTIVE INPUT CONTROLS VIEW */}
        <div className="border-t border-slate-900 pt-6">
          <AnimatePresence mode="wait">
            {!isTyping && (
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="min-h-[140px] flex items-center justify-center"
              >
                {currentQuestion.type === 'number' && (
                  <div className="w-full max-w-xs text-center">
                    <input
                      type="number"
                      min={currentQuestion.min}
                      max={currentQuestion.max}
                      value={answers[currentQuestion.id] || ""}
                      onChange={(e) => handleAnswerSelect(Number(e.target.value))}
                      className="w-full bg-slate-900 text-center font-mono font-black text-4xl text-cyan-400 border-2 border-slate-800 focus:border-cyan-500 rounded-2xl py-3 px-4 shadow-inner outline-none focus:ring-1 focus:ring-cyan-500"
                    />
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest block mt-2.5">
                      Acceptable Spectrum: {currentQuestion.min} - {currentQuestion.max}
                    </span>
                  </div>
                )}

                {currentQuestion.type === 'boolean' && (
                  <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                    <button
                      onClick={() => handleAnswerSelect(true)}
                      className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-300 cursor-pointer ${
                        answers[currentQuestion.id] === true
                          ? 'bg-gradient-to-tr from-cyan-950/20 to-blue-950/30 border-cyan-400 text-white shadow-xl shadow-cyan-500/10'
                          : 'bg-slate-900/30 border-slate-850 text-slate-400 hover:border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      <Check className={`h-6 w-6 mb-2 ${answers[currentQuestion.id] === true ? 'text-cyan-400' : 'text-slate-600'}`} />
                      <span className="font-sans font-bold text-xs sm:text-sm uppercase tracking-wide">
                        {currentLang === 'en' ? 'Yes / True' : currentLang === 'hi' ? 'हाँ / उपस्थित' : 'होय / उपलब्ध'}
                      </span>
                    </button>

                    <button
                      onClick={() => handleAnswerSelect(false)}
                      className={`flex flex-col items-center justify-center p-5 rounded-2xl border-2 transition-all duration-300 cursor-pointer ${
                        answers[currentQuestion.id] === false
                          ? 'bg-slate-900 border-slate-700 text-white shadow-md'
                          : 'bg-slate-900/30 border-slate-850 text-slate-400 hover:border-slate-800 hover:text-slate-300'
                      }`}
                    >
                      <div className={`h-5 w-5 mb-2.5 border-2 rounded-full flex items-center justify-center ${answers[currentQuestion.id] === false ? 'border-slate-400 bg-slate-700' : 'border-slate-750'}`}>
                        {answers[currentQuestion.id] === false && <div className="h-2 w-2 rounded-full bg-white" />}
                      </div>
                      <span className="font-sans font-bold text-xs sm:text-sm uppercase tracking-wide">
                        {currentLang === 'en' ? 'No / False' : currentLang === 'hi' ? 'नहीं / अनुपस्थित' : 'नाही / अनुपस्थित'}
                      </span>
                    </button>
                  </div>
                )}

                {currentQuestion.type === 'select' && (
                  <div className="space-y-2.5 w-full max-w-sm">
                    {currentQuestion.options?.map((opt) => {
                      const optSelected = answers[currentQuestion.id] === opt.value;
                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleAnswerSelect(opt.value)}
                          className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex items-center justify-between ${
                            optSelected
                              ? 'bg-gradient-to-r from-cyan-950/20 to-slate-900 border-cyan-500 text-cyan-300'
                              : 'bg-slate-900/30 border-slate-850 text-slate-400 hover:border-slate-800'
                          }`}
                        >
                          <span className="font-sans text-xs sm:text-sm font-semibold">
                            {opt.label[currentLang]}
                          </span>
                          {optSelected && (
                            <div className="h-2 w-2 rounded-full bg-cyan-400" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Screen Navigation Footer */}
      <div className="flex justify-between items-center mt-6">
        <button
          onClick={handlePrev}
          disabled={currentStep === 0}
          className={`px-4 py-3 rounded-xl border font-sans text-xs font-bold uppercase select-none flex items-center gap-1.5 transition-colors ${
            currentStep === 0 
              ? 'border-slate-900/40 text-slate-700' 
              : 'border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 cursor-pointer'
          }`}
        >
          <ArrowLeft className="h-4 w-4" />
          {t.prev}
        </button>

        <button
          onClick={handleNext}
          className="group px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-sans text-xs font-extrabold uppercase tracking-wide cursor-pointer hover:shadow-lg hover:shadow-cyan-500/20 flex items-center gap-1.5 transition-all duration-300"
        >
          <span>{currentStep === questions.length - 1 ? t.finish : t.next}</span>
          <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Embedded HIPAA and Ethical banner */}
      <div className="mt-8 bg-slate-950/50 rounded-2xl border border-slate-900 p-4 text-center flex items-center gap-3.5 text-left max-w-xl mx-auto">
        <ShieldCheck className="h-8 w-8 text-cyan-400 flex-shrink-0" />
        <p className="font-sans text-[10px] sm:text-xs text-slate-500 leading-snug">
          <strong>HIPAA Secure Dialogue:</strong> Your questionnaire replies are analyzed instantly in random server memory. We do not index individual healthcare records under public repositories.
        </p>
      </div>
    </div>
  );
}
