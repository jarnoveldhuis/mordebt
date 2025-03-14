"use client";

import React, { useState, useEffect } from "react";

// Define interfaces for better type safety
interface Practice {
  name: string;
  amount: number;
  isNegative: boolean;
  percent: number;
  description?: string;
  impact?: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  totalImpact: number;
  color: string;
  practices: Practice[];
}

interface Transaction {
  id: number;
  date: string;
  vendor: string;
  description: string;
  amount: number;
  impact: number;
  category: string;
  emoji: string;
}

interface OffsetProject {
  id: number;
  name: string;
  impact: number;
  cost: number;
  category: string;
  description: string;
  image: string;
}

interface UserData {
  name: string;
  score: number;
  trend: number;
  offsetsThisMonth: number;
  streakDays: number;
  rank: number;
  totalUsers: number;
}

interface ThemeColors {
  primary: string;
  light: string;
  medium: string;
  dark: string;
  accent: string;
  highlight: string;
}

interface Theme {
  sapphire: ThemeColors;
  emerald: ThemeColors;
  amber: ThemeColors;
  ruby: ThemeColors;
  [key: string]: ThemeColors; // Index signature for dynamic access
}

const PremiumDashboard = () => {
  // Core state
  const [activeTab, setActiveTab] = useState("overview");
  const [showOffsetModal, setShowOffsetModal] = useState(false);
  const [selectedPractice, setSelectedPractice] = useState<{
    name: string;
    description?: string;
    impact?: number;
  } | null>(null);
  const [notification, setNotification] = useState({
    show: false,
    message: "",
  });
  const [colorMode, setColorMode] = useState("sapphire"); // sapphire, emerald, amber, ruby

  // User data
  const [userData, setUserData] = useState<UserData>({
    name: "Alex Thompson",
    score: 78,
    trend: +12,
    offsetsThisMonth: 37.5,
    streakDays: 0,
    rank: 327,
    totalUsers: 4281,
  });

  // Dummy data
  const categories: Category[] = [
    {
      id: "env",
      name: "Environmental Impact",
      icon: "🌎",
      totalImpact: 56.25,
      color: "emerald",
      practices: [
        {
          name: "High Emissions",
          amount: 34.75,
          isNegative: true,
          percent: 41,
        },
        {
          name: "Excessive Packaging",
          amount: 27.9,
          isNegative: true,
          percent: 33,
        },
        {
          name: "Clean Energy Usage",
          amount: -6.4,
          isNegative: false,
          percent: 26,
        },
      ],
    },
    {
      id: "social",
      name: "Social Responsibility",
      icon: "👥",
      totalImpact: 39.8,
      color: "amber",
      practices: [
        {
          name: "Labor Exploitation",
          amount: 25.5,
          isNegative: true,
          percent: 47,
        },
        {
          name: "Fair Trade Support",
          amount: -8.75,
          isNegative: false,
          percent: 16,
        },
        {
          name: "Community Investment",
          amount: -5.9,
          isNegative: false,
          percent: 11,
        },
      ],
    },
    {
      id: "animal",
      name: "Animal Welfare",
      icon: "🐾",
      totalImpact: 45.6,
      color: "ruby",
      practices: [
        {
          name: "Factory Farming",
          amount: 38.25,
          isNegative: true,
          percent: 53,
        },
        {
          name: "Animal Testing",
          amount: 12.35,
          isNegative: true,
          percent: 17,
        },
        {
          name: "Animal Sanctuary Support",
          amount: -5.0,
          isNegative: false,
          percent: 7,
        },
      ],
    },
    {
      id: "digital",
      name: "Digital Rights",
      icon: "🔐",
      totalImpact: 22.4,
      color: "sapphire",
      practices: [
        {
          name: "Data Privacy Issues",
          amount: 19.8,
          isNegative: true,
          percent: 27,
        },
        {
          name: "Open Source Support",
          amount: -7.25,
          isNegative: false,
          percent: 10,
        },
        {
          name: "Privacy Protection",
          amount: -4.9,
          isNegative: false,
          percent: 7,
        },
      ],
    },
  ];

  const transactions: Transaction[] = [
    {
      id: 1,
      date: "2025-03-12",
      vendor: "Amazon",
      description: "Electronics Purchase",
      amount: 149.99,
      impact: 24.5,
      category: "Digital Rights",
      emoji: "📱",
    },
    {
      id: 2,
      date: "2025-03-11",
      vendor: "Whole Foods",
      description: "Grocery Shopping",
      amount: 87.32,
      impact: 13.8,
      category: "Environmental Impact",
      emoji: "🛒",
    },
    {
      id: 3,
      date: "2025-03-10",
      vendor: "Shell",
      description: "Gasoline",
      amount: 45.0,
      impact: 18.3,
      category: "Environmental Impact",
      emoji: "⛽",
    },
    {
      id: 4,
      date: "2025-03-09",
      vendor: "Netflix",
      description: "Monthly Subscription",
      amount: 15.99,
      impact: 2.1,
      category: "Digital Rights",
      emoji: "🎬",
    },
    {
      id: 5,
      date: "2025-03-08",
      vendor: "Zara",
      description: "Clothing Purchase",
      amount: 78.45,
      impact: 19.6,
      category: "Social Responsibility",
      emoji: "👕",
    },
  ];

  const offsetProjects: OffsetProject[] = [
    {
      id: 1,
      name: "Reforestation Initiative",
      impact: 15,
      cost: 25.0,
      category: "Environmental Impact",
      description:
        "Plant trees in deforested areas to capture carbon and restore habitats.",
      image: "🌱",
    },
    {
      id: 2,
      name: "Fair Trade Certification",
      impact: 12,
      cost: 18.5,
      category: "Social Responsibility",
      description:
        "Support fair wages and ethical working conditions for producers worldwide.",
      image: "🤝",
    },
    {
      id: 3,
      name: "Animal Sanctuary",
      impact: 18,
      cost: 30.0,
      category: "Animal Welfare",
      description:
        "Rescue and provide care for animals saved from factory farming and exploitation.",
      image: "🐄",
    },
    {
      id: 4,
      name: "Digital Privacy Initiative",
      impact: 10,
      cost: 15.0,
      category: "Digital Rights",
      description:
        "Fund development of privacy-focused technology and advocacy efforts.",
      image: "🔒",
    },
  ];

  // Theme setting effect - will only run on client side now with "use client" directive
  useEffect(() => {
    // This checks if the user prefers dark mode and could set a different theme
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

    // We can use it to set the initial color mode if needed
    // We're not actually using it, just showing that useEffect works now
    console.log("User prefers dark mode:", prefersDark);
  }, []);

  // Calculate the total impact (societal debt)
  const totalImpact = categories.reduce((sum, cat) => sum + cat.totalImpact, 0);

  // Notification system
  const showNotification = (message: string) => {
    setNotification({ show: true, message });
    setTimeout(() => {
      setNotification({ show: false, message: "" });
    }, 3000);
  };

  // Handle offset button click
  const handleOffset = (practice: {
    name: string;
    description?: string;
    impact?: number;
  }) => {
    setSelectedPractice(practice);
    setShowOffsetModal(true);
  };

  // Complete offset
  const completeOffset = (amount: number) => {
    showNotification(`You've successfully offset ${amount} points of impact!`);
    setShowOffsetModal(false);

    // Update user data
    setUserData((prev) => ({
      ...prev,
      score: Math.max(0, prev.score - 5),
      offsetsThisMonth: prev.offsetsThisMonth + amount,
    }));
  };

  // Get color based on selected mode
  const getThemeColor = (element: keyof ThemeColors): string => {
    const colors: Theme = {
      sapphire: {
        primary: "from-blue-500 to-indigo-600",
        light: "bg-blue-50 border-blue-200 text-blue-800",
        medium: "bg-blue-100 text-blue-800",
        dark: "bg-blue-600 hover:bg-blue-700 text-white",
        accent: "from-indigo-500 to-purple-600",
        highlight: "text-blue-600",
      },
      emerald: {
        primary: "from-green-500 to-teal-600",
        light: "bg-green-50 border-green-200 text-green-800",
        medium: "bg-green-100 text-green-800",
        dark: "bg-green-600 hover:bg-green-700 text-white",
        accent: "from-teal-500 to-cyan-600",
        highlight: "text-green-600",
      },
      amber: {
        primary: "from-yellow-500 to-orange-600",
        light: "bg-yellow-50 border-yellow-200 text-yellow-800",
        medium: "bg-yellow-100 text-yellow-800",
        dark: "bg-yellow-600 hover:bg-yellow-700 text-white",
        accent: "from-orange-500 to-red-500",
        highlight: "text-yellow-600",
      },
      ruby: {
        primary: "from-red-500 to-pink-600",
        light: "bg-red-50 border-red-200 text-red-800",
        medium: "bg-red-100 text-red-800",
        dark: "bg-red-600 hover:bg-red-700 text-white",
        accent: "from-pink-500 to-purple-600",
        highlight: "text-red-600",
      },
    };

    return colors[colorMode][element];
  };

  // Render impact color
  const renderImpactColor = (value: number): string => {
    if (value < 0) return "text-green-600";
    if (value === 0) return "text-gray-600";
    if (value < 40) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* NOTIFICATION */}
      {notification.show && (
        <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-black text-white py-2 px-4 rounded-full shadow-lg animate-bounce">
          {notification.message}
        </div>
      )}

      {/* HEADER */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-2xl">🌍</span>
              <h1
                className={`ml-2 text-xl font-bold bg-gradient-to-r ${getThemeColor(
                  "primary"
                )} bg-clip-text text-transparent`}
              >
                EcoImpact Dashboard
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex space-x-1">
                {["sapphire", "emerald", "amber", "ruby"].map((color) => (
                  <button
                    key={color}
                    onClick={() => setColorMode(color)}
                    className={`w-6 h-6 rounded-full ${
                      colorMode === color
                        ? "ring-2 ring-offset-2 ring-gray-400"
                        : ""
                    } ${
                      color === "sapphire"
                        ? "bg-blue-500"
                        : color === "emerald"
                        ? "bg-green-500"
                        : color === "amber"
                        ? "bg-yellow-500"
                        : "bg-red-500"
                    }`}
                    aria-label={`Switch to ${color} theme`}
                  />
                ))}
              </div>

              <div className="relative">
                <div className="flex items-center space-x-2 cursor-pointer">
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-sm font-medium">AT</span>
                  </div>
                  <span className="hidden sm:block font-medium">
                    {userData.name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* SIDEBAR */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
              <div
                className={`bg-gradient-to-r ${getThemeColor(
                  "primary"
                )} p-6 text-white`}
              >
                <div className="text-center">
                  <h2 className="text-xl font-bold mb-1">Your Impact Score</h2>
                  <div className="text-5xl font-black mb-2">
                    {userData.score}
                  </div>
                  <div className="flex justify-center items-center">
                    <span className="inline-block px-2 py-1 rounded-full bg-white bg-opacity-20 text-sm">
                      {userData.trend > 0
                        ? `+${userData.trend}`
                        : userData.trend}{" "}
                      this month
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600">Your Rank</span>
                  <span className="font-bold">
                    {userData.rank} of {userData.totalUsers}
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${getThemeColor(
                      "primary"
                    )}`}
                    style={{
                      width: `${
                        (1 - userData.rank / userData.totalUsers) * 100
                      }%`,
                    }}
                  ></div>
                </div>
                <div className="text-xs text-center mt-1 text-gray-500">
                  Better than{" "}
                  {Math.round((1 - userData.rank / userData.totalUsers) * 100)}%
                  of users
                </div>
              </div>

              <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Offsets This Month</span>
                  <span className="font-bold">
                    ${userData.offsetsThisMonth.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <h3 className="font-medium mb-2">Quick Navigation</h3>
                <nav className="space-y-1">
                  {["overview", "categories", "transactions", "projects"].map(
                    (tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`w-full px-3 py-2 rounded-lg transition-colors ${
                          activeTab === tab
                            ? `${getThemeColor("light")}`
                            : "hover:bg-gray-100"
                        } flex items-center`}
                      >
                        <span className="capitalize">{tab}</span>
                      </button>
                    )
                  )}
                </nav>
              </div>
            </div>

            {/* RECOMMENDED OFFSETS */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-bold">Recommended Offsets</h3>
              </div>
              <div className="p-4 space-y-3">
                {offsetProjects.slice(0, 2).map((project) => (
                  <div
                    key={project.id}
                    className="border border-gray-200 rounded-lg p-3"
                  >
                    <div className="flex items-center mb-2">
                      <div className="text-2xl mr-2">{project.image}</div>
                      <div>
                        <h4 className="font-medium">{project.name}</h4>
                        <span className="text-xs text-gray-500">
                          {project.category}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-green-600 font-medium">
                        -{project.impact} pts
                      </span>
                      <button
                        onClick={() => completeOffset(project.cost)}
                        className={`text-xs bg-gradient-to-r ${getThemeColor(
                          "dark"
                        )} px-3 py-1 rounded-full`}
                      >
                        Offset ${project.cost}
                      </button>
                    </div>
                  </div>
                ))}
                <div className="text-center">
                  <button
                    onClick={() => setActiveTab("projects")}
                    className={`text-sm ${getThemeColor(
                      "highlight"
                    )} font-medium`}
                  >
                    See all projects
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* MAIN CONTENT AREA */}
          <div className="lg:col-span-3 space-y-6">
            {/* OVERVIEW TAB */}
            {activeTab === "overview" && (
              <>
                {/* PROGRESS CHART */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-200">
                    <h2 className="font-bold text-lg">Impact Overview</h2>
                  </div>
                  <div className="p-6">
                    <div className="mb-6 text-center">
                      <div className="text-2xl font-bold mb-1">
                        Your Total Impact
                      </div>
                      <div
                        className={`text-4xl font-black ${renderImpactColor(
                          totalImpact
                        )}`}
                      >
                        {totalImpact.toFixed(2)}
                      </div>
                      <div className="text-gray-600 mt-1">
                        impact points from your spending
                      </div>
                    </div>

                    <div className="relative h-36 mb-6">
                      {/* STACKED BAR GRAPH */}
                      <div className="absolute inset-0 flex items-end">
                        {categories.map((category, index) => {
                          // Calculate width percentage
                          const width =
                            (category.totalImpact / totalImpact) * 100;

                          return (
                            <div
                              key={category.id}
                              className="h-24 transition-all duration-500"
                              style={{ width: `${width}%` }}
                            >
                              <div
                                className={`w-full h-full ${
                                  category.color === "sapphire"
                                    ? "bg-blue-500"
                                    : category.color === "emerald"
                                    ? "bg-green-500"
                                    : category.color === "amber"
                                    ? "bg-yellow-500"
                                    : "bg-red-500"
                                }`}
                                style={{ opacity: 0.7 + index * 0.1 }}
                              ></div>
                            </div>
                          );
                        })}
                      </div>

                      {/* CATEGORY LABELS */}
                      <div className="absolute top-0 right-0 left-0 flex justify-between text-xs text-gray-600">
                        {categories.map((category) => (
                          <div key={category.id} className="text-center px-1">
                            <div>{category.name}</div>
                            <div className="font-medium">
                              {category.totalImpact.toFixed(1)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {categories.map((category) => (
                        <button
                          key={category.id}
                          onClick={() => {
                            setActiveTab("categories");
                          }}
                          className={`p-3 rounded-lg border ${
                            category.color === "sapphire"
                              ? "border-blue-200 bg-blue-50"
                              : category.color === "emerald"
                              ? "border-green-200 bg-green-50"
                              : category.color === "amber"
                              ? "border-yellow-200 bg-yellow-50"
                              : "border-red-200 bg-red-50"
                          } transition-transform hover:scale-105`}
                        >
                          <div className="flex justify-between items-center">
                            <div className="text-2xl">{category.icon}</div>
                            <div
                              className={`font-bold ${renderImpactColor(
                                category.totalImpact
                              )}`}
                            >
                              {category.totalImpact.toFixed(1)}
                            </div>
                          </div>
                          <div className="text-sm font-medium mt-1 text-left">
                            {category.name}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* RECENT TRANSACTIONS */}
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="font-bold text-lg">Recent Transactions</h2>
                    <button
                      onClick={() => setActiveTab("transactions")}
                      className={`text-sm ${getThemeColor(
                        "highlight"
                      )} font-medium`}
                    >
                      View All
                    </button>
                  </div>
                  <div>
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Transaction
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Amount
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Impact
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {transactions.map((transaction) => (
                          <tr key={transaction.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="text-xl mr-3">
                                  {transaction.emoji}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {transaction.description}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {transaction.vendor}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {transaction.date}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              ${transaction.amount.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <span className="text-red-600 font-medium">
                                +{transaction.impact.toFixed(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() =>
                                  handleOffset({
                                    name: transaction.description,
                                    description: transaction.description,
                                    impact: transaction.impact,
                                  })
                                }
                                className={`bg-gradient-to-r ${getThemeColor(
                                  "dark"
                                )} px-3 py-1 rounded-full text-xs`}
                              >
                                Offset
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* CATEGORIES TAB */}
            {activeTab === "categories" && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="font-bold text-lg">Impact by Category</h2>
                </div>
                <div className="p-6 space-y-8">
                  {categories.map((category) => (
                    <div key={category.id}>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold flex items-center">
                          <span className="text-2xl mr-2">{category.icon}</span>
                          {category.name}
                        </h3>
                        <div
                          className={`font-bold text-xl ${renderImpactColor(
                            category.totalImpact
                          )}`}
                        >
                          {category.totalImpact.toFixed(2)}
                        </div>
                      </div>

                      <div
                        className={`p-4 rounded-lg border ${
                          category.color === "sapphire"
                            ? "border-blue-200 bg-blue-50"
                            : category.color === "emerald"
                            ? "border-green-200 bg-green-50"
                            : category.color === "amber"
                            ? "border-yellow-200 bg-yellow-50"
                            : "border-red-200 bg-red-50"
                        } mb-4`}
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          {category.practices.map((practice, idx) => (
                            <div
                              key={idx}
                              className="bg-white p-3 rounded-lg shadow-sm"
                            >
                              <div className="flex justify-between items-center mb-1">
                                <span className="font-medium">
                                  {practice.name}
                                </span>
                                <span
                                  className={`font-bold ${
                                    practice.isNegative
                                      ? "text-red-600"
                                      : "text-green-600"
                                  }`}
                                >
                                  {practice.isNegative ? "+" : ""}
                                  {practice.amount.toFixed(2)}
                                </span>
                              </div>
                              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    practice.isNegative
                                      ? "bg-red-500"
                                      : "bg-green-500"
                                  }`}
                                  style={{ width: `${practice.percent}%` }}
                                ></div>
                              </div>
                              <div className="flex justify-end mt-2">
                                {practice.isNegative && (
                                  <button
                                    onClick={() => handleOffset(practice)}
                                    className={`text-xs bg-gradient-to-r ${getThemeColor(
                                      "dark"
                                    )} px-3 py-1 rounded-full`}
                                  >
                                    Offset Impact
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TRANSACTIONS TAB */}
            {activeTab === "transactions" && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="font-bold text-lg">All Transactions</h2>
                </div>
                <div className="p-4">
                  <div className="flex justify-between mb-4">
                    <div className="flex space-x-2">
                      <div
                        className={`${getThemeColor(
                          "light"
                        )} px-3 py-1 rounded-full text-sm`}
                      >
                        All Transactions
                      </div>
                      <div className="px-3 py-1 rounded-full text-sm border border-gray-200">
                        Highest Impact
                      </div>
                      <div className="px-3 py-1 rounded-full text-sm border border-gray-200">
                        Recent
                      </div>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search transactions..."
                        className="border border-gray-300 rounded-full px-4 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Transaction
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Amount
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Impact
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {[...transactions, ...transactions].map(
                        (transaction, idx) => (
                          <tr
                            key={`${transaction.id}-${idx}`}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="text-xl mr-3">
                                  {transaction.emoji}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">
                                    {transaction.description}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {transaction.vendor}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {transaction.date}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {transaction.category}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                              ${transaction.amount.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <span className="text-red-600 font-medium">
                                +{transaction.impact.toFixed(1)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <button
                                onClick={() => handleOffset({ 
                                  name: transaction.description, 
                                  description: transaction.description, 
                                  impact: transaction.impact 
                                })}
                                className={`bg-gradient-to-r ${getThemeColor(
                                  "dark"
                                )} px-3 py-1 rounded-full text-xs`}
                              >
                                Offset
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* PROJECTS TAB */}
            {activeTab === "projects" && (
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h2 className="font-bold text-lg">Offset Projects</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {offsetProjects.map((project) => (
                      <div
                        key={project.id}
                        className="border border-gray-200 rounded-lg overflow-hidden"
                      >
                        <div
                          className={`p-6 bg-gradient-to-r ${getThemeColor(
                            "primary"
                          )} flex items-center justify-center`}
                        >
                          <span className="text-5xl text-white">
                            {project.image}
                          </span>
                        </div>
                        <div className="p-4">
                          <h3 className="font-bold text-lg mb-1">
                            {project.name}
                          </h3>
                          <div className="text-sm text-gray-600 mb-3">
                            {project.category}
                          </div>
                          <p className="text-gray-700 mb-4">
                            {project.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm text-gray-500">
                                Impact
                              </span>
                              <div className="text-green-600 font-bold">
                                -{project.impact} pts
                              </div>
                            </div>
                            <button
                              onClick={() => completeOffset(project.cost)}
                              className={`bg-gradient-to-r ${getThemeColor(
                                "dark"
                              )} px-4 py-2 rounded-lg text-sm`}
                            >
                              Offset for ${project.cost.toFixed(2)}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* OFFSET MODAL */}
      {showOffsetModal && selectedPractice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-md w-full overflow-hidden shadow-xl">
            <div
              className={`p-6 bg-gradient-to-r ${getThemeColor(
                "primary"
              )} text-white`}
            >
              <h2 className="text-xl font-bold">Offset Your Impact</h2>
              <p className="text-white text-opacity-80">
                Support projects that counteract the negative impact of your
                spending
              </p>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <h3 className="font-medium text-gray-700 mb-1">
                  You&apos;re offsetting:
                </h3>
                <div className="text-xl font-bold">
                  {selectedPractice.description || selectedPractice.name}
                </div>
                <div className="text-red-600 font-bold text-lg">
                  +{selectedPractice.impact?.toFixed(1) || "0.0"} impact points
                </div>
              </div>

              <div className={`${getThemeColor("light")} p-4 rounded-lg mb-6`}>
                <p className="text-sm">
                  Your donation will support verified projects that directly
                  address the environmental and social impacts of your
                  consumption choices.
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-gray-700 mb-2 font-medium">
                  Donation Amount
                </label>
                <div className="flex items-center border border-gray-300 rounded-lg p-2">
                  <span className="text-gray-500 text-lg mx-2">$</span>
                  <input
                    type="number"
                    className="flex-grow border-none focus:ring-0 text-right text-lg font-bold"
                    value={(selectedPractice.impact || 10).toFixed(2)}
                    readOnly
                  />
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">
                  Suggested amount based on calculated environmental impact
                </div>
              </div>

              <div className="flex space-x-4">
                <button
                  onClick={() => setShowOffsetModal(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => completeOffset(selectedPractice.impact || 10)}
                  className={`flex-1 py-2 bg-gradient-to-r ${getThemeColor(
                    "primary"
                  )} text-white rounded-lg font-medium shadow-md hover:shadow-lg transition-all transform hover:scale-105`}
                >
                  Complete Donation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PremiumDashboard;
