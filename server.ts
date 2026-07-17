import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

// Serve static files from the workspace root
const publicPath = process.cwd();
app.use(express.static(publicPath));

// Lazy-initialize Gemini client or check on request
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

app.post("/api/gemini/classify-distraction", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Text is required" });
    }

    let ai;
    try {
      ai = getGeminiClient();
    } catch (err: any) {
      // Fallback classification if GEMINI_API_KEY is missing
      console.warn("Gemini API key is missing. Using local rule-based classification.");
      const lower = text.toLowerCase();
      let category = "Other";
      let advice = "Stay mindful of your goals. Let's try to reset with a quick breathing session.";
      if (lower.includes("phone") || lower.includes("insta") || lower.includes("tiktok") || lower.includes("social")) {
        category = "Social Media";
        advice = "Social media notifications are designed to break your focus. Put your phone in another room or use a website blocker!";
      } else if (lower.includes("game") || lower.includes("play") || lower.includes("steam")) {
        category = "Gaming";
        advice = "Games offer high instant gratification. Schedule a dedicated 30-minute gaming reward block AFTER you finish your core tasks.";
      } else if (lower.includes("tire") || lower.includes("sleep") || lower.includes("exhaust")) {
        category = "Tiredness";
        advice = "Your brain is exhausted. Step away, drink a cold glass of water, or take a quick 10-minute walk to reset.";
      } else if (lower.includes("hungry") || lower.includes("eat") || lower.includes("food") || lower.includes("snack")) {
        category = "Biological Needs";
        advice = "Fueling your body is important. Grab a healthy snack (nuts, fruit) and a glass of water, then come back!";
      } else if (lower.includes("confus") || lower.includes("how to") || lower.includes("stuck")) {
        category = "Confusion / Stuck";
        advice = "When tasks feel too vague, we procrastinate. Break your current task down into 3 tiny, ultra-specific sub-tasks!";
      }

      return res.json({
        category,
        advice,
        isFallback: true
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are Aarush's supportive, professional, and slightly gamified AI guide for DialedIn (a productivity RPG).
Classify the following self-reported distraction text:
"${text}"

Return a valid JSON object ONLY, with these exact keys:
- "category": Choose one of: "Social Media", "Gaming", "Daydreaming", "Biological Needs", "Administrative Interruption", "Confusion / Stuck", "Tiredness", "Other"
- "advice": A short, empowering, constructive, and highly actionable tip on how Aarush can overcome this specific distraction and get DialedIn again. Tone: supportive, wise, zero fluff, motivating.

Make sure the response is strict JSON. Do not wrap in markdown or code blocks. Just raw JSON.`,
    });

    const respText = response.text || "{}";
    const cleanJsonText = respText.replace(/```json/g, "").replace(/```/g, "").trim();
    const data = JSON.parse(cleanJsonText);
    res.json(data);
  } catch (err: any) {
    console.error("Error classifying distraction:", err);
    res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// Fallback to serve index.html for any other routes
app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
