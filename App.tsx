
import React, { useState } from 'react';
import { AppStep, SentenceData } from './types';
import { generateArticleCurriculum, generateVocabCurriculum } from './services/geminiService';
import InputSection from './components/InputSection';
import PracticeSession from './components/PracticeSession';

type ModuleType = 'article' | 'vocab' | 'scenario' | 'proficiency';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.INPUT);
  const [sentences, setSentences] = useState<SentenceData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Sidebar state
  const [activeModule, setActiveModule] = useState<ModuleType>('article');

  const handleStart = async (text: string) => {
    setIsGenerating(true);
    // Note: We stay on AppStep.INPUT to show the loading state on the same button
    
    try {
      let data: SentenceData[] = [];
      
      if (activeModule === 'article') {
        data = await generateArticleCurriculum(text);
      } else if (activeModule === 'vocab') {
        data = await generateVocabCurriculum(text);
      } else {
        // Fallback or future modules
        data = await generateArticleCurriculum(text);
      }

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

  // Sidebar Menu Items
  const menuItems = [
    { id: 'article', label: '自定义文章', sub: 'Article & Text', icon: 'fa-book-open', color: 'from-green-400 to-emerald-500' },
    { id: 'vocab', label: '自定义单词', sub: 'Vocabulary List', icon: 'fa-tags', color: 'from-amber-400 to-orange-500' },
    { id: 'scenario', label: '场景实战', sub: 'Coming Soon', icon: 'fa-briefcase', color: 'from-slate-300 to-slate-400' },
    { id: 'proficiency', label: '能力分级', sub: 'Coming Soon', icon: 'fa-layer-group', color: 'from-slate-300 to-slate-400' },
  ];

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
        
        {step === AppStep.INPUT ? (
          <div className="mt-4 flex flex-col md:flex-row gap-8 animate-fade-in items-start">
            
            {/* Sidebar Navigation */}
            <aside className="w-full md:w-64 lg:w-72 shrink-0 space-y-4">
               <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100 sticky top-24">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-4 mb-4 mt-2">Course Modules</h2>
                  <div className="space-y-2">
                    {menuItems.map((item) => {
                      const isActive = activeModule === item.id;
                      const isDisabled = item.id === 'scenario' || item.id === 'proficiency';
                      return (
                        <button
                          key={item.id}
                          onClick={() => !isDisabled && setActiveModule(item.id as ModuleType)}
                          disabled={isDisabled}
                          className={`w-full text-left p-4 rounded-2xl transition-all duration-300 group relative overflow-hidden
                            ${isActive 
                              ? `bg-gradient-to-br ${item.color} text-white shadow-lg transform scale-[1.02]` 
                              : isDisabled
                                ? 'bg-slate-50 text-slate-300 cursor-not-allowed opacity-60'
                                : 'bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-700'
                            }
                          `}
                        >
                          <div className="relative z-10 flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm transition-colors
                                ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:text-slate-600'}`}>
                              <i className={`fas ${item.icon}`}></i>
                            </div>
                            <div>
                              <div className={`font-bold text-base ${isActive ? 'text-white' : 'text-slate-800'}`}>{item.label}</div>
                              <div className={`text-xs font-medium ${isActive ? 'text-white/80' : 'text-slate-400'}`}>{item.sub}</div>
                            </div>
                          </div>
                          {!isActive && !isDisabled && <div className="absolute inset-0 border-2 border-transparent group-hover:border-slate-100 rounded-2xl transition-colors"></div>}
                        </button>
                      );
                    })}
                  </div>
                  
                  {/* Stats Preview (Decor) */}
                  <div className="mt-8 px-4 pb-2">
                      <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Weekly Progress</div>
                      <div className="flex items-end gap-1 h-12">
                          <div className="flex-1 bg-slate-100 rounded-t-md h-[40%]"></div>
                          <div className="flex-1 bg-slate-100 rounded-t-md h-[70%]"></div>
                          <div className="flex-1 bg-green-400 rounded-t-md h-[60%]"></div>
                          <div className="flex-1 bg-slate-100 rounded-t-md h-[30%]"></div>
                          <div className="flex-1 bg-slate-100 rounded-t-md h-[80%]"></div>
                      </div>
                  </div>
               </div>
            </aside>

            {/* Right Content Area */}
            <div className="flex-1 min-w-0">
               {/* Pass mode to InputSection to handle placeholder/text changes */}
               <InputSection 
                   onStart={handleStart} 
                   isLoading={isGenerating} 
                   mode={activeModule === 'vocab' ? 'vocab' : 'article'}
               />
            </div>

          </div>
        ) : null}

        {step === AppStep.PRACTICE && sentences.length > 0 && (
          <PracticeSession 
            sentences={sentences} 
            onComplete={handleComplete} 
            onBackToInput={handleReset}
            enableImages={activeModule === 'vocab'} // Only generate images for Vocab mode
          />
        )}

        {step === AppStep.COMPLETED && (
          <div className="max-w-xl mx-auto mt-12 text-center bg-white p-12 rounded-[2.5rem] shadow-xl border border-slate-100 animate-slide-up">
            <div className="w-24 h-24 bg-gradient-to-br from-green-400 to-emerald-500 text-white rounded-3xl flex items-center justify-center mx-auto mb-8 text-4xl shadow-lg transform -rotate-6">
              <i className="fas fa-trophy"></i>
            </div>
            <h2 className="text-4xl font-extrabold text-slate-800 mb-4">挑战完成！</h2>
            <p className="text-slate-600 mb-10 text-xl leading-relaxed">
              恭喜您完成了本次学习挑战。<br/>
              {activeModule === 'article' ? '整篇文章的深度拆解已完成。' : '所有核心词汇已通过例句掌握。'}
            </p>
            <button
              onClick={handleReset}
              className="px-12 py-5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold text-lg rounded-2xl hover:shadow-xl hover:shadow-green-200 hover:-translate-y-1 transition-all duration-200"
            >
              <i className="fas fa-redo-alt mr-2"></i>学习新内容
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
