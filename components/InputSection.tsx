import React, { useState } from 'react';

interface InputSectionProps {
  onStart: (words: string[]) => void;
  isLoading: boolean;
}

const InputSection: React.FC<InputSectionProps> = ({ onStart, isLoading }) => {
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');

  const handleStart = () => {
    if (isLoading) return;

    // Basic processing: split by newline or comma, trim, filter empty
    const rawWords = inputText.split(/[\n,，]/).map(w => w.trim()).filter(w => w.length > 0);
    
    // Deduplicate and lowercase
    const uniqueWords = Array.from(new Set(rawWords.map(w => w.toLowerCase())));

    if (uniqueWords.length === 0) {
      setError('请输入至少 1 个单词。');
      return;
    }
    
    if (uniqueWords.length > 50) {
      setError(`单词数量过多 (${uniqueWords.length})，建议控制在 50 个以内以保证生成质量。`);
      return;
    }

    setError('');
    onStart(uniqueWords);
  };

  const handleSample = () => {
    if (isLoading) return;
    const samples = [
      "serendipity", "analyze", "critical", "environment", "solution", 
      "negotiate", "colleague", "presentation", "schedule", "deadline"
    ];
    setInputText(samples.join('\n'));
  };

  return (
    <div className="max-w-4xl mx-auto p-10 bg-white/80 backdrop-blur-sm rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-green-100 font-['Nunito']">
      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-green-100 text-green-600 mb-6 shadow-sm transform hover:rotate-3 transition-transform duration-300">
          <i className="fas fa-leaf text-3xl"></i>
        </div>
        <h2 className="text-4xl font-extrabold text-slate-800 tracking-tight">定制您的专属课程</h2>
        <p className="text-slate-500 mt-4 text-xl leading-relaxed">请输入您想学习的英语单词（最多 50 个），<br/>AI 将为您生成循序渐进的练习场景。</p>
      </div>

      <div className="mb-10">
        <label htmlFor="vocab-input" className="block text-lg font-bold text-slate-700 mb-4 ml-2">
          单词列表 <span className="text-green-500 font-normal text-base ml-2">(支持换行或逗号分隔)</span>
        </label>
        <div className="relative group">
            <textarea
            id="vocab-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
            placeholder="例如：&#10;apple&#10;banana&#10;interview&#10;promotion"
            className="w-full h-80 p-8 border-2 border-slate-200 rounded-3xl focus:ring-4 focus:ring-green-100 focus:border-green-400 outline-none resize-none font-mono text-xl text-slate-700 placeholder-slate-300 transition-all shadow-inner bg-slate-50 focus:bg-white leading-relaxed disabled:bg-slate-100 disabled:text-slate-400"
            />
            <div className="absolute bottom-6 right-6 text-sm font-bold px-4 py-2 bg-white/90 backdrop-blur rounded-full text-slate-400 border border-slate-100 shadow-sm pointer-events-none">
                {inputText ? inputText.split(/[\n,，]/).filter(w => w.trim()).length : 0} / 50
            </div>
        </div>
        
        <div className="flex justify-between mt-4 px-2">
            <button 
                onClick={handleSample}
                disabled={isLoading}
                className={`text-base font-semibold text-green-600 hover:text-green-700 hover:underline decoration-2 underline-offset-4 transition-colors flex items-center gap-2 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <i className="fas fa-wand-magic-sparkles"></i>
                填入示例单词
            </button>
        </div>
        
        {error && (
            <div className="mt-4 p-4 bg-red-50 text-red-500 rounded-2xl text-base font-bold flex items-center gap-3 animate-pulse border border-red-100">
                <i className="fas fa-exclamation-circle text-xl"></i>
                {error}
            </div>
        )}
      </div>

      <button
        onClick={handleStart}
        disabled={isLoading}
        className={`w-full py-5 px-8 rounded-2xl font-bold text-xl shadow-xl transition-all duration-200 flex items-center justify-center gap-3 
          ${isLoading 
            ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none' 
            : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white hover:shadow-green-200 hover:-translate-y-1 active:scale-[0.98]'
          }`}
      >
        {isLoading ? (
          <>
            <i className="fas fa-circle-notch fa-spin text-2xl"></i>
            <span>AI 语言学家正在为您构建课程...</span>
          </>
        ) : (
          <>
            <span>开始生成课程</span>
            <i className="fas fa-arrow-right"></i>
          </>
        )}
      </button>
    </div>
  );
};

export default InputSection;