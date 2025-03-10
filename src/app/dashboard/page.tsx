"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { onAuthStateChanged, signOut, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import { auth } from "@/firebase/firebase";
import PlaidLink from "@/components/PlaidLink";


// We'll define the interface types outside the component
interface Transaction {
  date: string;
  name: string;
  amount: number;
  societalDebt: number;
  unethicalPractices: string[];
  ethicalPractices: string[];
  information?: string;
  charities: Record<string, { name: string; url: string }>;
  practiceDebts?: Record<string, number>; // + or -
  practiceWeights?: Record<string, number>; // percentages
}




interface Charity {
  name: string;
  url: string;
}

export default function Dashboard() {
  // ------------------ 1) All useState hooks at the top ------------------
  const router = useRouter();

  // Auth states
  const [user, setUser] = useState<User | null>(null);

  // Existing “dashboard” states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalSocietalDebt, setTotalSocietalDebt] = useState<number | null>(
    null
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedCharity, _setSelectedCharity] = useState<string | null>(null);
  const [practiceDonations, setPracticeDonations] = useState<
    Record<string, { charity: Charity | null; amount: number }>
  >({});
  const [debtPercentage, setDebtPercentage] = useState<number | null>(null);
  const [bankConnected, setBankConnected] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisCompleted, setAnalysisCompleted] = useState(false);

  // Refs
  const isAnalyzing = useRef(false);

  // ----------------------------------------------------------------------
  // 2) Utility function for color coding
  function getColorClass(value: number) {
    if (value < 0) return "text-green-500";
    if (value === 0) return "text-blue-500";
    if (value <= 10) return "text-yellow-500";
    if (value <= 20) return "text-orange-500";
    if (value <= 50) return "text-red-500";
    return "text-red-700";
  }

  // ----------------------------------------------------------------------
  // 3) Auth check: on mount, see if user is logged in; if not, redirect
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/signin"); // or show a "Please log in" screen
      } else {
        setUser(currentUser);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // ----------------------------------------------------------------------
  // 4) Data fetching and analysis Hooks / logic

  // (A) handleAnalyze as a stable callback
  const handleAnalyze = useCallback(
    async (transactionsToAnalyze: Transaction[] = transactions) => {
      if (analysisCompleted || transactionsToAnalyze.length === 0) return;

      setAnalyzing(true);
      setTotalSocietalDebt(null);

      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions: transactionsToAnalyze }),
        });

        const data = await response.json();
        if (data.transactions) {
          // Sort them by largest debt
          const sortedTransactions = data.transactions
            .map((t: Transaction) => ({
              ...t,
              unethicalPractices: t.unethicalPractices || [],
              ethicalPractices: t.ethicalPractices || [],
              charities: t.charities || {},
            }))
            .sort(
              (a: Transaction, b: Transaction) =>
                (b.societalDebt ?? 0) - (a.societalDebt ?? 0)
            );

          setTransactions(sortedTransactions);

          let totalDebt = 0;
          const newPracticeDonations: Record<
            string,
            { charity: Charity | null; amount: number }
          > = {};

          data.transactions.forEach((tx: Transaction) => {
            totalDebt += tx.societalDebt;
            Object.entries(tx.practiceDebts || {}).forEach(
              ([practice, amount]) => {
                const assignedCharity = tx.charities?.[practice] || null;
                if (!newPracticeDonations[practice]) {
                  newPracticeDonations[practice] = {
                    charity: assignedCharity,
                    amount: 0,
                  };
                }
                newPracticeDonations[practice].amount += amount;
              }
            );
          });

          setDebtPercentage(data.debtPercentage);
          setTotalSocietalDebt(totalDebt);
          setPracticeDonations(newPracticeDonations);
          setAnalysisCompleted(true);
        }
      } catch (error) {
        console.error("❌ Error in handleAnalyze:", error);
      }

      setAnalyzing(false);
    },
    [transactions, analysisCompleted]
  );

  // (B) Automatic analysis effect
  useEffect(() => {
    // If we have transactions, and we haven't analyzed yet, run handleAnalyze
    if (transactions.length > 0 && !analysisCompleted && !isAnalyzing.current) {
      isAnalyzing.current = true;
      handleAnalyze();
    }
  }, [transactions, analysisCompleted, handleAnalyze]);

  // (C) handlePlaidSuccess
  async function handlePlaidSuccess(public_token?: string) {
    try {
      setBankConnected(true);
      setLoadingTransactions(true);

      // In sandbox mode, auto-generate a token
      if (!public_token && process.env.PLAID_ENV === "sandbox") {
        console.log("⚡ Bypassing Plaid UI in Sandbox...");
        const sandboxResponse = await fetch(
          "https://sandbox.plaid.com/sandbox/public_token/create",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              institution_id: "ins_109508",
              initial_products: ["transactions"],
            }),
          }
        );
        const sandboxData = await sandboxResponse.json();
        public_token = sandboxData.public_token;
      }

      const response = await fetch("/api/plaid/exchange_token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token }),
      });

      const data = await response.json();
      if (data.access_token) {
        console.log("✅ Received Plaid Access Token:", data.access_token);
        fetchTransactions(data.access_token);
      }
    } catch (error) {
      console.error("❌ Error in handlePlaidSuccess:", error);
    }
  }

  // (D) fetchTransactions
  async function fetchTransactions(token: string) {
    setLoadingTransactions(true);
    let productNotReady = false;

    try {
      const response = await fetch("/api/plaid/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: token }),
      });

      if (response.status === 503) {
        productNotReady = true;
        const errorData = await response.json();
        console.warn("🚧 Transactions not ready:", errorData.error);
        // Optionally schedule an auto-retry in 10 seconds:
        setTimeout(() => fetchTransactions(token), 10000);
        return;
      }

      if (!response.ok) {
        console.error(`❌ Server error: ${response.status}`);
        return;
      }

      const data: Transaction[] = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        // ...update transactions
        setTransactions(
          data.map((t) => ({
            ...t,
            societalDebt: 0,
            unethicalPractices: t.unethicalPractices || [],
            ethicalPractices: t.ethicalPractices || [],
          }))
        );
        setAnalysisCompleted(false);
      } else {
        console.warn("⚠️ No transactions found.");
      }
    } catch (error) {
      console.error("❌ Error in fetchTransactions:", error);
    } finally {
      // Only stop spinner if it wasn't "PRODUCT_NOT_READY"
      if (!productNotReady) {
        setLoadingTransactions(false);
      }
    }
  }

  // ----------------------------------------------------------------------
  // 5) Logout logic
  async function handleLogout() {
    try {
      await signOut(auth);
      router.push("/signin");
    } catch (error) {
      console.error("Logout error:", error);
    }
  }

  // ----------------------------------------------------------------------
  // 6) Conditional render AFTER all hooks have run
  if (!user) {
    // If user is null, we show a loading or redirecting UI
    return <div className="text-center mt-10">Checking authentication...</div>;
  }

  // ----------------------------------------------------------------------
  // 7) Actual JSX once user is present
  return (
    <div className="min-h-screen bg-gray-100 flex justify-center items-center">
      <div className="bg-white shadow-lg rounded-lg p-8 max-w-2xl w-full">
        {/* Page Indicator & Logout */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm text-gray-500">
            {user.email}
          </span>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded shadow"
          >
            Logout
          </button>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 text-center mb-3">
          Societal Debt Calculator
        </h1>

        {!bankConnected && (
          <div className="flex justify-center mb-6">
            <PlaidLink onSuccess={handlePlaidSuccess} />
          </div>
        )}

        {/* Spinner if fetching transactions */}
        {bankConnected && loadingTransactions && (
          <div className="flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
            <span className="ml-2 text-gray-700">Loading transactions...</span>
          </div>
        )}

        <div className="text-center text-lg font-semibold mb-4">
          {analyzing ? (
            <div className="flex justify-center items-center">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
              <span className="ml-2 text-gray-700">
                Calculating your societal debt...
              </span>
            </div>
          ) : (
            <>
              <p
                className={`text-2xl font-bold ${getColorClass(
                  debtPercentage || 0
                )} text-center`}
              >
                {/* Potential overall debt label if desired */}
              </p>
            </>
          )}
        </div>

        {/* Transactions List */}
        {transactions.length > 0 && !loadingTransactions && (
          <div className="bg-gray-50 p-4 rounded-lg shadow-sm mt-4">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Your Transactions
            </h2>
            <ul className="space-y-2 max-h-60 overflow-y-auto">
              {transactions.map((t, i) => {
                const allBadges = [
                  ...(t.unethicalPractices || []).map((practice) => ({
                    text: `${practice} (${t.practiceWeights?.[practice]}%)`,
                    type: "unethical",
                  })),
                  ...(t.ethicalPractices || []).map((practice) => ({
                    text: `${practice} (${t.practiceWeights?.[practice]}%)`,
                    type: "ethical",
                  })),
                ];

                return (
                  <li key={i} className="bg-white p-3 rounded-lg shadow-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-700">
                        {t.date} - {t.name} - ${t.amount.toFixed(2)}
                      </span>
                      <span
                        className={`font-semibold ${getColorClass(
                          t.societalDebt
                        )}`}
                      >
                        ${t.societalDebt.toFixed(2)}
                      </span>
                    </div>

                    {allBadges.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-2">
                        {allBadges.map((badge, idx) => {
                          const bgColor =
                            badge.type === "unethical"
                              ? "bg-red-200 text-red-700"
                              : "bg-green-200 text-green-700";
                          return (
                            <span
                              key={idx}
                              className={`${bgColor} text-xs px-2 py-1 rounded-lg`}
                            >
                              {badge.text}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Aggregated Donation Table */}
        {totalSocietalDebt !== null && !analyzing && (
          <div className="bg-gray-50 p-4 rounded-lg shadow-sm mt-4">
            <div className="flex flex-col md:flex-row justify-between items-start border-t border-gray-300 pt-4">
              {Object.keys(practiceDonations).length > 0 && (
                <div className="w-full text-left">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-gray-300">
                        <th className="text-left text-gray-700 p-2">
                          Practice
                        </th>
                        <th className="text-left text-gray-700 p-2">Charity</th>
                        <th className="text-left text-gray-700 p-2">
                          Information
                        </th>
                        <th className="text-right text-gray-700 p-2">Debt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(practiceDonations)
                        .sort(([, a], [, b]) => b.amount - a.amount)
                        .map(([practice, { charity, amount }], i) => {
                          // Find matching transaction to get the 'information' field
                          const transaction = transactions.find(
                            (tx) => tx.practiceDebts?.[practice] !== undefined
                          );


                          return (
                            <tr key={i} className="border-b border-gray-200">
                              <td
                                className={`p-2 font-medium ${
                                  amount >= 0
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                {practice}
                              </td>
                              <td className="p-2">
                                {charity ? (
                                  <a
                                    href={charity.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline font-medium"
                                  >
                                    {charity.name}
                                  </a>
                                ) : (
                                  <span className="text-gray-500">—</span>
                                )}
                              </td>
                              <td className="p-2">
                                {transaction?.information ? (
                                  <span className="text-gray-700">
                                    {transaction.information}
                                  </span>
                                ) : (
                                  <span className="text-gray-500">
                                    No info available
                                  </span>
                                )}
                              </td>

                              <td
                                className={`p-2 text-right font-bold ${
                                  amount >= 0
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                ${amount?.toFixed(2) ?? "0.00"}
                              </td>
                            </tr>
                          );
                        })}

                      {/* Total Debt Row */}
                      {totalSocietalDebt !== null && (
                        <tr className="border-t border-gray-300">
                          <td
                            colSpan={3}
                            className="p-2 text-right font-semibold"
                          >
                            <a
                              href={
                                selectedCharity ||
                                "https://www.charitynavigator.org"
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-4 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-bold shadow"
                            >
                              💳 Offset Impact
                            </a>
                          </td>
                          <td
                            className={`p-2 text-right font-bold ${
                              totalSocietalDebt > 0
                                ? "text-red-600"
                                : "text-green-600"
                            }`}
                          >
                            <h3 className="text-lg font-semibold text-gray-800">
                              Total Debt:
                            </h3>
                            <p
                              className={`text-${
                                totalSocietalDebt > 0 ? "red-500" : "green-500"
                              } text-2xl font-bold`}
                            >
                              ${totalSocietalDebt?.toFixed(2) || "Pending..."}
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
