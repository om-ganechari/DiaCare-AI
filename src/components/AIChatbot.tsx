import { useState, useRef, useEffect } from 'react';
import { Language, ChatMessage } from '../types';
import { translations } from '../data';
import { MessageSquare, X, Send, Sparkles, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AIChatbotProps {
  currentLang: Language;
}

export const chatbotShortcuts = {
  en: [
    { label: "How to use this app?", prompt: "How to use this app?" },
    { label: "What does moderate risk mean?", prompt: "What does moderate risk mean?" },
    { label: "What foods should I avoid?", prompt: "What foods should I avoid?" },
    { label: "How can I reduce diabetes risk?", prompt: "How can I reduce diabetes risk?" }
  ],
  hi: [
    { label: "ऐप का उपयोग कैसे करें?", prompt: "How to use this app?" },
    { label: "मध्यम जोखिम का क्या अर्थ है?", prompt: "What does moderate risk mean?" },
    { label: "किन खाद्य पदार्थों से परहेज करें?", prompt: "What foods should I avoid?" },
    { label: "जोखिम कैसे कम किया जा सकता है?", prompt: "How can I reduce diabetes risk?" }
  ],
  mr: [
    { label: "हे ॲप कसे वापरावे?", prompt: "How to use this app?" },
    { label: "मध्यम जोखीम म्हणजे काय?", prompt: "What does moderate risk mean?" },
    { label: "कोणते अन्न टाळावे?", prompt: "What foods should I avoid?" },
    { label: "मधुमेहाचा धोका कसा कमी करावा?", prompt: "How can I reduce diabetes risk?" }
  ]
};

export default function AIChatbot({ currentLang }: AIChatbotProps) {
  const t = translations[currentLang];
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Initialize standard first message based on selected language
  useEffect(() => {
    let initialGreeting = "Hello! I am DiaCare AI clinical assistant. I can guide you through symptom analysis, suggest healthy diets, lifestyle routines, and explain diabetes risk parameters. What can I answer for you?";
    if (currentLang === 'hi') {
      initialGreeting = "नमस्ते! मैं डायकेयर एआई क्लीनिकल सहायक हूँ। मैं आपको लक्षणों की जांच, सही आहार, स्वस्थ जीवनशैली के बारे में मार्गदर्शन कर सकता हूँ। मैं आज आपकी क्या सहायता करूँ?";
    } else if (currentLang === 'mr') {
      initialGreeting = "नमस्कार! मी डियाकेअर एआय क्लिनिकल सहाय्यक आहे. मी रक्तातील साखरेचा धोका कमी करण्यासाठी आहारातील बदल, योग्य हालचाली आणि लक्षणांचे विश्लेषण करण्यास मदत करू शकतो.";
    }

    setMessages([
      {
        id: 'start',
        sender: 'assistant',
        text: initialGreeting,
        timestamp: new Date().toISOString()
      }
    ]);
  }, [currentLang]);

  // Scroll to bottom helper
  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSendMessage = async (rawMessage: string) => {
    if (!rawMessage.trim()) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text: rawMessage,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    try {
      // Proxying request to Express backend
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: rawMessage,
          history: messages.slice(-6), // Send last 6 messages for context
          lang: currentLang
        })
      });

      if (!res.ok) throw new Error("Chat api failed");

      const reply = await res.json();
      
      setMessages(prev => [...prev, {
        id: Math.random().toString(),
        sender: 'assistant',
        text: reply.text,
        timestamp: reply.timestamp || new Date().toISOString()
      }]);
    } catch (err) {
      console.error('Chat error:', err);
      // Resilience Mock response
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: Math.random().toString(),
          sender: 'assistant',
          text: currentLang === 'en' 
            ? "I understand. Prioritize a high fiber diet, drink plenty of water, and avoid sedentary patterns. Standard diagnostic tests are recommended." 
            : "कृपया रक्तातील साखरेच्या आकडेवारीचे संतुलन करा आणि संतुलित आहार घेत नियमित व्यायाम चालू ठेवा.",
          timestamp: new Date().toISOString()
        }]);
      }, 1000);
    } finally {
      setIsTyping(false);
    }
  };

  const currentShortcuts = chatbotShortcuts[currentLang] || chatbotShortcuts.en;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* 1. FLOATING CHAT BUTTON */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="h-14 w-14 rounded-full bg-gradient-to-tr from-cyan-500 to-blue-600 shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/45 text-white flex items-center justify-center cursor-pointer relative border border-cyan-400/20"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <X className="h-6 w-6" key="close" />
          ) : (
            <div className="relative" key="chat">
              <MessageSquare className="h-6 w-6" />
              <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-400 border border-slate-950 animate-ping" />
              <div className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border border-slate-950" />
            </div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* 2. SLIDING CHAT DIALOG CONTAINER */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            className="absolute bottom-16 right-0 w-[350px] sm:w-[380px] h-[520px] bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-cyan-950/20 via-slate-900 to-blue-950/20 border-b border-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center font-bold">
                  <Sparkles className="h-4.5 w-4.5 animate-pulse" />
                </div>
                <div>
                  <h4 className="font-sans font-bold text-sm text-white">DiaCare AI Companion</h4>
                  <span className="block text-[8px] font-mono text-emerald-400 tracking-wider uppercase">Endocrine Medical LLM</span>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Disclaimer strip */}
            <div className="bg-slate-900/40 px-3.5 py-1.5 border-b border-slate-900 flex items-center gap-1.5 text-slate-500 text-[10px] font-sans">
              <AlertCircle className="h-3 w-3 text-cyan-500 flex-shrink-0" />
              <span>For awareness. Doesn't substitute professional consults.</span>
            </div>

            {/* Message History list */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4 min-h-[100px] bg-gradient-to-b from-slate-950 to-slate-900">
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`p-3.5 max-w-[85%] rounded-2xl font-sans text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white rounded-br-none'
                      : 'bg-slate-900/60 border border-slate-850 text-slate-200 rounded-bl-none prose prose-invert'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="p-3 bg-slate-900 rounded-2xl rounded-bl-none flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce" />
                    <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce delay-150" />
                    <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-bounce delay-300" />
                  </div>
                </div>
              )}
              <div ref={threadEndRef} />
            </div>

            {/* Smart shortcuts selector list */}
            {messages.length <= 2 && !isTyping && (
              <div className="px-4 py-2 bg-slate-900/30 border-t border-slate-900 space-y-1.5 text-left">
                <span className="block text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">Frequently Asked Shortcuts</span>
                <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto">
                  {currentShortcuts.map((sc, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(sc.prompt)}
                      className="text-left px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800 text-[10px] sm:text-xs text-cyan-400 font-sans hover:text-white transition-colors cursor-pointer leading-tight"
                    >
                      {sc.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Form footer bar */}
            <div className="p-4 bg-slate-950 border-t border-slate-900 flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
                placeholder="Ask about diet, metrics, exercise suggestions..."
                className="flex-1 bg-slate-900 text-xs sm:text-sm text-slate-200 placeholder-slate-500 rounded-xl py-3 px-3.5 border border-slate-800 focus:border-cyan-500 outline-none"
              />
              <button
                onClick={() => handleSendMessage(inputText)}
                className="p-3 bg-gradient-to-tr from-cyan-500 to-blue-600 text-white rounded-xl hover:shadow-md hover:shadow-cyan-500/10 cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
