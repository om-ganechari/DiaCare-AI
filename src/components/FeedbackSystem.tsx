import { useState, FormEvent } from 'react';
import { Language } from '../types';
import { translations } from '../data';
import { Star, MessageSquareCode, Award, Heart, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';

interface FeedbackSystemProps {
  currentLang: Language;
}

export default function FeedbackSystem({ currentLang }: FeedbackSystemProps) {
  const t = translations[currentLang];

  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const feedbackId = doc(collection(db, 'feedbacks')).id;
    const payload: any = {
      rating: Number(rating),
      comment: String(comment),
      createdAt: serverTimestamp()
    };
    if (name.trim()) {
      payload.name = String(name).slice(0, 128);
    }
    if (email.trim()) {
      payload.email = String(email).slice(0, 128);
    }

    try {
      // Create feedback document in Firestore
      await setDoc(doc(db, 'feedbacks', feedbackId), payload);

      // Trigger parallel proxy REST API log
      try {
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rating,
            comment,
            name,
            email
          })
        });
      } catch (restErr) {
        console.warn('Backend proxy log of feedback failed:', restErr);
      }

      setSuccess(true);
      // Reset states
      setComment("");
      setName("");
      setEmail("");
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `feedbacks/${feedbackId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 text-white">
      <div className="text-center mb-8">
        <h2 className="font-sans font-extrabold text-2xl tracking-tight bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent uppercase">
          {t.feedback}
        </h2>
        <div className="h-1 w-16 bg-gradient-to-r from-cyan-400 to-blue-500 mx-auto rounded-full mt-2" />
        <p className="mt-3 font-sans text-xs text-slate-400">
          Your insights guide the progression of our diagnostic biosensors.
        </p>
      </div>

      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        <AnimatePresence mode="wait">
          {!success ? (
            <motion.form 
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onSubmit={handleSubmit}
              className="space-y-6 text-left font-sans"
            >
              {/* Star rating picker */}
              <div className="text-center">
                <label className="block text-xs font-mono text-[#0ea5e9] uppercase tracking-widest mb-3">
                  Rate application experience
                </label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(null)}
                      className="p-1 scale-110 hover:scale-125 transition-transform cursor-pointer"
                    >
                      <Star 
                        className={`h-8 w-8 transition-colors ${
                          star <= (hoverRating ?? rating)
                            ? 'fill-cyan-400 text-cyan-400'
                            : 'text-slate-700'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient Profile metrics keys */}
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-300 block mb-1.5">Your Name (Optional)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter name"
                    className="w-full bg-slate-900/40 border border-slate-800 focus:border-cyan-500 rounded-xl py-2.5 px-3.5 outline-none font-medium text-sm text-slate-300 placeholder-slate-650"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1.5">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter contact email"
                    className="w-full bg-slate-900/40 border border-slate-800 focus:border-cyan-500 rounded-xl py-2.5 px-3.5 outline-none font-medium text-sm text-slate-300 placeholder-slate-650"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-300 block mb-1.5">Suggestions, comments, or issues identified</label>
                  <textarea
                    rows={4}
                    value={comment}
                    required
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Help us solidify our AI biospheres..."
                    className="w-full bg-slate-900/40 border border-slate-800 focus:border-cyan-500 rounded-xl py-2.5 px-3.5 outline-none font-medium text-sm text-slate-300 placeholder-slate-650 resize-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting || !comment.trim()}
                className="w-full py-3.5 px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 font-sans font-bold text-xs text-white uppercase tracking-wider cursor-pointer disabled:opacity-45"
              >
                {isSubmitting ? "Transmitting Feedbacks..." : "Submit Ratings Feedback"}
              </button>
            </motion.form>
          ) : (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-10 space-y-5"
            >
              <div className="inline-flex p-4 rounded-full bg-cyan-950/45 border border-cyan-400/25 text-cyan-400 animate-pulse">
                <CheckCircle className="h-10 w-10" />
              </div>
              <h3 className="font-sans font-black text-xl text-white">
                Feedback Transmitted Successfully!
              </h3>
              <p className="font-sans text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">
                Thank you for your response. Your data serves as a catalyst for our predictive healthcare algorithms.
              </p>
              <button
                onClick={() => setSuccess(false)}
                className="mt-4 px-5 py-2.5 bg-slate-905 border border-slate-800 rounded-xl font-sans text-xs text-slate-300 hover:text-white hover:bg-slate-900 transition-colors"
              >
                Submit another response
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
