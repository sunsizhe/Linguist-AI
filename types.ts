
export enum AppStep {
  INPUT = 'INPUT',
  GENERATING = 'GENERATING',
  PRACTICE = 'PRACTICE',
  COMPLETED = 'COMPLETED'
}

export interface VocabItem {
  word: string;
  pos?: string; // Part of Speech
}

export interface WordAnalysis {
  word: string;
  pos: string;
  meaning: string; // Chinese meaning in context
  usage: string; // Collocation or usage note
  isUserWord: boolean;
  ipa?: string; // IPA pronunciation
}

export interface LearningTip {
  content: string; // Vivid, easy-to-understand content
}

export interface WordDetail {
  text: string;
  ipa: string;
  chinese: string; // Added: Chinese meaning for every single word
}

export interface SentenceData {
  id: number;
  english: string;
  chinese: string;
  difficulty: 'Basic' | 'Intermediate' | 'Advanced';
  grammarAnalysis: string[]; // List of grammar points
  vocabAnalysis: WordAnalysis[];
  phonetics: string; // IPA for the whole sentence
  tip: LearningTip; // New field for the science module
  words: WordDetail[]; // New field for word-by-word display
}

export interface PronunciationError {
  word: string;
  expectedPhoneme: string;
  actualPhonemeLike: string;
  tip: string; // Chinese explanation of mouth position/airflow
  example: string; // Contrast example
}

export interface EvaluationResult {
  imageUrl?: string; // New field for the generated cartoon
  // Fields below are kept optional for backward compatibility if we ever switch back
  score?: number;
  transcript?: string;
  errors: PronunciationError[]; 
  feedback?: string;
}
