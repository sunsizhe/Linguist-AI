import React, { useState, useEffect, useRef } from 'react';
import { SentenceData, EvaluationResult } from '../types';
import { generateSentenceImage, evaluatePronunciation, generateSpeech } from '../services/geminiService';
import AnalysisPanel from './AnalysisPanel';

interface PracticeSessionProps {
  sentences: SentenceData[];
  onComplete: () => void;
  onBackToInput: () => void;
  enableImages?: boolean;
}

const LEVELS_PER_STAGE = 15;

// --- Audio Decoding Helpers ---
function base64ToBytes(base64: string) {
  const binaryString = atob(base64);
  const length = binaryString.length;
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function decodePCM(data: Uint8Array, ctx: AudioContext) {
  const sampleRate = 24000; // Gemini TTS standard rate
  const numChannels = 1;
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

const PracticeSession: React.FC<PracticeSessionProps> = ({ sentences, onComplete, onBackToInput, enableImages = true }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [unlockedIndex, setUnlockedIndex] = useState(0); 
  const [activeStage, setActiveStage] = useState(0); // For sidebar display

  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false); 
  const [isAudioLoading, setIsAudioLoading] = useState(false); // New state for AI audio fetch
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  // Current session state
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);
  const [showText, setShowText] = useState(true); // Control text visibility for listening practice
  
  // History state
  const [history, setHistory] = useState<Record<number, EvaluationResult>>({});
  
  // Image Cache
  const [sentenceImages, setSentenceImages] = useState<Record<number, string>>({});
  const [loadingImage, setLoadingImage] = useState(false);

  // Audio Cache & Context
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioCacheRef = useRef<Record<string, AudioBuffer>>({});
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const currentSentence = sentences[currentIndex];
  const totalStages = Math.ceil(sentences.length / LEVELS_PER_STAGE);
  
  // Web Speech API refs
  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef<string>(''); // Current session transcript
  const fullTranscriptRef = useRef<string>(''); // Accumulated transcript across restarts
  const userStoppedRef = useRef<boolean>(false); // Did the user explicitly click stop?
  
  const audioTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); 
  // Track current index in ref for async callbacks
  const currentIndexRef = useRef(currentIndex);

  // Sync Active Stage with Current Index when moving between levels
  useEffect(() => {
    currentIndexRef.current = currentIndex;
    const calculatedStage = Math.floor(currentIndex / LEVELS_PER_STAGE);
    if (calculatedStage !== activeStage) {
        setActiveStage(calculatedStage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

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

  // Initialize AudioContext
  useEffect(() => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContext) {
        audioContextRef.current = new AudioContext();
    }
    return () => {
        audioContextRef.current?.close();
    };
  }, []);

  // 1. Image Generation Effect (Load Current & Preload Next)
  useEffect(() => {
    if (!enableImages) return;

    // A. Load Current Level Image (with loading state)
    if (!sentenceImages[currentIndex]) {
        setLoadingImage(true);
        generateSentenceImage(sentences[currentIndex].english)
            .then(imageUrl => {
                if (imageUrl) {
                    setSentenceImages(prev => ({...prev, [currentIndex]: imageUrl}));
                }
            })
            .catch(e => console.error("Failed to generate image", e))
            .finally(() => setLoadingImage(false));
    }

    // B. Preload Next Level Image (Silent background process)
    const nextIndex = currentIndex + 1;
    if (nextIndex < sentences.length && !sentenceImages[nextIndex]) {
        // We use a separate async call here so we don't block anything
        generateSentenceImage(sentences[nextIndex].english)
            .then(imageUrl => {
                if (imageUrl) {
                    setSentenceImages(prev => ({...prev, [nextIndex]: imageUrl}));
                }
            })
            .catch(e => console.error("Failed to preload next image", e));
    }
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, enableImages]);


  // 2. Centralized State Restoration/Reset when changing levels
  useEffect(() => {
    // Stop any ongoing audio/recording when switching levels
    if (audioTimerRef.current) clearTimeout(audioTimerRef.current);
    window.speechSynthesis.cancel();
    if (activeSourceRef.current) {
        try { activeSourceRef.current.stop(); } catch(e) {}
        activeSourceRef.current = null;
    }
    
    // Stop recording completely
    if (recognitionRef.current) {
        userStoppedRef.current = true; // Prevent auto-restart in onend
        recognitionRef.current.abort();
    }
    transcriptRef.current = '';
    fullTranscriptRef.current = '';
    
    setIsPlaying(false);
    setIsRecording(false);
    setIsEvaluating(false);
    setIsAudioLoading(false);
    setActiveWordIndex(null);

    // Check history
    const savedResult = history[currentIndex];
    if (savedResult) {
        // Restore "Practiced" state
        setEvaluation(savedResult);
        setShowAnalysis(true); 
    } else {
        // New Level
        setEvaluation(null);
        setShowAnalysis(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]); 

  // Handle Recording Completion -> Analyze Pronunciation
  const handleRecordingComplete = async (transcript: string) => {
    if (!transcript.trim()) return;
    
    const recordingIndex = currentIndexRef.current;
    setIsEvaluating(true);
    
    try {
        // Call the correction service (not image generation)
        const result = await evaluatePronunciation(sentences[recordingIndex].english, transcript);
        
        // Guard: If user moved to another level during analysis, DO NOT update state
        if (currentIndexRef.current !== recordingIndex) {
            console.log("Ignored stale evaluation result");
            return;
        }

        setEvaluation(result);
        // Save to history
        setHistory(prev => ({...prev, [recordingIndex]: result}));
        setShowAnalysis(true);
    } catch (e) {
        console.error("Evaluation failed", e);
    } finally {
        if (currentIndexRef.current === recordingIndex) {
            setIsEvaluating(false);
        }
    }
  };

  useEffect(() => {
    // Initialize Speech Recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true; 
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event: any) => {
        let finalTrans = '';
        let interimTrans = '';
        for (let i = 0; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTrans += event.results[i][0].transcript;
            } else {
                interimTrans += event.results[i][0].transcript;
            }
        }
        transcriptRef.current = finalTrans + interimTrans;
      };

      recognitionRef.current.onerror = (event: any) => {
        // Abort/No-speech is handled by onend usually, but 'not-allowed' is critical
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
             userStoppedRef.current = true; // Stop loop
             setIsRecording(false);
             alert("无法访问麦克风，请检查权限设置。");
        }
      };
      
      recognitionRef.current.onend = () => {
          if (userStoppedRef.current) {
              // Case 1: User explicitly stopped. Process the result.
              setIsRecording(false);
              
              const totalText = (fullTranscriptRef.current + ' ' + transcriptRef.current).trim();
              
              if (totalText.length > 0) {
                 handleRecordingComplete(totalText);
              }
              // Reset buffers
              fullTranscriptRef.current = '';
              transcriptRef.current = '';
          } else {
              // Case 2: Browser stopped automatically (silence, network). Restart it.
              // Save what we have so far
              if (transcriptRef.current) {
                  fullTranscriptRef.current += ' ' + transcriptRef.current;
                  transcriptRef.current = '';
              }
              
              // Restart immediately to simulate infinite listening
              try {
                  recognitionRef.current.start();
              } catch (e) {
                  console.error("Failed to restart recognition", e);
                  setIsRecording(false); 
              }
          }
      };
    }
    
    return () => {
        if (recognitionRef.current) {
            userStoppedRef.current = true;
            recognitionRef.current.abort();
        }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]); 

  const playBrowserTTS = (text: string, rate: number = 0.9) => {
      const synth = window.speechSynthesis;
      if (audioTimerRef.current) clearTimeout(audioTimerRef.current);
      synth.cancel();
      setIsPlaying(true);
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = rate;
      
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);
      
      synth.speak(utterance);
  };

  const playAudio = async (text: string = currentSentence.english, rate: number = 0.9) => {
    if (isPlaying || isRecording || isAudioLoading) return; 

    // Cancel any browser TTS
    window.speechSynthesis.cancel();
    if (audioTimerRef.current) clearTimeout(audioTimerRef.current);

    setIsAudioLoading(true);

    try {
        // 1. Check Cache
        let buffer = audioCacheRef.current[text];

        // 2. If not cached, fetch from Gemini
        if (!buffer) {
            const base64Data = await generateSpeech(text);
            
            if (!base64Data) {
                // Fallback to browser TTS
                console.warn("AI Voice generation failed, using browser fallback.");
                setIsAudioLoading(false);
                playBrowserTTS(text, rate);
                return;
            }

            // Decode PCM
            if (!audioContextRef.current) {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                audioContextRef.current = new AudioContext();
            }
            // Resume context (browser policy often suspends it)
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }
            
            const bytes = base64ToBytes(base64Data);
            buffer = decodePCM(bytes, audioContextRef.current);
            
            // Cache it
            audioCacheRef.current[text] = buffer;
        }

        // 3. Play AudioBuffer
        if (audioContextRef.current && buffer) {
             // Stop previous source if any
             if (activeSourceRef.current) {
                 try { activeSourceRef.current.stop(); } catch(e){}
             }

             const source = audioContextRef.current.createBufferSource();
             source.buffer = buffer;
             source.playbackRate.value = rate; // Support speed control
             source.connect(audioContextRef.current.destination);
             
             activeSourceRef.current = source;
             
             source.onended = () => {
                 setIsPlaying(false);
                 activeSourceRef.current = null;
             };
             
             setIsAudioLoading(false); // Done loading, starting playback
             setIsPlaying(true);
             source.start();
        } else {
            throw new Error("Audio Context not available");
        }

    } catch (e) {
        console.error("Audio Playback Error:", e);
        setIsAudioLoading(false);
        playBrowserTTS(text, rate); // Fallback
    }
  };

  const toggleRecording = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    if (!recognitionRef.current) {
        alert("您的浏览器不支持语音识别。");
        return;
    }

    if (isRecording) {
      // User wants to STOP
      userStoppedRef.current = true;
      recognitionRef.current.stop();
    } else {
      // User wants to START
      if (isPlaying) {
          if (audioTimerRef.current) clearTimeout(audioTimerRef.current);
          window.speechSynthesis.cancel();
          if (activeSourceRef.current) {
             try { activeSourceRef.current.stop(); } catch(e){}
          }
          setIsPlaying(false);
      }
      
      setEvaluation(null);
      setActiveWordIndex(null); 
      
      transcriptRef.current = ''; 
      fullTranscriptRef.current = '';
      userStoppedRef.current = false;
      
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error("Mic start error", e);
        setIsRecording(false);
      }
    }
  };

  const toggleTextVisibility = () => {
    if (showText) {
        setActiveWordIndex(null); // Close tooltips when hiding text
    }
    setShowText(!showText);
  };

  const playSuccessSound = () => {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      try {
          const ctx = new AudioContext();
          const playNote = (freq: number, startTime: number) => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.frequency.value = freq;
              osc.type = 'sine';
              gain.gain.setValueAtTime(0.05, startTime);
              gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start(startTime);
              osc.stop(startTime + 0.4);
          };
          const now = ctx.currentTime;
          playNote(523.25, now);       // C5
          playNote(659.25, now + 0.1); // E5
          playNote(783.99, now + 0.2); // G5
      } catch (e) {
          console.error("Audio Play Error", e);
      }
  };

  const handleNext = () => {
    playSuccessSound();
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
        setCurrentIndex(index);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleWordClick = (e: React.MouseEvent, idx: number) => {
      e.stopPropagation(); 
      if (!showText) return; // Disable click when hidden
      setActiveWordIndex(activeWordIndex === idx ? null : idx);
  };

  const renderSentenceWithFeedback = () => {
    // Use the detailed words array if available, otherwise fallback to simple split
    const words = currentSentence.words || currentSentence.english.split(' ').map(t => ({ text: t, ipa: '' }));
    
    return (
      <div className={`flex flex-wrap justify-center gap-x-1 gap-y-2 z-0 transition-all duration-300 ${!showText ? 'blur-md select-none grayscale opacity-60' : 'blur-0 opacity-100'}`}>
        {words.map((wordObj, idx) => {
          const wordText = wordObj.text;
          const cleanWord = wordText.replace(/[.,!?;:"'()]/g, '').toLowerCase();
          
          // Check for errors in the current evaluation
          const error = evaluation?.errors?.find(e => e.word.toLowerCase() === cleanWord);
          const vocabItem = currentSentence.vocabAnalysis?.find(v => v.word.toLowerCase() === cleanWord);
          const isActive = activeWordIndex === idx;
          
          // Tooltip content logic
          let TooltipContent = null;

          if (error) {
            // ERROR TOOLTIP
            TooltipContent = (
               <div className="max-h-[50vh] md:max-h-[300px] overflow-y-auto custom-scrollbar rounded-2xl bg-white">
                  <div className="p-3 flex items-center justify-between border-b border-red-50/50 bg-red-50/30 sticky top-0 z-10 backdrop-blur-sm">
                      <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                              <span className="font-bold text-lg text-red-600 line-through decoration-2 decoration-red-300/50">{wordText}</span>
                              <span className="font-mono text-sm text-emerald-600 bg-emerald-50 px-1.5 rounded">/{error.expectedPhoneme || wordObj.ipa}/</span>
                          </div>
                          {vocabItem && <span className="text-xs font-bold text-slate-500 mt-1">{vocabItem.meaning}</span>}
                      </div>
                      <button 
                          onClick={(e) => {
                              e.stopPropagation();
                              // Use AI audio for words too for consistency, or fallback to browser if slow
                              playAudio(cleanWord, 0.9);
                          }}
                          disabled={isPlaying}
                          className="w-8 h-8 rounded-full bg-white border border-red-100 shadow-sm flex items-center justify-center text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all"
                      >
                          <i className="fas fa-volume-up text-xs"></i>
                      </button>
                  </div>
                  
                  <div className="p-3 space-y-3">
                      <div className="flex items-start gap-2 text-[10px] text-slate-600 leading-tight">
                          <i className="fas fa-exclamation-triangle text-red-400 mt-0.5 shrink-0"></i>
                          <div>
                              <span className="font-bold text-red-500 block mb-0.5">发音纠正</span>
                              {error.tip}
                          </div>
                      </div>
                      <div className="flex items-start gap-2 bg-slate-50 p-2 rounded-lg text-[10px] text-slate-500 border border-slate-100">
                          <i className="fas fa-exchange-alt text-slate-400 mt-0.5 shrink-0"></i>
                          <span><span className="font-bold">对比:</span> {error.example}</span>
                      </div>
                  </div>
               </div>
            );
          } else {
             // NORMAL TOOLTIP
             TooltipContent = (
                <div className="max-h-[50vh] md:max-h-[300px] overflow-y-auto custom-scrollbar rounded-2xl bg-white">
                    <div className="p-3 flex items-center justify-between border-b border-emerald-50/50 bg-emerald-50/30 sticky top-0 z-10 backdrop-blur-sm">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-lg text-emerald-800">{cleanWord}</span>
                                {wordObj.ipa && (
                                    <span className="font-mono text-xs text-emerald-600/80">/{wordObj.ipa}/</span>
                                )}
                            </div>
                            {vocabItem && <span className="text-[10px] text-emerald-500 uppercase font-black tracking-wider bg-white px-1.5 py-0.5 rounded border border-emerald-100 w-fit mt-1">{vocabItem.pos}</span>}
                        </div>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                playAudio(cleanWord, 0.9);
                            }}
                            disabled={isPlaying}
                            className="w-8 h-8 rounded-full bg-white border border-emerald-100 shadow-sm flex items-center justify-center text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all"
                        >
                            <i className="fas fa-volume-up text-xs"></i>
                        </button>
                    </div>
                    
                    {vocabItem ? (
                        <div className="p-3 bg-white">
                            <div className="mb-2">
                                <div className="text-sm font-bold text-slate-700 mb-1">{vocabItem.meaning}</div>
                                <div className="text-xs text-slate-400 italic">"{vocabItem.usage}"</div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3 bg-white text-center">
                            <span className="text-xs text-slate-400">点击小喇叭收听发音</span>
                        </div>
                    )}
                </div>
             );
          }

          return (
            <div key={idx} className={`relative group flex flex-col items-center ${showText ? 'cursor-pointer' : 'cursor-default'} ${isActive ? 'z-[60]' : 'z-10'}`} onClick={(e) => handleWordClick(e, idx)}>
                <span 
                    className={`transition-all px-1.5 py-0.5 rounded-lg border-b-2 text-xl md:text-2xl font-bold font-['Nunito']
                            ${error 
                                ? isActive ? 'text-red-600 bg-red-50 border-red-300' : 'text-red-500 border-red-200 bg-red-50/30 hover:bg-red-50'
                                : isActive ? 'text-emerald-700 bg-emerald-50 border-emerald-300' : 'text-slate-700 border-transparent hover:text-emerald-600 hover:bg-slate-50'
                            }`}
                >
                    {wordText}
                </span>
                
                {/* IPA Display under word */}
                {wordObj.ipa && (
                    <span className={`text-[11px] font-mono mt-0.5 transition-colors ${error ? 'text-red-400' : 'text-slate-400 group-hover:text-emerald-400'}`}>
                        /{wordObj.ipa}/
                    </span>
                )}

                {isActive && showText && (
                <>
                    <div 
                        className="fixed inset-0 bg-black/20 z-[90] md:hidden" 
                        onClick={(e) => {
                            e.stopPropagation();
                            setActiveWordIndex(null);
                        }}
                    ></div>

                    <div 
                        onClick={(e) => e.stopPropagation()} 
                        className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-xs md:absolute md:top-auto md:bottom-full md:left-1/2 md:mb-2 md:translate-y-0 md:w-72 z-[100] animate-fade-in-up md:origin-bottom"
                    >
                            <div className={`bg-white rounded-2xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.3)] border relative ${error ? 'border-red-100' : 'border-emerald-50'}`}>
                            {TooltipContent}
                            <div className={`hidden md:block absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-4 h-4 bg-white border-b border-r rotate-45 ${error ? 'border-red-100' : 'border-emerald-50'}`}></div>
                            </div>
                    </div>
                </>
                )}
            </div>
          );
        })}
      </div>
    );
  };

  // Get current generated image
  const currentImage = sentenceImages[currentIndex];

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start font-['Nunito']">
        {/* Left Sidebar */}
        <div className="md:col-span-4 lg:col-span-3 bg-white rounded-[2rem] shadow-sm border border-emerald-50 overflow-hidden sticky top-24 flex flex-col max-h-[calc(100vh-8rem)]">
            <div className="bg-emerald-50/50 p-6 border-b border-emerald-50 flex items-center gap-3 shrink-0">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                    <i className="fas fa-map-signs"></i>
                </div>
                <div>
                    <h3 className="font-bold tracking-wide text-emerald-900 text-lg">挑战地图</h3>
                    {totalStages > 1 && (
                        <p className="text-[10px] text-emerald-600/70 font-bold uppercase">Stage {activeStage + 1} of {totalStages}</p>
                    )}
                </div>
            </div>

            {/* Stage Selector (Only if > 1 stage) */}
            {totalStages > 1 && (
                <div className="px-4 py-3 bg-white border-b border-slate-100 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
                    {Array.from({ length: totalStages }).map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveStage(idx)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border
                                ${activeStage === idx 
                                    ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' 
                                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'}`}
                        >
                            Stage {idx + 1}
                        </button>
                    ))}
                </div>
            )}
            
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                <button 
                    onClick={onBackToInput}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl text-slate-500 hover:bg-emerald-50 hover:text-emerald-700 transition-all mb-6 border border-dashed border-slate-200 hover:border-emerald-200 group shrink-0"
                >
                    <div className="w-10 h-10 rounded-full bg-slate-50 group-hover:bg-white flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors shadow-sm">
                        <i className="fas fa-arrow-left"></i>
                    </div>
                    <div className="text-left">
                        <div className="text-xs font-bold text-slate-400 group-hover:text-emerald-400 uppercase">返回</div>
                        <span className="font-bold text-sm">重选内容</span>
                    </div>
                </button>

                <div className="relative pl-6 ml-5 border-l-2 border-slate-100 space-y-2 pb-6">
                    {sentences.map((s, idx) => {
                        // Only show levels for the active stage
                        const start = activeStage * LEVELS_PER_STAGE;
                        const end = start + LEVELS_PER_STAGE;
                        if (idx < start || idx >= end) return null;

                        // Visual Index relative to stage (1-15)
                        const levelNum = (idx % LEVELS_PER_STAGE) + 1;
                        
                        const isActive = idx === currentIndex;
                        const isCompleted = idx < unlockedIndex || history[idx]; 
                        const isLocked = idx > unlockedIndex;

                        return (
                            <div key={s.id || idx} className={`relative transition-all duration-500 ${isActive ? 'scale-100 opacity-100' : 'opacity-80 hover:opacity-100'}`}>
                                <div className={`absolute -left-[33px] top-1/2 transform -translate-y-1/2 w-4 h-4 rounded-full border-4 z-10 transition-colors duration-300 box-content
                                    ${isActive ? 'bg-white border-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.2)]' : 
                                      isCompleted ? 'bg-emerald-300 border-white' : 'bg-slate-200 border-white'}`}>
                                      {isCompleted && <i className="fas fa-check text-[8px] text-white absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2"></i>}
                                </div>

                                <button
                                    onClick={() => handleJumpToLevel(idx)}
                                    disabled={isLocked}
                                    className={`w-full text-left p-2.5 rounded-2xl border-2 transition-all duration-300 group
                                        ${isActive 
                                            ? 'bg-emerald-50/50 text-emerald-900 border-emerald-100 shadow-lg shadow-emerald-50' 
                                            : isCompleted 
                                                ? 'bg-white text-slate-500 border-transparent hover:border-emerald-50 hover:bg-emerald-50/30' 
                                                : 'bg-slate-50/50 text-slate-300 border-transparent'
                                        }
                                    `}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className={`text-xs font-extrabold uppercase tracking-wider ${isActive ? 'text-emerald-500' : 'text-slate-300'}`}>
                                            LEVEL {levelNum}
                                        </span>
                                        {isActive && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>}
                                    </div>
                                    <div className={`text-sm font-bold leading-snug line-clamp-2 ${isActive ? 'text-emerald-900' : ''} ${isLocked ? 'blur-[2px] select-none' : ''}`}>
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
        <div className="md:col-span-8 lg:col-span-9">
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

            {/* Main Practice Card */}
            <div className={`bg-white rounded-[3rem] shadow-[0_20px_60px_-10px_rgba(16,185,129,0.08)] border border-emerald-50/50 p-8 md:p-14 text-center mb-8 relative ${!enableImages ? 'pt-20' : ''}`}>
                
                {/* 1. SCENE IMAGE (Top of card, auto generated) - Only if enabled */}
                {enableImages && (
                    <div className="relative z-10 mb-8 flex justify-center w-full">
                         {currentImage ? (
                            <div className="rounded-[2rem] overflow-hidden shadow-lg border-4 border-white max-w-sm w-full animate-fade-in-up">
                                <img src={currentImage} alt="Scene" className="w-full h-auto object-cover aspect-[4/3]" />
                            </div>
                         ) : (
                            <div className="w-full max-w-sm aspect-[4/3] bg-emerald-50/30 rounded-[2rem] border-2 border-dashed border-emerald-100 flex flex-col items-center justify-center text-emerald-300 gap-2">
                                {loadingImage ? (
                                    <>
                                        <i className="fas fa-paint-brush animate-bounce text-2xl"></i>
                                        <span className="text-sm font-bold animate-pulse">Drawing Scene...</span>
                                    </>
                                ) : (
                                    <i className="fas fa-image text-3xl"></i>
                                )}
                            </div>
                         )}
                    </div>
                )}
                
                {/* Fallback decorative icon if no image */}
                {!enableImages && (
                    <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                        <i className="fas fa-quote-right text-9xl text-emerald-600"></i>
                    </div>
                )}

                {/* Background Decor */}
                <div className="absolute inset-0 rounded-[3rem] overflow-hidden pointer-events-none">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50/50 rounded-full blur-3xl -mr-32 -mt-32"></div>
                </div>
                
                {/* 3. SENTENCE (Interactive text with IPA under words) */}
                <div className="relative mb-12 min-h-[100px] flex items-start justify-center z-20">
                    {renderSentenceWithFeedback()}
                </div>
                
                {/* Evaluation Loading State */}
                {isEvaluating && (
                    <div className="mb-8 font-bold text-emerald-500 animate-pulse flex items-center justify-center gap-2">
                        <i className="fas fa-spinner fa-spin"></i>
                        AI 正在分析您的发音...
                    </div>
                )}
                
                {/* Feedback Message (If any, mostly encouragement) */}
                {evaluation && evaluation.feedback && !isEvaluating && (
                     <div className="mb-8 text-emerald-600 font-medium bg-emerald-50/50 inline-block px-4 py-2 rounded-xl text-sm border border-emerald-100 animate-fade-in">
                        <i className="fas fa-check-circle mr-2"></i>
                        {evaluation.feedback}
                     </div>
                )}

                {/* 4. CONTROLS */}
                <div className="flex flex-wrap items-start justify-center gap-6 md:gap-8 relative z-10">
                    <button 
                        onClick={() => playAudio()}
                        disabled={isPlaying || isRecording || isAudioLoading}
                        className={`group w-16 h-16 rounded-2xl bg-white border border-emerald-100 flex items-center justify-center text-xl shadow-[0_10px_20px_-5px_rgba(0,0,0,0.05)] transition-all
                            ${isPlaying || isRecording || isAudioLoading
                                ? 'opacity-50 cursor-not-allowed bg-slate-50 text-slate-300 shadow-none'
                                : 'text-emerald-400 hover:bg-emerald-50 hover:text-emerald-500 hover:shadow-[0_15px_30px_-5px_rgba(16,185,129,0.15)] hover:-translate-y-1'
                            }`}
                        title="播放标准音"
                    >
                        {isAudioLoading ? (
                            <i className="fas fa-circle-notch fa-spin"></i>
                        ) : (
                            <i className={`fas ${isPlaying ? 'fa-volume-high animate-pulse' : 'fa-volume-up transform group-hover:scale-110 transition-transform'}`}></i>
                        )}
                    </button>

                    <div className="flex flex-col items-center gap-3">
                        <button 
                            onClick={toggleRecording}
                            disabled={isPlaying || isEvaluating}
                            className={`w-16 h-16 rounded-2xl transition-all duration-300 transform flex items-center justify-center text-xl shadow-[0_10px_20px_-5px_rgba(16,185,129,0.3)]
                                ${isPlaying || isEvaluating ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:-translate-y-1'}
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

                    <button 
                        onClick={toggleTextVisibility}
                        className={`group w-16 h-16 rounded-2xl bg-white border border-emerald-100 flex items-center justify-center text-xl shadow-[0_10px_20px_-5px_rgba(0,0,0,0.05)] transition-all
                            ${!showText 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-inner' 
                                : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-500 hover:shadow-[0_15px_30px_-5px_rgba(16,185,129,0.15)] hover:-translate-y-1'}`}
                        title={showText ? "隐藏文本 (盲听模式)" : "显示文本"}
                    >
                        <i className={`fas ${showText ? 'fa-eye' : 'fa-eye-slash'}`}></i>
                    </button>

                    <button 
                        onClick={() => setShowAnalysis(!showAnalysis)}
                        className={`group w-16 h-16 rounded-2xl bg-white border border-emerald-100 flex items-center justify-center text-xl shadow-[0_10px_20px_-5px_rgba(0,0,0,0.05)] transition-all
                            ${showAnalysis 
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200 shadow-inner' 
                                : 'text-slate-400 hover:bg-emerald-50 hover:text-emerald-500 hover:shadow-[0_15px_30px_-5px_rgba(16,185,129,0.15)] hover:-translate-y-1'}`}
                        title={showAnalysis ? "隐藏解析" : "查看解析"}
                    >
                        <i className="fas fa-glasses"></i>
                    </button>

                    {evaluation && (
                        <button 
                            onClick={handleNext}
                            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-500 text-white hover:from-sky-500 hover:to-blue-600 transition-all flex items-center justify-center text-xl shadow-lg hover:shadow-sky-200 hover:-translate-y-1 animate-bounce-short"
                            title="下一句"
                        >
                            <i className="fas fa-arrow-right"></i>
                        </button>
                    )}
                </div>
            </div>

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