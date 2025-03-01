"use client"; // Required for client-side interactivity

import { useState } from "react";
import PlaidLink from "@/components/PlaidLink";

export default function Dashboard() {
  type Transaction = {
    date: string;
    name: string;
    ethics: string;
    amount: number;
  };
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  // const [assessment, setAssessment] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  

  const [loading, setLoading] = useState(false);

  async function handlePlaidSuccess(public_token: string) {
    console.log("✅ Plaid Success! Received public_token:", public_token);

    const response = await fetch("/api/plaid/exchange_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_token }),
    });

    const data = await response.json();
    console.log("🔄 Exchange Token Response:", data);

    if (data.access_token) {
      setAccessToken(data.access_token);
      console.log("🔑 Current Access Token:", accessToken); // Prevents ESLint from flagging it
      fetchTransactions(data.access_token);
    }
  }

  async function fetchTransactions(token: string) {
    const response = await fetch("/api/plaid/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ access_token: token }),
    });

    const data = await response.json();
    console.log("📊 Transactions Response:", data);
    setTransactions(data);
  }

  async function handleAnalyze() {
    setLoading(true);
    
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions }),
    });

    const data = await response.json();
    if (data.transactions) {
      setTransactions(data.transactions); // Update transactions with ethics analysis
    }
    
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-gray-100 flex justify-center items-center">
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-gray-900 text-center mb-6">
          Ethical Debt Dashboard
        </h1>

        {/* Plaid Connect Button */}
        <div className="flex justify-center mb-6">
          <PlaidLink onSuccess={handlePlaidSuccess} />
        </div>

        {/* Transactions List */}
        {transactions.length > 0 && (
          <div className="bg-gray-50 p-4 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Your Transactions
            </h2>
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {transactions.map((t, i) => (
                <li key={i} className="bg-white p-3 rounded-lg shadow-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-700">{t.date} - {t.name}</span>
                    <span className="font-semibold text-gray-900">${t.amount}</span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {t.ethics || "Pending analysis..."}
                  </p>
                </li>
              ))}
            </ul>

            {/* Analyze Button */}
            <button
              onClick={handleAnalyze}
              className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200 flex justify-center"
            >
              {loading ? (
                <span className="animate-spin border-t-2 border-white border-solid rounded-full h-5 w-5"></span>
              ) : (
                "Analyze Ethical Debt"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
