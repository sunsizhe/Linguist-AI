
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
    <div className="w-full bg-white/80 backdrop-blur-sm rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-green-100 font-['Nunito'] p-8 md:p-10 flex flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-green-100 text-green-600 shadow-sm">
                <i className="fas fa-pen-fancy text-xl"></i>
            </div>
            <div>
                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">自由定制课程</h2>
                <p className="text-slate-500 text-sm">Targeted Vocabulary Training</p>
            </div>
        </div>
        <p className="text-slate-500 leading-relaxed">请输入您想重点突破的单词（如 GRE 难词、行业术语），AI 将为您生成专属场景课程。</p>
      </div>

      <div className="flex-1 flex flex-col min-h-[300px]">
        <div className="relative group flex-1 flex flex-col">
            <label htmlFor="vocab-input" className="sr-only">单词列表</label>
            <textarea
            id="vocab-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
            placeholder="在此输入单词，支持换行...&#10;apple&#10;banana&#10;interview"
            className="w-full flex-1 p-6 border-2 border-slate-200 rounded-3xl focus:ring-4 focus:ring-green-100 focus:border-green-400 outline-none resize-none font-mono text-lg text-slate-700 placeholder-slate-300 transition-all shadow-inner bg-slate-50 focus:bg-white leading-relaxed disabled:bg-slate-100 disabled:text-slate-400 min-h-[240px]"
            />
            <div className="absolute bottom-6 right-6 text-xs font-bold px-3 py-1.5 bg-white/90 backdrop-blur rounded-full text-slate-400 border border-slate-100 shadow-sm pointer-events-none">
                {inputText ? inputText.split(/[\n,，]/).filter(w => w.trim()).length : 0} / 50
            </div>
        </div>
        
        <div className="flex justify-between mt-4 px-1 mb-8">
            <button 
                onClick={handleSample}
                disabled={isLoading}
                className={`text-sm font-bold text-green-600 hover:text-green-700 hover:underline decoration-2 underline-offset-4 transition-colors flex items-center gap-2 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <i className="fas fa-magic"></i>
                试一试：生成示例
            </button>
        </div>
        
        {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-500 rounded-2xl text-sm font-bold flex items-center gap-3 animate-pulse border border-red-100">
                <i className="fas fa-exclamation-circle text-lg"></i>
                {error}
            </div>
        )}

        <button
            onClick={handleStart}
            disabled={isLoading}
            className={`w-full py-5 px-8 rounded-2xl font-bold text-xl shadow-xl transition-all duration-200 flex items-center justify-center gap-3 mt-auto
            ${isLoading 
                ? 'bg-slate-200 text-slate-500 cursor-not-allowed shadow-none' 
                : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white hover:shadow-green-200 hover:-translate-y-1 active:scale-[0.98]'
            }`}
        >
            {isLoading ? (
            <>
                <i className="fas fa-circle-notch fa-spin text-xl"></i>
                <span className="text-lg">正在构建课程...</span>
            </>
            ) : (
            <>
                <span>开始生成</span>
                <i className="fas fa-arrow-right"></i>
            </>
            )}
        </button>
      </div>
    </div>
  );
};

export default InputSection;
