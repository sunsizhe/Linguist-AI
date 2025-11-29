
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SentenceData, EvaluationResult } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const MODEL_NAME = 'gemini-2.5-flash';
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';
const SPEECH_MODEL_NAME = 'gemini-2.5-flash-preview-tts';

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
      words: {
        type: Type.ARRAY,
        description: "Break down the sentence into individual words with their specific IPA and simple Chinese meaning.",
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            ipa: { type: Type.STRING },
            chinese: { type: Type.STRING, description: "Concise Chinese meaning of this word in current context." }
          },
          required: ["text", "ipa", "chinese"]
        }
      },
      grammarAnalysis: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Key grammatical points and structural analysis in Simplified Chinese."
      },
      vocabAnalysis: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            pos: { type: Type.STRING },
            meaning: { type: Type.STRING, description: "Meaning in Simplified Chinese." },
            usage: { type: Type.STRING, description: "Usage note or collocation. Explanations MUST be in Simplified Chinese." },
            isUserWord: { type: Type.BOOLEAN },
            ipa: { type: Type.STRING, description: "IPA pronunciation" }
          },
          required: ["word", "pos", "meaning", "usage", "isUserWord", "ipa"]
        }
      },
      tip: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING, description: "Short, vivid, metaphor-rich explanation (approx 40 words) about brain science or learning tips. MUST be in Simplified Chinese." }
        },
        required: ["content"]
      }
    },
    required: ["id", "english", "chinese", "difficulty", "grammarAnalysis", "vocabAnalysis", "phonetics", "tip", "words"]
  }
};

// Schema for pronunciation evaluation
const evaluationSchema = {
  type: Type.OBJECT,
  properties: {
    transcript: { type: Type.STRING },
    feedback: { type: Type.STRING, description: "Encouraging feedback in Simplified Chinese" },
    errors: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          expectedPhoneme: { type: Type.STRING },
          actualPhonemeLike: { type: Type.STRING },
          tip: { type: Type.STRING, description: "Physical mouth position advice in Simplified Chinese" },
          example: { type: Type.STRING, description: "Contrast example" }
        },
        required: ["word", "expectedPhoneme", "actualPhonemeLike", "tip", "example"]
      }
    }
  },
  required: ["transcript", "feedback", "errors"]
};

/**
 * Chat Assistant API
 * Uses stateless message history to generate a response.
 */
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export const sendChatMessage = async (history: ChatMessage[], newMessage: string): Promise<string> => {
  if (!apiKey) throw new Error("API Key is missing");

  // Construct the conversation history including the new message
  const contents = [
    ...history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    })),
    {
      role: 'user',
      parts: [{ text: newMessage }]
    }
  ];

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME, // Basic free model (Flash)
      contents: contents,
      config: {
        systemInstruction: "你是一位友好的英语学习助教。你的任务是帮助用户解答关于英语学习的问题，比如单词用法、语法解释、或者陪练简单的英语对话。请用简洁、鼓励性的语气回答。如果用户用中文提问，请用中文回答；如果用户用英文提问，你可以用英文回答但适当提供中文辅助（除非用户要求全英文）。",
        temperature: 0.7,
      }
    });

    return response.text || "Sorry, I couldn't generate a response.";
  } catch (error) {
    console.error("Chat error:", error);
    return "网络连接似乎有点问题，请稍后再试。";
  }
};

/**
 * Mode 1: Article Study
 * Splits a long text into sequential learning segments.
 */
export const generateArticleCurriculum = async (text: string): Promise<SentenceData[]> => {
  if (!apiKey) throw new Error("API Key is missing");

  const prompt = `
    你是一位资深的语言学家和英语教师。
    用户提供了一段英语文本。
    请将这段文本拆分成一系列的学习片段（Levels），用于制作分级阅读课程。

    用户文本: """${text}"""

    要求：
    1. **拆分原则**：
       - **严格保持原文内容**：不要自己造句，必须直接使用用户提供的文本。
       - **片段长度**：每个 level 包含 **1 到 3 个完整的句子**。不要在一个句子中间切断。
       - **数量不限**：根据文本总长度自动决定 level 的数量。如果文本较长，就生成多个 level。
       - **顺序**：严格按照原文顺序输出。
    2. **分析内容（所有解释必须使用简体中文）**：
       - **words 数组**：必须将该片段切分为独立的单词对象，并为**每个单词**提供 IPA 音标和**简短的中文释义**。
       - 翻译：提供地道的简体中文意译。
       - 语法分析：解析关键语法结构（必须使用中文）。
       - 重点词汇（vocabAnalysis）：选出 2-4 个重点单词进行详细解析（释义和用法说明必须使用中文）。
       - 难度评级：Basic/Intermediate/Advanced。
       - **【轻松一下】**：关于这段话的背景知识、修辞手法或学习技巧（40字以内，必须使用中文）。
    3. **输出格式**：
       - 严格的 JSON 数组。
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
    console.error("Error generating article curriculum:", error);
    throw error;
  }
};

/**
 * Mode 2: Vocabulary Study
 * Generates sentences based on a list of words.
 */
export const generateVocabCurriculum = async (wordsInput: string): Promise<SentenceData[]> => {
  if (!apiKey) throw new Error("API Key is missing");

  const prompt = `
    你是一位资深的英语教师。
    用户提供了一组单词：${wordsInput}。
    请为这些单词创作一个包含约 5-10 个句子的学习课程（Curriculum）。
    
    要求：
    1. **造句**：为每个主要单词造一个生动、地道、语境丰富的英语句子。
       - 如果单词较多，可以将 2-3 个相关单词融合到一个连贯的句子中。
       - 确保句子逻辑通顺，不仅仅是单词的堆砌。
    2. **难度**：B2-C1 高级水平。
    3. **分析内容（所有解释必须使用简体中文）**：
       - **words 数组**：必须将句子切分为独立的单词对象，并为**每个单词**提供 IPA 音标和**简短的中文释义**。
       - 翻译：提供地道的简体中文意译。
       - 语法分析：解析关键语法结构（必须使用中文）。
       - 重点词汇（vocabAnalysis）：必须包含用户提供的单词，并进行详细解析（释义和用法说明必须使用中文）。
       - **【轻松一下】**：提供关于该词汇的记忆技巧、词源故事或文化背景（40字以内，必须使用中文）。
    4. **输出格式**：
       - 严格的 JSON 数组。
  `;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: sentenceGenerationSchema,
        temperature: 0.8
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as SentenceData[];
    }
    return [];
  } catch (error) {
    console.error("Error generating vocab curriculum:", error);
    throw error;
  }
};

/**
 * Generates natural speech audio using Gemini TTS.
 * Returns a base64 string of the raw PCM audio data.
 */
export const generateSpeech = async (text: string): Promise<string | null> => {
  if (!apiKey) throw new Error("API Key is missing");

  try {
    const response = await ai.models.generateContent({
      model: SPEECH_MODEL_NAME,
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }, // 'Kore' is a good, soothing female voice
            },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("Error generating speech:", error);
    return null;
  }
}

/**
 * Generates a 2D Cartoon/Manga style image for the sentence.
 */
export const generateSentenceImage = async (sentence: string): Promise<string | null> => {
  if (!apiKey) throw new Error("API Key is missing");

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
  if (!apiKey) throw new Error("API Key is missing");

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
    6. 针对每个错误单词，提供具体的口腔动作指导（必须使用简体中文）。

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
      return {
        score: 0, 
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
