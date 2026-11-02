import "server-only";
import { createOpenAI } from "@ai-sdk/openai";

/** Explicit provider instances prevent AI SDK model strings from using Gateway. */
export function directModel(kind: "text" | "vision") {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const configured = (
    kind === "text"
      ? process.env.ASSHOWN_AI_MODEL
      : process.env.ASSHOWN_VISION_MODEL
  )?.trim();
  if (!apiKey || !configured) return null;
  const id = configured.replace(/^openai\//, "");
  if (!/^gpt-[a-zA-Z0-9._-]+$/.test(id)) return null;
  return {
    name: `openai/${id}`,
    model: createOpenAI({ apiKey }).responses(id),
  };
}
