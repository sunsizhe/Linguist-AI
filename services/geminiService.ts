import { GoogleGenAI, Type } from "@google/genai";
import { SentenceData, EvaluationResult } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const MODEL_NAME = 'gemini-2.5-flash';

// Schema for sentence generation
const sentenceGenerationSchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.INTEGER },
      english: { type: Type.STRING },
      chinese: { type: Type.STRING },
      difficulty: { type: Type.STRING, enum: ['Basic', 'Intermediate', 'Advanced'] },
      phonetics: { type: Type.STRING, description: "Full sentence IPA" },
      grammarAnalysis: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Key grammatical points and structural analysis in Chinese"
      },
      vocabAnalysis: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            pos: { type: Type.STRING },
            meaning: { type: Type.STRING },
            usage: { type: Type.STRING },
            isUserWord: { type: Type.BOOLEAN }
          },
          required: ["word", "pos", "meaning", "usage", "isUserWord"]
        }
      }
    },
    required: ["id", "english", "chinese", "difficulty", "grammarAnalysis", "vocabAnalysis", "phonetics"]
  }
};

export const generateCurriculum = async (words: string[]): Promise<SentenceData[]> => {
  if (!apiKey) throw new Error("API Key is missing");

  const prompt = `
    你是一位资深的语言学家和英语教师。
    请基于用户提供的以下单词列表，生成20个难度递增的英语句子用于教学。
    
    用户单词: ${words.join(', ')}

    要求：
    1. 前5句为基础难度（A2），中间10句为进阶（B1），最后5句为高阶（B2）。
    2. 句子内容涵盖生活、职场、留学等真实场景。
    3. 每个句子必须包含至少一个用户提供的单词。
    4. 提供地道的中文翻译。
    5. 提供详细的中文语法分析（结构、时态、易错点）。
    6. 对句中关键单词（特别是用户输入的词）进行解析。
    7. 输出严格的JSON格式。
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: sentenceGenerationSchema,
        temperature: 0.7
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as SentenceData[];
    }
    return [];
  } catch (error) {
    console.error("Error generating curriculum:", error);
    throw error;
  }
};

// Schema for pronunciation evaluation
const evaluationSchema = {
  type: Type.OBJECT,
  properties: {
    score: { type: Type.INTEGER, description: "0-100 score based on accuracy" },
    feedback: { type: Type.STRING, description: "General encouraging feedback in Chinese" },
    errors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING, description: "The word pronounced incorrectly" },
          expectedPhoneme: { type: Type.STRING, description: "Correct IPA symbol for the specific error part" },
          actualPhonemeLike: { type: Type.STRING, description: "What it sounded like (IPA or description)" },
          tip: { type: Type.STRING, description: "Specific physical articulation advice (tongue/lip/airflow) in Chinese" },
          example: { type: Type.STRING, description: "Minimal pair or contrast example" }
        },
        required: ["word", "expectedPhoneme", "actualPhonemeLike", "tip", "example"]
      }
    }
  },
  required: ["score", "feedback", "errors"]
};

export const evaluatePronunciation = async (targetSentence: string, userTranscript: string): Promise<EvaluationResult> => {
  if (!apiKey) throw new Error("API Key is missing");

  // If transcript is empty or very short vs target
  if (!userTranscript || userTranscript.length < 2) {
    return {
      score: 0,
      transcript: userTranscript,
      feedback: "没有检测到清晰的语音，请确保环境安静并大声朗读。",
      errors: []
    };
  }

  const prompt = `
    你是一位专门纠正中国学生口音的资深语音学家。
    请对比目标句子和用户的语音识别文本，进行深度发音诊断。

    目标句子 (Correct): "${targetSentence}"
    用户读成 (Detected): "${userTranscript}"

    **核心任务：**
    1. **识别错误**：如果 STT (语音识别) 识别出的词与原句不同，通常意味着发音不准导致识别错误（例如把 'think' 读成 'sink'）。
    2. **物理纠音 (关键)**：对于发音错误的单词，不要只说“读错了”，必须解释**口腔动作的差异**。
       - 针对中国人的习惯，指出舌位、唇形、气流的具体区别。
       - 例如：/θ/ vs /s/ -> "舌尖必须伸出上下齿之间，不要缩在牙齿后面发出丝丝声"。
       - 例如：/v/ vs /w/ -> "上齿轻咬下唇震动，不要圆唇"。
       - 例如：/l/ vs /n/ -> "鼻音与边音的区别，捏住鼻子测试"。
    3. **评分标准**：
       - 文本完全一致且长句流利：95-100分。
       - 只有1-2个小词错误：85-94分。
       - 关键词错误或断句严重：60-84分。
       - 无法辨认：<60分。

    请严格按照 JSON 格式输出，tip 字段必须包含具体的器官（舌、齿、唇）动作描述。
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: evaluationSchema,
        temperature: 0.3
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      return { ...result, transcript: userTranscript };
    }
    throw new Error("Failed to parse evaluation");
  } catch (error) {
    console.error("Error evaluating pronunciation:", error);
    // Fallback if API fails
    return {
      score: 0,
      transcript: userTranscript,
      feedback: "系统暂时无法进行深度评估，请检查网络连接。",
      errors: []
    };
  }
};