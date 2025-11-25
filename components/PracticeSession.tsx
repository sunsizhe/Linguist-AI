
import React, { useState, useEffect, useRef } from 'react';
import { SentenceData, EvaluationResult } from '../types';
import { evaluatePronunciation } from '../services/geminiService';
import AnalysisPanel from './AnalysisPanel';

interface PracticeSessionProps {
  sentences: SentenceData[];
  onComplete: () => void;
  onBackToInput: () => void;
}

const PracticeSession: React.FC<PracticeSessionProps> = ({ sentences, onComplete, onBackToInput }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [unlockedIndex, setUnlockedIndex] = useState(0); // Track max progress
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false); // Track audio playback
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null); // Track which tooltip is open
  
  const currentSentence = sentences[currentIndex];
  
  // Web Speech API refs
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>(''); // Accumulate transcript
  const audioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Ref for audio delay timer

  // Handle global click to close tooltips
  useEffect(() => {
    const handleClickOutside = () => {
      setActiveWordIndex(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  // Handle evaluation needs to be accessible to onend, so we keep it fresh or depend on it
  const handleEvaluation = async (transcript: string) => {
    if (!transcript.trim()) return;
    
    setIsEvaluating(true);
    const result = await evaluatePronunciation(currentSentence.english, transcript);
    setEvaluation(result);
    setIsEvaluating(false);
    setShowAnalysis(true);
  };

  useEffect(() => {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      // Enable continuous mode so it doesn't stop automatically on silence
      recognitionRef.current.continuous = true; 
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let finalTrans = '';
        let interimTrans = '';

        // Reconstruct full transcript from results list
        for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTrans += event.results[i][0].transcript;
            } else {
                interimTrans += event.results[i][0].transcript;
            }
        }
        // Store the best guess current transcript
        transcriptRef.current = finalTrans + interimTrans;
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
             setIsRecording(false);
             alert("无法访问麦克风，请检查权限设置。");
        }
        // Don't auto-stop UI for minor errors, but real stop happens in onend
      };
      
      recognitionRef.current.onend = () => {
          setIsRecording(false);
          // Only evaluate if we have content and it wasn't just a quick toggle
          if (transcriptRef.current && transcriptRef.current.trim().length > 0) {
             handleEvaluation(transcriptRef.current);
          }
      };
    }
    
    return () => {
        if (recognitionRef.current) {
            recognitionRef.current.abort();
        }
        if (audioTimerRef.current) {
            clearTimeout(audioTimerRef.current);
        }
        window.speechSynthesis.cancel();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]); 

  const playAudio = (text: string = currentSentence.english, rate: number = 0.9) => {
    if (isPlaying || isRecording) return; // Prevent double click or overlap

    const synth = window.speechSynthesis;
    
    // 1. Force cancel previous speech and clear timer
    if (audioTimerRef.current) clearTimeout(audioTimerRef.current);
    synth.cancel();
    setIsPlaying(true);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;
    
    // 2. Prevent Garbage Collection & Handle state
    (window as any)._currentUtterance = utterance;
    
    utterance.onend = () => {
        setIsPlaying(false);
        (window as any)._currentUtterance = null;
    };
    
    utterance.onerror = (e) => {
        // Ignore interruption errors which happen when canceling to start new audio
        if (e.error === 'interrupted' || e.error === 'canceled') {
            return;
        }
        console.error("TTS Error details:", e.error);
        setIsPlaying(false);
        (window as any)._currentUtterance = null;
    };

    // 3. Optimized delay: 300ms to allow audio hardware wake-up
    // Using ref to ensure we can clear it if user navigates away
    audioTimerRef.current = setTimeout(() => {
        // Ensure synth is ready
        if (synth.paused) synth.resume();
        
        try {
            synth.speak(utterance);
        } catch (err) {
            console.error("TTS Speak Error:", err);
            setIsPlaying(false);
        }
        
        // Double check resume in case browser auto-paused
        if (synth.paused) synth.resume();
    }, 300);
  };

  const toggleRecording = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent closing tooltip
    if (!recognitionRef.current) {
        alert("您的浏览器不支持语音识别。");
        return;
    }

    if (isRecording) {
      // User manually stops
      recognitionRef.current.stop();
      // onend will trigger evaluation
    } else {
      // User starts
      if (isPlaying) {
          if (audioTimerRef.current) clearTimeout(audioTimerRef.current);
          window.speechSynthesis.cancel();
          setIsPlaying(false);
      }
      
      setEvaluation(null);
      setShowAnalysis(false);
      setActiveWordIndex(null); // Close tooltips on record
      transcriptRef.current = ''; // Clear previous
      
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error("Mic start error", e);
        setIsRecording(false);
      }
    }
  };

  const handleNext = () => {
    setEvaluation(null);
    setShowAnalysis(false);
    setActiveWordIndex(null);
    if (audioTimerRef.current) clearTimeout(audioTimerRef.current);
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    
    const nextIdx = currentIndex + 1;
    if (nextIdx < sentences.length) {
      if (nextIdx > unlockedIndex) {
        setUnlockedIndex(nextIdx);
      }
      setCurrentIndex(nextIdx);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onComplete();
    }
  };

  const handleJumpToLevel = (index: number) => {
    if (index <= unlockedIndex) {
        setEvaluation(null);
        setShowAnalysis(false);
        setActiveWordIndex(null);
        if (audioTimerRef.current) clearTimeout(audioTimerRef.current);
        window.speechSynthesis.cancel();
        setIsPlaying(false);
        setCurrentIndex(index);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleWordClick = (e: React.MouseEvent, idx: number) => {
      e.stopPropagation(); // Prevent global click listener
      // Toggle logic
      setActiveWordIndex(activeWordIndex === idx ? null : idx);
  };

  // Helper to render words with error highlighting
  const renderSentenceWithFeedback = () => {
    const words = currentSentence.english.split(' ');
    return (
      <div className="flex flex-wrap justify-center gap-x-2 gap-y-3 text-3xl md:text-4xl font-bold font-['Nunito'] text-slate-700 leading-normal">
        {words.map((word, idx) => {
          const cleanWord = word.replace(/[.,!?;:"'()]/g, '').toLowerCase();
          const error = evaluation?.errors.find(e => e.word.toLowerCase() === cleanWord);
          const vocabItem = currentSentence.vocabAnalysis?.find(v => v.word.toLowerCase() === cleanWord);
          const isActive = activeWordIndex === idx;
          
          if (error) {
            return (
              <div key={idx} className="relative inline-block z-10">
                {/* Word with Error Underline */}
                <span 
                    onClick={(e) => handleWordClick(e, idx)}
                    className={`cursor-pointer border-b-2 pb-1 px-2 rounded-lg transition-all duration-200 
                        ${isActive 
                            ? 'text-red-600 border-red-500 bg-red-100 ring-2 ring-red-200 ring-offset-2' 
                            : 'text-red-500 border-red-300 bg-red-50/50 hover:bg-red-100'}`}
                >
                  {word}
                </span>
                
                {/* Enhanced Tooltip - Conditional Rendering */}
                {isActive && (
                    <>
                        {/* Mobile Overlay Backdrop */}
                        <div 
                            className="fixed inset-0 bg-black/20 z-40 md:hidden" 
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveWordIndex(null);
                            }}
                        ></div>

                        {/* Tooltip Content */}
                        <div 
                            onClick={(e) => e.stopPropagation()} 
                            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm md:absolute md:top-auto md:bottom-full md:left-1/2 md:mb-2 md:w-80 bg-white text-slate-700 text-sm rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.3)] border border-slate-100 z-50 animate-fade-in-up md:origin-bottom"
                        >
                            {/* Header: Phonemes + Audio Button */}
                            <div className="bg-red-50/80 backdrop-blur-sm p-4 rounded-t-2xl border-b border-red-50 flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold text-red-500 mb-1">{cleanWord}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg font-mono text-emerald-600 font-bold bg-white px-2 py-0.5 rounded shadow-sm border border-emerald-100">/{error.expectedPhoneme}/</span>
                                        <i className="fas fa-arrow-right text-slate-300 text-[10px]"></i>
                                        <span className="text-base font-mono text-red-500 line-through decoration-2 opacity-70">/{error.actualPhonemeLike}/</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        playAudio(cleanWord, 0.8);
                                    }}
                                    disabled={isPlaying}
                                    className={`w-10 h-10 rounded-full bg-white border border-emerald-100 shadow-sm flex items-center justify-center transition-all transform 
                                        ${isPlaying 
                                            ? 'opacity-50 cursor-not-allowed text-slate-300' 
                                            : 'text-emerald-500 hover:bg-emerald-500 hover:text-white hover:scale-110 active:scale-95'}`}
                                    title="播放该单词发音"
                                >
                                    <i className={`fas ${isPlaying ? 'fa-volume-mute' : 'fa-volume-up'} text-sm`}></i>
                                </button>
                            </div>

                            {/* Body: Correction Advice */}
                            <div className="p-4">
                                <div className="mb-3">
                                    <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                        <i className="fas fa-teeth-open"></i> 发音矫正
                                    </h5>
                                    <p className="text-slate-600 text-xs leading-relaxed font-medium text-justify">
                                        {error.tip}
                                    </p>
                                </div>
                                
                                {/* Compact Contrast Example */}
                                <div className="bg-slate-50/50 p-2 rounded-lg border border-slate-100 flex items-start gap-2">
                                    <div className="mt-0.5 text-emerald-500 text-[10px] shrink-0"><i className="fas fa-lightbulb"></i></div>
                                    <div className="text-[10px] text-slate-500 leading-snug">
                                        <span className="font-bold text-slate-600 mr-1">对比:</span> 
                                        {error.example}
                                    </div>
                                </div>
                            </div>

                            {/* Arrow (Desktop only) */}
                            <div className="hidden md:block absolute bottom-[-8px] left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-slate-100 rotate-45"></div>
                        </div>
                    </>
                )}
              </div>
            );
          } else {
             // Normal Word Tooltip Logic
             return (
                <div key={idx} className="relative inline-block z-10">
                    <span 
                        onClick={(e) => handleWordClick(e, idx)}
                        className={`transition-colors cursor-pointer px-1 rounded-lg border border-transparent 
                             ${isActive 
                                ? 'text-emerald-600 bg-emerald-50 border-emerald-200' 
                                : 'hover:text-emerald-600 hover:bg-slate-50'}`}
                    >
                        {word}
                    </span>

                    {isActive && (
                    <>
                        {/* Mobile Overlay Backdrop */}
                        <div 
                            className="fixed inset-0 bg-black/20 z-40 md:hidden" 
                            onClick={(e) => {
                                e.stopPropagation();
                                setActiveWordIndex(null);
                            }}
                        ></div>

                        {/* Normal Word Tooltip */}
                        <div 
                            onClick={(e) => e.stopPropagation()} 
                            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-xs md:absolute md:top-auto md:bottom-full md:left-1/2 md:mb-2 md:w-64 bg-white text-slate-700 text-sm rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.3)] border border-emerald-50 z-50 animate-fade-in-up md:origin-bottom"
                        >
                             <div className="p-4 flex items-center justify-between border-b border-emerald-50/50 bg-emerald-50/30 rounded-t-2xl">
                                <div className="flex flex-col">
                                    <span className="font-bold text-lg text-emerald-800">{cleanWord}</span>
                                    {vocabItem && <span className="text-[10px] text-emerald-500 uppercase font-black tracking-wider bg-white px-1.5 py-0.5 rounded border border-emerald-100 w-fit">{vocabItem.pos}</span>}
                                </div>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        playAudio(cleanWord, 0.9);
                                    }}
                                    disabled={isPlaying}
                                    className={`w-10 h-10 rounded-full bg-white border border-emerald-100 shadow-sm flex items-center justify-center transition-all transform 
                                        ${isPlaying 
                                            ? 'opacity-50 cursor-not-allowed text-slate-300' 
                                            : 'text-emerald-500 hover:bg-emerald-500 hover:text-white hover:scale-110 active:scale-95'}`}
                                >
                                    <i className={`fas ${isPlaying ? 'fa-volume-mute' : 'fa-volume-up'} text-sm`}></i>
                                </button>
                             </div>
                             
                             {vocabItem ? (
                                <div className="p-4 bg-white rounded-b-2xl">
                                    <div className="mb-2">
                                        <div className="text-sm font-bold text-slate-700 mb-1">{vocabItem.meaning}</div>
                                        <div className="text-xs text-slate-400 italic">"{vocabItem.usage}"</div>
                                    </div>
                                </div>
                             ) : (
                                <div className="p-3 bg-white rounded-b-2xl text-center">
                                    <span className="text-xs text-slate-400">点击小喇叭收听发音</span>
                                </div>
                             )}

                            {/* Arrow (Desktop only) */}
                            <div className="hidden md:block absolute bottom-[-8px] left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-b border-r border-emerald-50 rotate-45"></div>
                        </div>
                    </>
                    )}
                </div>
             );
          }
        })}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start font-['Nunito']">
        {/* Left Sidebar - Game Map (Fixed on Left for LG screens) */}
        <div className="lg:col-span-3 bg-white rounded-[2rem] shadow-sm border border-emerald-50 overflow-hidden sticky top-24">
            <div className="bg-emerald-50/50 p-6 border-b border-emerald-50 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                    <i className="fas fa-map-signs"></i>
                </div>
                <h3 className="font-bold tracking-wide text-emerald-900 text-lg">挑战地图</h3>
            </div>
            
            <div className="p-4 max-h-[calc(100vh-12rem)] overflow-y-auto custom-scrollbar">
                {/* Return to Input */}
                <button 
                    onClick={onBackToInput}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 transition-all mb-6 border border-dashed border-slate-200 hover:border-emerald-200 group"
                >
                    <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-white flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors shadow-sm">
                        <i className="fas fa-arrow-left"></i>
                    </div>
                    <div className="text-left">
                        <div className="text-xs font-bold text-slate-400 group-hover:text-emerald-400 uppercase">返回</div>
                        <span className="font-bold text-sm">重选单词</span>
                    </div>
                </button>

                {/* Level List */}
                <div className="relative pl-6 ml-5 border-l-2 border-slate-100 space-y-6 pb-6">
                    {sentences.map((s, idx) => {
                        // Only show up to unlocked + 1 (future preview)
                        if (idx > unlockedIndex + 1) return null;

                        const isActive = idx === currentIndex;
                        const isCompleted = idx < unlockedIndex;
                        const isLocked = idx > unlockedIndex;

                        return (
                            <div key={s.id} className={`relative transition-all duration-500 ${isActive ? 'scale-100 opacity-100' : 'opacity-80 hover:opacity-100'}`}>
                                {/* Connector Dot */}
                                <div className={`absolute -left-[33px] top-6 w-4 h-4 rounded-full border-4 z-10 transition-colors duration-300 box-content
                                    ${isActive ? 'bg-white border-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.2)]' : 
                                      isCompleted ? 'bg-emerald-300 border-white' : 'bg-slate-200 border-white'}`}>
                                      {isCompleted && <i className="fas fa-check text-[8px] text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></i>}
                                </div>

                                <button
                                    onClick={() => handleJumpToLevel(idx)}
                                    disabled={isLocked}
                                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all duration-300 group
                                        ${isActive 
                                            ? 'bg-emerald-50/50 text-emerald-900 border-emerald-100 shadow-lg shadow-emerald-50' 
                                            : isCompleted 
                                                ? 'bg-white text-slate-500 border-transparent hover:border-emerald-50 hover:bg-emerald-50/30' 
                                                : 'bg-slate-50/50 text-slate-300 border-transparent'
                                        }
                                    `}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span className={`text-xs font-extrabold uppercase tracking-wider ${isActive ? 'text-emerald-500' : 'text-slate-300'}`}>
                                            LEVEL {idx + 1}
                                        </span>
                                        {isActive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>}
                                    </div>
                                    <div className={`text-sm font-bold leading-snug ${isActive ? 'text-emerald-900' : ''} ${isLocked ? 'blur-[2px] select-none' : ''}`}>
                                        {s.english}
                                    </div>
                                    {isLocked && <div className="mt-2 text-xs text-slate-300 flex items-center gap-1"><i className="fas fa-lock"></i> 待解锁</div>}
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-9">
            {/* Progress Header */}
            <div className="mb-8 flex justify-between items-center bg-white px-6 py-4 rounded-[2rem] shadow-sm border border-emerald-50">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center bg-slate-50 px-3 py-1 rounded-full">
                    <i className="fas fa-layer-group mr-2 text-emerald-400"></i>
                    Difficulty: <span className="text-emerald-600 ml-1">{currentSentence.difficulty}</span>
                </span>
                <div className="flex items-center gap-4">
                    <span className="text-xs font-bold text-slate-300 uppercase hidden sm:inline">Progress</span>
                    <div className="w-24 sm:w-48 bg-slate-100 rounded-full h-3 overflow-hidden p-0.5">
                        <div 
                            className="bg-gradient-to-r from-emerald-300 to-emerald-400 h-full rounded-full transition-all duration-700 ease-out shadow-sm" 
                            style={{ width: `${((currentIndex + 1) / sentences.length) * 100}%` }}
                        ></div>
                    </div>
                    <span className="text-sm font-black text-emerald-500 w-12 text-right">{(currentIndex + 1)}<span className="text-slate-300 text-xs font-normal">/{sentences.length}</span></span>
                </div>
            </div>

            {/* Main Practice Card - UPDATED: No overflow hidden here to allow tooltips to pop out */}
            <div className="bg-white rounded-[3rem] shadow-[0_20px_60px_-10px_rgba(16,185,129,0.08)] border border-emerald-50/50 p-8 md:p-14 text-center mb-8 relative">
                
                {/* Background Decor Container - Clips the blob but sits behind content */}
                <div className="absolute inset-0 rounded-[3rem] overflow-hidden pointer-events-none">
                    {/* Decorative background blob */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50/50 rounded-full blur-3xl -mr-32 -mt-32"></div>
                </div>
                
                {/* Phonetics Helper */}
                <div className="relative mb-10 z-10">
                    <span className="text-slate-400 font-mono text-base bg-slate-50 px-6 py-2 rounded-full border border-slate-100 inline-block shadow-sm">
                        {currentSentence.phonetics}
                    </span>
                </div>

                {/* The Sentence */}
                <div className="relative mb-14 min-h-[140px] flex items-start justify-center z-20">
                    {renderSentenceWithFeedback()}
                </div>

                {/* Evaluation Feedback Area */}
                <div className={`transition-all duration-500 ease-in-out overflow-hidden relative z-10 ${isEvaluating || evaluation ? 'max-h-96 opacity-100 mb-10' : 'max-h-0 opacity-0 mb-0'}`}>
                    {isEvaluating && (
                        <div className="p-6 bg-emerald-50/30 rounded-3xl border border-emerald-100 flex flex-col items-center justify-center gap-3 text-emerald-600">
                            <i className="fas fa-circle-notch fa-spin text-3xl mb-2"></i>
                            <span className="font-bold tracking-tight">AI 语言学家正在分析您的发音...</span>
                        </div>
                    )}

                    {evaluation && !isEvaluating && (
                    <div className={`p-8 rounded-[2rem] border text-left shadow-sm relative overflow-hidden ${evaluation.score >= 80 ? 'bg-gradient-to-br from-emerald-50 to-white border-emerald-100' : 'bg-gradient-to-br from-orange-50 to-white border-orange-100'}`}>
                        <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start md:items-center">
                            <div className="flex-shrink-0 mx-auto md:mx-0">
                                <div className={`relative flex items-center justify-center w-24 h-24 rounded-full text-4xl font-black border-[6px] shadow-inner ${evaluation.score >= 80 ? 'bg-white text-emerald-500 border-emerald-100' : 'bg-white text-orange-400 border-orange-100'}`}>
                                    {evaluation.score}
                                    {evaluation.score >= 80 && <div className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs w-8 h-8 flex items-center justify-center rounded-full border-4 border-white"><i className="fas fa-star"></i></div>}
                                </div>
                            </div>
                            
                            <div className="flex-1 text-center md:text-left">
                                <h4 className={`font-bold text-2xl mb-2 flex items-center justify-center md:justify-start gap-2 ${evaluation.score >= 80 ? 'text-emerald-800' : 'text-orange-800'}`}>
                                    {evaluation.score >= 80 ? 'Excellent!' : 'Good Effort!'}
                                </h4>
                                <p className={`text-lg leading-relaxed font-medium mb-4 ${evaluation.score >= 80 ? 'text-emerald-600' : 'text-orange-700/80'}`}>
                                    {evaluation.feedback}
                                </p>
                                {evaluation.errors.length > 0 && (
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 rounded-xl text-slate-500 text-sm font-bold border border-slate-100 shadow-sm">
                                        <i className="fas fa-arrow-up text-orange-400"></i>
                                        点击上方红色单词查看纠音建议
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    )}
                </div>

                {/* Controls */}
                <div className="flex flex-wrap items-start justify-center gap-6 md:gap-10 relative z-10">
                    <button 
                        onClick={() => playAudio()}
                        disabled={isPlaying || isRecording}
                        className={`group w-16 h-16 rounded-2xl bg-white border border-emerald-100 flex items-center justify-center text-xl shadow-[0_10px_20px_-5px_rgba(0,0,0,0.05)] transition-all
                            ${isPlaying || isRecording
                                ? 'opacity-50 cursor-not-allowed bg-slate-50 text-slate-300 shadow-none'
                                : 'text-emerald-400 hover:bg-emerald-50 hover:text-emerald-500 hover:shadow-[0_15px_30px_-5px_rgba(16,185,129,0.15)] hover:-translate-y-1'
                            }`}
                        title="播放标准音"
                    >
                        <i className={`fas ${isPlaying ? 'fa-volume-high animate-pulse' : 'fa-volume-up transform group-hover:scale-110 transition-transform'}`}></i>
                    </button>

                    <div className="flex flex-col items-center gap-3">
                        <button 
                            onClick={toggleRecording}
                            disabled={isPlaying}
                            className={`w-16 h-16 rounded-2xl transition-all duration-300 transform flex items-center justify-center text-xl shadow-[0_10px_20px_-5px_rgba(16,185,129,0.3)]
                                ${isPlaying ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:-translate-y-1'}
                                ${isRecording 
                                    ? 'bg-red-500 text-white shadow-red-200 scale-105 ring-4 ring-red-100' 
                                    : 'bg-gradient-to-tr from-emerald-400 to-emerald-300 text-white hover:shadow-emerald-200'}`}
                            title={isRecording ? "停止录音" : "开始跟读"}
                        >
                            <div className={`relative z-10 ${isRecording ? 'animate-pulse' : ''}`}>
                                <i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'}`}></i>
                            </div>
                            {!isRecording && !isPlaying && <div className="absolute inset-0 bg-white opacity-20 rounded-[2rem] scale-0 group-hover:scale-100 transition-transform rounded-full"></div>}
                        </button>
                        <span className={`text-xs font-bold uppercase tracking-widest ${isRecording ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>
                            {isRecording ? "点击完成" : "点击跟读"}
                        </span>
                    </div>

                    {evaluation && (
                        <button 
                            onClick={handleNext}
                            className="w-16 h-16 rounded-2xl bg-slate-800 text-white hover:bg-slate-700 transition-all flex items-center justify-center text-xl shadow-lg hover:shadow-xl hover:-translate-y-1 animate-bounce-short"
                            title="下一句"
                        >
                            <i className="fas fa-arrow-right"></i>
                        </button>
                    )}
                </div>
            </div>

            {/* Analysis Panel - Shown after evaluation */}
            {showAnalysis && (
                <div className="animate-slide-up pb-20">
                    <AnalysisPanel sentence={currentSentence} />
                </div>
            )}
        </div>
    </div>
  );
};

export default PracticeSession;
