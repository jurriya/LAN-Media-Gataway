
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getMediaInsight = async (fileName: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide a very short (2-sentence) summary and one interesting trivia fact about the movie or media item titled: "${fileName}". If it's not a movie, describe what it might be based on the filename.`,
      config: {
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "No AI insights available for this file.";
  }
};

export const getSmartSearch = async (query: string, availableFiles: string[]) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The user is searching their local media library. 
      Search Query: "${query}"
      Available Files: ${availableFiles.join(", ")}
      
      Return a JSON array of the file names that most closely match the intent of the search.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text.trim()) as string[];
  } catch (error) {
    console.error("AI Search Error:", error);
    return [];
  }
};
