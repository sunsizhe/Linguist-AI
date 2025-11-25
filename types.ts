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
}

export interface SentenceData {
  id: number;
  english: string;
  chinese: string;
  difficulty: 'Basic' | 'Intermediate' | 'Advanced';
  grammarAnalysis: string[]; // List of grammar points
  vocabAnalysis: WordAnalysis[];
  phonetics: string; // IPA for the whole sentence
}

export interface PronunciationError {
  word: string;
  expectedPhoneme: string;
  actualPhonemeLike: string;
  tip: string; // Chinese explanation of mouth position/airflow
  example: string; // Contrast example
}

export interface EvaluationResult {
  score: number;
  transcript: string;
  errors: PronunciationError[];
  feedback: string;
}
