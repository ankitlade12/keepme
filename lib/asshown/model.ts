import "server-only";
import { createGoogle } from "@ai-sdk/google";

/** Explicit provider instances prevent AI SDK model strings from using Gateway. */
export function directModel(kind: "text" | "vision") {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  const configured = (
    kind === "text"
      ? process.env.ASSHOWN_AI_MODEL
      : process.env.ASSHOWN_VISION_MODEL
  )?.trim();
  if (!apiKey || !configured) return null;
  const id = configured.replace(/^google\//, "");
  if (!/^gemini-[a-zA-Z0-9._-]+$/.test(id)) return null;
  return {
    name: `google/${id}`,
    model: createGoogle({ apiKey })(id),
  };
}
