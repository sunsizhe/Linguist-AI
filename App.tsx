
import React, { useState } from 'react';
import { AppStep, SentenceData } from './types';
import { generateCurriculum } from './services/geminiService';
import InputSection from './components/InputSection';
import PracticeSession from './components/PracticeSession';

type ModuleType = 'custom' | 'exam' | 'scenario' | 'proficiency';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.INPUT);
  const [sentences, setSentences] = useState<SentenceData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Sidebar state
  const [activeModule, setActiveModule] = useState<ModuleType>('custom');

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

  // Sidebar Menu Items - Optimized dimensions based on user goals
  const menuItems = [
    { id: 'custom', label: '自由定制', sub: 'Custom Target', icon: 'fa-pen-fancy', color: 'from-emerald-400 to-green-500' },
    { id: 'exam', label: '考试突击', sub: 'TOEFL / IELTS / GRE', icon: 'fa-graduation-cap', color: 'from-blue-400 to-indigo-500' },
    { id: 'scenario', label: '场景实战', sub: 'Business / Travel', icon: 'fa-briefcase', color: 'from-amber-400 to-orange-500' },
    { id: 'proficiency', label: '能力分级', sub: 'CEFR A1 - C2', icon: 'fa-layer-group', color: 'from-rose-400 to-pink-500' },
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
          <div className="mt-4 flex flex-col lg:flex-row gap-8 animate-fade-in items-start">
            
            {/* Sidebar Navigation */}
            <aside className="w-full lg:w-72 shrink-0 space-y-4">
               <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-100 sticky top-24">
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest px-4 mb-4 mt-2">Course Modules</h2>
                  <div className="space-y-2">
                    {menuItems.map((item) => {
                      const isActive = activeModule === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveModule(item.id as ModuleType)}
                          className={`w-full text-left p-4 rounded-2xl transition-all duration-300 group relative overflow-hidden
                            ${isActive 
                              ? `bg-gradient-to-br ${item.color} text-white shadow-lg transform scale-[1.02]` 
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
                          {!isActive && <div className="absolute inset-0 border-2 border-transparent group-hover:border-slate-100 rounded-2xl transition-colors"></div>}
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
               {activeModule === 'custom' && (
                  <InputSection onStart={handleStart} isLoading={isGenerating} />
               )}
               
               {activeModule !== 'custom' && (
                 <div className="h-full min-h-[500px] bg-white rounded-[2rem] shadow-sm border border-slate-100 flex flex-col items-center justify-center p-12 text-center animate-fade-in">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 text-4xl mb-6">
                        <i className={`fas ${menuItems.find(m => m.id === activeModule)?.icon}`}></i>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-700 mb-2">
                      {menuItems.find(m => m.id === activeModule)?.label} 模块开发中
                    </h3>
                    <p className="text-slate-400 max-w-md mx-auto">
                      我们正在为您准备更丰富的{menuItems.find(m => m.id === activeModule)?.sub}课程内容，敬请期待！
                    </p>
                    <button 
                      onClick={() => setActiveModule('custom')}
                      className="mt-8 px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                    >
                      先去练习“自由定制”
                    </button>
                 </div>
               )}
            </div>

          </div>
        ) : null}

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
              恭喜您完成了所有 {sentences.length} 个句子的强化训练。<br/>您的词汇运用能力和发音水平已得到显著提升。
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
