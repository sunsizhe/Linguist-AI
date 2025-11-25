
import React from 'react';
import { SentenceData } from '../types';

interface AnalysisPanelProps {
  sentence: SentenceData;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ sentence }) => {
  return (
    <div className="bg-white rounded-[2rem] shadow-sm border border-emerald-50 overflow-hidden font-['Nunito']">
      <div className="bg-emerald-50/30 px-8 py-6 border-b border-emerald-50 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600">
            <i className="fas fa-glasses"></i>
        </div>
        <div>
            <h3 className="font-extrabold text-emerald-900 text-lg tracking-tight">语言学家深度解析</h3>
            <p className="text-emerald-600/60 text-xs font-bold uppercase tracking-wider">Linguistic Breakdown</p>
        </div>
      </div>
      
      <div className="p-8 space-y-8">
        {/* Structure & Grammar */}
        <div>
          <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
            <i className="fas fa-project-diagram"></i> 语法结构
          </h4>
          <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-100">
            <ul className="space-y-4">
                {sentence.grammarAnalysis.map((point, idx) => (
                <li key={idx} className="flex items-start gap-4">
                    <span className="mt-1.5 w-2 h-2 rounded-full bg-emerald-400 shadow-sm flex-shrink-0"></span>
                    <span className="text-slate-600 font-medium leading-relaxed">{point}</span>
                </li>
                ))}
            </ul>
          </div>
        </div>

        {/* Vocabulary */}
        <div>
          <h4 className="text-xs font-black text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
            <i className="fas fa-spell-check"></i> 重点词汇
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sentence.vocabAnalysis.map((word, idx) => (
              <div 
                key={idx} 
                className={`p-5 rounded-2xl border transition-all duration-200 group ${word.isUserWord ? 'bg-amber-50/50 border-amber-100 hover:border-amber-200' : 'bg-white border-slate-100 hover:border-emerald-200 hover:shadow-sm'}`}
              >
                <div className="flex items-baseline justify-between mb-2">
                  <span className={`font-bold text-lg ${word.isUserWord ? 'text-amber-800' : 'text-slate-800'}`}>{word.word}</span>
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md border ${word.isUserWord ? 'bg-white text-amber-500 border-amber-200' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>{word.pos}</span>
                </div>
                <div className={`text-sm font-bold mb-2 ${word.isUserWord ? 'text-amber-700' : 'text-slate-600'}`}>{word.meaning}</div>
                <div className="text-xs text-slate-400 italic bg-white/50 p-2 rounded-lg border border-transparent group-hover:border-slate-100">"{word.usage}"</div>
              </div>
            ))}
          </div>
        </div>

        {/* Translation note */}
        <div className="p-6 bg-gradient-to-r from-emerald-50/50 to-white rounded-2xl border border-emerald-50">
            <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <i className="fas fa-language"></i>
                参考译文
            </h4>
            <p className="text-emerald-900/80 font-medium text-lg leading-relaxed">
                {sentence.chinese}
            </p>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;
