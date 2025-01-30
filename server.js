require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const NodeCache = require("node-cache");
const validator = require("validator");

const app = express();
const PORT = process.env.PORT || 5000;
const cache = new NodeCache({ stdTTL: 60 });

const corsOptions = {
  origin: "http://localhost:3000",
  methods: "GET,POST",
  allowedHeaders: "Content-Type",
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(helmet());

// Rate limiting to prevent spam
const limiter = rateLimit({ windowMs: 60 * 1000, max: 10 });
app.use("/generate", limiter);

// API for generating compliments
app.post("/generate", async (req, res) => {
  const name = req.body.name?.trim() || "friend";

  if (!validator.isAlpha(name)) {
    return res.status(400).send("Invalid name input.");
  }

  // Check cache
  if (cache.has(name)) {
    return res.json({ compliment: cache.get(name) });
  }

  try {
    const response = await axios.post(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3",
      {
        inputs: `Only give a **single, kind compliment** to ${name}. Do not include anything else—no explanations, context, or additional text. The response should consist of **nothing but the compliment**.`
      },
      { headers: { Authorization: `Bearer ${process.env.HF_API_KEY}` } }
    );

    // Ensure we only return the compliment part and not the prompt
    let compliment =
      response.data[0]?.generated_text || `You're awesome, ${name}!`;

    // If the generated text includes the prompt, clean it up
    if (
      compliment.startsWith(
        `Only give a **single, kind compliment** to ${name}`
      )
    ) {
      compliment = compliment
        .replace(
          `Only give a **single, kind compliment** to ${name}. Do not include anything else—no explanations, context, or additional text. The response should consist of **nothing but the compliment**.`,
          ""
        )
        .trim();
    }

    cache.set(name, compliment);
    console.log(compliment);

    res.json({ compliment });
  } catch (error) {
    console.error("AI Request Failed:", error.message);
    res.status(500).json({ error: "Failed to generate compliment." });
  }
});

app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);
