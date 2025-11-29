import { GoogleGenAI, Type } from "@google/genai";
import { SentenceData, EvaluationResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';

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
            isUserWord: { type: Type.BOOLEAN },
            ipa: { type: Type.STRING, description: "IPA pronunciation" }
          },
          required: ["word", "pos", "meaning", "usage", "isUserWord", "ipa"]
        }
      },
      tip: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING, description: "Short, vivid, metaphor-rich explanation (approx 40 words) about brain science or learning tips" }
        },
        required: ["content"]
      }
    },
    required: ["id", "english", "chinese", "difficulty", "grammarAnalysis", "vocabAnalysis", "phonetics", "tip"]
  }
};

// Schema for pronunciation evaluation
const evaluationSchema = {
  type: Type.OBJECT,
  properties: {
    transcript: { type: Type.STRING },
    feedback: { type: Type.STRING, description: "Encouraging feedback in Chinese" },
    errors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          expectedPhoneme: { type: Type.STRING },
          actualPhonemeLike: { type: Type.STRING },
          tip: { type: Type.STRING, description: "Physical mouth position advice in Chinese" },
          example: { type: Type.STRING, description: "Contrast example" }
        },
        required: ["word", "expectedPhoneme", "actualPhonemeLike", "tip", "example"]
      }
    }
  },
  required: ["transcript", "feedback", "errors"]
};

export const generateCurriculum = async (words: string[]): Promise<SentenceData[]> => {
  const prompt = `
    你是一位资深的语言学家、认知神经科学家和英语教师。
    请基于用户提供的以下单词列表，生成10个难度递增的英语句子用于教学。
    
    用户单词: ${words.join(', ')}

    要求：
    1. **数量与难度**：共生成10个句子。前3句为基础难度（A2），中间4句为进阶（B1），最后3句为高阶（B2）。
    2. **内容丰富度**：
       - 拒绝枯燥的简单造句。每个句子必须构建一个**生动、具体且有画面感**的微场景（Micro-scenario）。
       - 尝试将多个用户单词自然融合在一个句子中，体现词汇之间的逻辑关联。
       - 场景内容需多元化：涵盖职场挑战、文化差异、科技生活、情感表达或哲学思考。
       - 句子长度适中，要体现出英语的逻辑美感（如使用从句、分词结构等）。
    3. 每个句子必须包含至少一个用户提供的单词。
    4. 提供地道的中文翻译（意译为主，体现信达雅）。
    5. 提供详细的中文语法分析（结构、时态、易错点）。
    6. 对句中所有单词（包括常用词）进行解析，必须包含IPA音标。
    7. **【轻松一下】科普模块**：
       - 为每个句子附带一个关于“英语学习/记忆法/脑科学”的趣味小知识。
       - **长度要求**：必须简短精炼（40字左右）。
       - **风格要求**：轻松、有趣、生动（多用比喻），像朋友间的闲聊小贴士。
    8. 输出严格的JSON格式。
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

/**
 * Generates a 2D Cartoon/Manga style image for the sentence.
 */
export const generateSentenceImage = async (sentence: string): Promise<string | null> => {
  const prompt = `Generate a cute, vibrant, 2D cartoon or manga style illustration that depicts the following scene: "${sentence}". The style should be suitable for an educational language learning app. Flat colors, clean lines, clear composition.`;

  try {
    const response = await ai.models.generateContent({
      model: IMAGE_MODEL_NAME,
      contents: {
        parts: [
          { text: prompt }
        ]
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          const base64String = part.inlineData.data;
          const mimeType = part.inlineData.mimeType || 'image/png';
          return `data:${mimeType};base64,${base64String}`;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
};

export const evaluatePronunciation = async (targetSentence: string, userTranscript: string): Promise<EvaluationResult> => {
  const prompt = `
    作为一名专业的英语语音纠正教练，请对比标准句子和用户录音转录文本。
    
    标准句子: "${targetSentence}"
    用户录音转录: "${userTranscript}"

    任务：
    1. 即使转录完全匹配，也请检查标准句子中容易发错音的单词（如 th, v/w, l/r）。
    2. 如果转录有差异，找出对应的单词。
    3. 重点关注发音准确性，忽略标点符号差异。
    4. **只返回真正需要纠正的单词**（如果有）。
    5. 不要给分数，而是给出鼓励性的中文反馈 (feedback)。
    6. 针对每个错误单词，提供具体的口腔动作指导（中文）。

    输出格式为JSON。
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: evaluationSchema,
        temperature: 0.4
      }
    });

    if (response.text) {
      const result = JSON.parse(response.text);
      // Ensure we don't have nulls
      return {
        score: 0, // Not used
        transcript: userTranscript,
        feedback: result.feedback || "Good job!",
        errors: result.errors || []
      };
    }
    
    return {
        score: 0,
        transcript: userTranscript,
        feedback: "无法分析，请重试",
        errors: []
    };

  } catch (error) {
    console.error("Evaluation error:", error);
    return {
        score: 0,
        transcript: userTranscript,
        feedback: "网络错误",
        errors: []
    };
  }
};
