
import React, { useState, useEffect } from 'react';

interface InputSectionProps {
  onStart: (text: string) => void;
  isLoading: boolean;
  mode: 'article' | 'vocab';
}

const InputSection: React.FC<InputSectionProps> = ({ onStart, isLoading, mode }) => {
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');

  // Clear text when mode switches
  useEffect(() => {
    setInputText('');
    setError('');
  }, [mode]);

  const handleStart = () => {
    if (isLoading) return;

    const cleanText = inputText.trim();
    
    if (!cleanText) {
      setError('请输入内容。');
      return;
    }
    
    if (mode === 'article') {
        const wordCount = cleanText.split(/\s+/).length;
        if (wordCount > 600) {
            setError(`文本过长 (~${wordCount} 词)，建议控制在 500 词左右以保证生成质量。`);
            return;
        }
    } else {
        // Vocab mode validation
        // Rough check for list length logic if needed, but Gemini handles lists well.
        if (cleanText.length > 2000) {
             setError('输入内容过多。');
             return;
        }
    }

    setError('');
    onStart(cleanText);
  };

  const handleSample = () => {
    if (isLoading) return;
    
    if (mode === 'article') {
        const sample = `Serendipity is the occurrence of events by chance in a happy or beneficial way. It is often described as finding something good without looking for it. For example, penicillin was discovered by Alexander Fleming when he noticed a mold killing bacteria in a petri dish he had accidentally left open. This accidental discovery revolutionized medicine. In our daily lives, serendipity plays a role when we meet a future friend at a coffee shop or find a perfect book while sheltering from the rain. To cultivate serendipity, one must stay curious and open to the unexpected.`;
        setInputText(sample);
    } else {
        const sample = `serendipity, ephemeral, resilience, pragmatic, aesthetic`;
        setInputText(sample);
    }
  };

  const wordCount = inputText ? inputText.trim().split(/\s+/).filter(w => w).length : 0;
  
  const isArticle = mode === 'article';

  return (
    <div className="w-full bg-white/80 backdrop-blur-sm rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-green-100 font-['Nunito'] p-8 md:p-10 flex flex-col">
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
            <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl ${isArticle ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'} shadow-sm transition-colors`}>
                <i className={`fas ${isArticle ? 'fa-book-open' : 'fa-tags'} text-xl`}></i>
            </div>
            <div>
                <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">
                    {isArticle ? '自定义文章学习' : '自定义单词学习'}
                </h2>
                <p className="text-slate-500 text-sm">
                    {isArticle ? 'Article & Text Study' : 'Vocabulary & Usage Study'}
                </p>
            </div>
        </div>
        <p className="text-slate-500 leading-relaxed">
            {isArticle 
                ? '请输入您想学习的英语段落或文章（如新闻、演讲稿、小说片段），AI 将为您将其拆解为 10 个闯关卡片，深度解析原文。支持约 500 个单词的文本。'
                : '请输入您想要掌握的单词列表（用逗号或空格分隔），AI 将为您生成包含这些单词的生动场景例句，并配以插图辅助记忆。'}
        </p>
      </div>

      <div className="flex-1 flex flex-col min-h-[300px]">
        <div className="relative group flex-1 flex flex-col">
            <label htmlFor="vocab-input" className="sr-only">文本输入</label>
            <textarea
            id="vocab-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isLoading}
            placeholder={isArticle ? "在此粘贴您的英语文章或段落..." : "例如: serendipity, resilience, pragmatic..."}
            className={`w-full flex-1 p-6 border-2 rounded-3xl outline-none resize-none font-mono text-lg text-slate-700 placeholder-slate-300 transition-all shadow-inner bg-slate-50 focus:bg-white leading-relaxed disabled:bg-slate-100 disabled:text-slate-400 min-h-[240px]
                ${isArticle ? 'focus:ring-green-100 focus:border-green-400 border-slate-200' : 'focus:ring-amber-100 focus:border-amber-400 border-slate-200'}
            `}
            />
            {isArticle && (
                <div className={`absolute bottom-6 right-6 text-xs font-bold px-3 py-1.5 bg-white/90 backdrop-blur rounded-full border shadow-sm pointer-events-none transition-colors ${wordCount > 500 ? 'text-red-500 border-red-200' : 'text-slate-400 border-slate-100'}`}>
                    {wordCount} / 500 Words
                </div>
            )}
        </div>
        
        <div className="flex justify-between mt-4 px-1 mb-8">
            <button 
                onClick={handleSample}
                disabled={isLoading}
                className={`text-sm font-bold hover:underline decoration-2 underline-offset-4 transition-colors flex items-center gap-2 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${isArticle ? 'text-green-600 hover:text-green-700' : 'text-amber-600 hover:text-amber-700'}`}
            >
                <i className="fas fa-magic"></i>
                试一试：加载示例{isArticle ? '文章' : '单词'}
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
                : isArticle 
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white hover:shadow-green-200 hover:-translate-y-1 active:scale-[0.98]'
                    : 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white hover:shadow-amber-200 hover:-translate-y-1 active:scale-[0.98]'
            }`}
        >
            {isLoading ? (
            <>
                <i className="fas fa-circle-notch fa-spin text-xl"></i>
                <span className="text-lg">正在解析{isArticle ? '文章' : '单词'}...</span>
            </>
            ) : (
            <>
                <span>开始生成课程</span>
                <i className="fas fa-arrow-right"></i>
            </>
            )}
        </button>
      </div>
    </div>
  );
};

export default InputSection;
