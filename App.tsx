import React, { useState } from 'react';
import { AppStep, SentenceData } from './types';
import { generateCurriculum } from './services/geminiService';
import InputSection from './components/InputSection';
import PracticeSession from './components/PracticeSession';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.INPUT);
  const [sentences, setSentences] = useState<SentenceData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleStart = async (words: string[]) => {
    setIsGenerating(true);
    // Note: We stay on AppStep.INPUT to show the loading state on the same button
    
    try {
      const data = await generateCurriculum(words);
      setSentences(data);
      setStep(AppStep.PRACTICE);
    } catch (error) {
      console.error(error);
      alert('生成课程失败，请重试。');
      // Stay on input step
    } finally {
      setIsGenerating(false);
    }
  };

  const handleComplete = () => {
    setStep(AppStep.COMPLETED);
  };

  const handleReset = () => {
    setStep(AppStep.INPUT);
    setSentences([]);
    setIsGenerating(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-['Nunito']">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-md transform rotate-3">
              <i className="fas fa-leaf text-base"></i>
            </div>
            <h1 className="font-extrabold text-slate-800 text-xl tracking-tight">Linguist AI</h1>
          </div>
          {step !== AppStep.INPUT && (
            <button 
              onClick={handleReset}
              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all font-semibold"
            >
              <i className="fas fa-times mr-2"></i>退出练习
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8">
        {step === AppStep.INPUT && (
          <div className="mt-8 animate-fade-in w-full">
            <InputSection onStart={handleStart} isLoading={isGenerating} />
          </div>
        )}

        {/* Removed the dedicated GENERATING step view as requested */}

        {step === AppStep.PRACTICE && sentences.length > 0 && (
          <PracticeSession 
            sentences={sentences} 
            onComplete={handleComplete} 
            onBackToInput={handleReset}
          />
        )}

        {step === AppStep.COMPLETED && (
          <div className="max-w-xl mx-auto mt-12 text-center bg-white p-12 rounded-[2.5rem] shadow-xl border border-slate-100 animate-slide-up">
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 text-4xl shadow-lg transform -rotate-6">
              <i className="fas fa-trophy"></i>
            </div>
            <h2 className="text-4xl font-extrabold text-slate-800 mb-4">挑战完成！</h2>
            <p className="text-slate-600 mb-10 text-xl leading-relaxed">
              恭喜您完成了所有 20 个句子的强化训练。<br/>您的词汇运用能力和发音水平已得到显著提升。
            </p>
            <button
              onClick={handleReset}
              className="px-12 py-5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-2xl hover:shadow-xl hover:shadow-green-200 hover:-translate-y-1 transition-all duration-200"
            >
              <i className="fas fa-redo-alt mr-2"></i>开启新课程
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;