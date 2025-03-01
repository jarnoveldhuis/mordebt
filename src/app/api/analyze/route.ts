import OpenAI from "openai";
import { NextResponse } from "next/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { transactions } = await req.json();

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: "Invalid transactions array" }, { status: 400 });
    }

    // Construct prompt for per-transaction analysis
    const prompt = `
      You are an ethical finance expert. Analyze the ethical impact of each purchase.
      Consider factors like sustainability, fair labor, and environmental harm.

      Transactions:
      ${transactions.map((t, i) => `${i + 1}. ${t.name} - $${t.amount}`).join("\n")}

      Return a JSON array with objects containing { "name": transaction name, "ethics": analysis }.
    `;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are an ethical finance assistant." },
        { role: "user", content: prompt },
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    let ethicsData;
    try {
      ethicsData = JSON.parse(response.choices[0]?.message?.content || "[]");
    } catch (err) {
      console.error("Error parsing OpenAI response:", err);
      return NextResponse.json({ error: "Failed to parse OpenAI response" }, { status: 500 });
    }

    // Merge ethics assessments back into transactions
    const updatedTransactions = transactions.map((t, i) => ({
      ...t,
      ethics: ethicsData[i]?.ethics || "No analysis available",
    }));

    return NextResponse.json({ transactions: updatedTransactions });
  } catch (error) {
    console.error("❌ OpenAI API Error:", error);
    return NextResponse.json({ error: "Failed to analyze transactions" }, { status: 500 });
  }
}
