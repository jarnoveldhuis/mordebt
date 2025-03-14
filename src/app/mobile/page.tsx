"use client";

import React, { useState } from 'react';

// Define interfaces first
interface Purchase {
  id: number;
  vendor: string;
  item: string;
  price: number;
  impact: number;
  date: string;
  category: string;
}

interface QuickAction {
  name: string;
  impact: number;
  icon: string;
}

interface AlternativeProduct {
  category: string;
  name: string;
  vendor: string;
  savingsPercent: number;
}

// This is the app that's gonna make Jeff Bezos cry himself to sleep at night
const MobileImpactApp = () => {
  // State for this guilt machine
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showOffsetModal, setShowOffsetModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [impactScore, setImpactScore] = useState(78); // Higher is worse, like my credit score
  
  // Hardcoded purchases because fuck dependencies
  const recentPurchases: Purchase[] = [
    { id: 1, vendor: "Amazon", item: "Wireless Earbuds", price: 49.99, impact: 15, date: "Today", category: "Electronics" },
    { id: 2, vendor: "Starbucks", item: "Venti Latte", price: 5.75, impact: 8, date: "Today", category: "Food" },
    { id: 3, vendor: "Uber", item: "Ride Home", price: 12.50, impact: 10, date: "Yesterday", category: "Transport" },
    { id: 4, vendor: "H&M", item: "T-Shirt", price: 19.99, impact: 25, date: "2 days ago", category: "Fashion" }
  ];
  
  // Friends list to make you feel like shit in comparison
  const friends = [
    { name: "Sarah", score: 42, change: -8, avatar: "👩‍🦰" },
    { name: "Mike", score: 65, change: -2, avatar: "👨‍🦲" },
    { name: "You", score: 78, change: +5, avatar: "😬" },
    { name: "Dave", score: 91, change: +12, avatar: "🧔" }
  ];
  
  // Quick actions because people have the attention span of a coked-up squirrel
  const quickActions: QuickAction[] = [
    { name: "Offset Coffee", impact: -5, icon: "☕" },
    { name: "Plant Tree", impact: -10, icon: "🌳" },
    { name: "Clean Energy", impact: -20, icon: "⚡" }
  ];
  
  // Alternative products to replace your earth-killing purchases
  const alternativeProducts: AlternativeProduct[] = [
    { category: "Fashion", name: "Eco-friendly Tee", vendor: "Patagonia", savingsPercent: 76 },
    { category: "Electronics", name: "Refurbished Earbuds", vendor: "Back Market", savingsPercent: 45 },
    { category: "Food", name: "Local Coffee Shop", vendor: "Bean Bros", savingsPercent: 62 }
  ];
  
  // Handle purchase click
  const handlePurchaseClick = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setShowPurchaseModal(true);
  };
  
  // Handle quick action
  const handleQuickAction = (action: QuickAction) => {
    setImpactScore(prev => Math.max(0, prev + action.impact));
    
    // Show temporary success message
    alert(`You just ${action.impact < 0 ? 'reduced' : 'increased'} your impact by ${Math.abs(action.impact)} points!`);
  };

  // Handle offset
  const handleOffset = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setShowOffsetModal(true);
  };
  
  // Confirm offset
  const confirmOffset = () => {
    if (selectedPurchase) {
      setImpactScore(prev => Math.max(0, prev - selectedPurchase.impact));
      setShowOffsetModal(false);
      
      // Show success
      alert(`You offset your ${selectedPurchase.item} purchase! Your friends will be so impressed by your virtue!`);
    }
  };
  
  // Close purchase info
  const closePurchaseModal = () => {
    setShowPurchaseModal(false);
    setSelectedPurchase(null);
  };
  
  // Get color based on impact score
  const getScoreColor = (score: number) => {
    if (score < 40) return "text-green-500";
    if (score < 70) return "text-yellow-500";
    return "text-red-500";
  };
  
  // Get alternative product for a category
  const getAlternative = (category: string): AlternativeProduct => {
    return alternativeProducts.find(p => p.category === category) || alternativeProducts[0];
  };
  
  // Helper function to generate impact text
  const getImpactText = (purchase: Purchase) => {
    const impacts = [
      "Contributes to excessive carbon emissions",
      "Uses non-recyclable materials",
      "Involves exploitative labor practices",
      "Excessive water usage in production",
      "Contains harmful chemicals"
    ];
    
    // Use the purchase ID as a seed for consistent but seemingly random selection
    return impacts[purchase.id % impacts.length];
  };

  // Helper function for detailed impact
  const getDetailedImpactText = (purchase: Purchase) => {
    const details: Record<string, string> = {
      "Electronics": "Production required rare earth minerals mined with significant environmental damage. Manufacturing created approximately 20kg of CO2.",
      "Food": "Single-use packaging contributes to landfill waste. Transportation emissions equivalent to driving 5 miles.",
      "Transport": "Direct carbon emissions plus infrastructure impact. This ride produced approximately 3.2kg of CO2.",
      "Fashion": "Fast fashion production involves water pollution, textile waste, and often exploitative labor practices. This item used approximately 2,700 liters of water to produce."
    };
    
    return details[purchase.category] || "This purchase has a significant environmental and social impact.";
  };
  
  return (
    <div className="max-w-md mx-auto bg-gray-50 min-h-screen overflow-auto pb-20">
      {/* HEADER */}
      <header className="sticky top-0 bg-white p-4 border-b border-gray-200 shadow-sm z-10">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">EcoGuilt</h1>
          <div className="relative">
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">3</span>
            <span className="text-xl">🔔</span>
          </div>
        </div>
      </header>
      
      {/* IMPACT SCORE */}
      <div className="bg-white p-6 border-b border-gray-200">
        <h2 className="text-center text-gray-700 font-medium mb-2">Your Impact Score</h2>
        <div className="flex items-center justify-center mb-3">
          <div className={`text-5xl font-bold ${getScoreColor(impactScore)}`}>
            {impactScore}
          </div>
          <div className="text-red-500 ml-3 flex items-center">
            <span className="text-xs">+5</span>
            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path d="M10 3l8 8H2l8-8z"></path>
            </svg>
          </div>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${
              impactScore < 40 ? 'bg-green-500' : 
              impactScore < 70 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${impactScore}%` }}
          ></div>
        </div>
        <p className="text-center text-sm text-gray-500 mt-2">
          {impactScore > 70 ? "Terrible. Earth is crying." : 
           impactScore > 40 ? "Meh. You could do better." : 
           "Not bad! Keep it up!"}
        </p>
      </div>
      
      {/* FRIEND COMPARISON - THE GUILT TRIP */}
      <div className="bg-white p-4 border-b border-gray-200 mt-4">
        <h2 className="font-medium text-gray-700 mb-3">Friend Rankings</h2>
        <div className="space-y-3">
          {friends.sort((a, b) => a.score - b.score).map((friend, i) => (
            <div 
              key={i}
              className={`flex items-center p-3 rounded-lg ${friend.name === "You" ? "bg-blue-50 border border-blue-200" : ""}`}
            >
              <div className="text-2xl mr-3">{friend.avatar}</div>
              <div className="flex-grow">
                <div className="font-medium">{friend.name}</div>
                <div className="text-sm text-gray-500">
                  {friend.change < 0 ? `${Math.abs(friend.change)}% better this week` : `${friend.change}% worse this week`}
                </div>
              </div>
              <div className={`text-lg font-bold ${getScoreColor(friend.score)}`}>
                {friend.score}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* QUICK ACTIONS */}
      <div className="bg-white p-4 border-b border-gray-200 mt-4">
        <h2 className="font-medium text-gray-700 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map((action, i) => (
            <button
              key={i}
              onClick={() => handleQuickAction(action)}
              className="bg-green-50 border border-green-200 rounded-lg p-3 flex flex-col items-center hover:bg-green-100"
            >
              <span className="text-2xl mb-1">{action.icon}</span>
              <span className="text-xs font-medium text-gray-700">{action.name}</span>
              <span className="text-xs text-green-600">{action.impact}pts</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* RECENT PURCHASES - THE SHAME LIST */}
      <div className="bg-white p-4 border-b border-gray-200 mt-4">
        <h2 className="font-medium text-gray-700 mb-3">Recent Purchases</h2>
        <div className="space-y-3">
          {recentPurchases.map((purchase) => (
            <div 
              key={purchase.id}
              className="border border-gray-200 rounded-lg overflow-hidden"
            >
              <div 
                className="p-3 bg-white cursor-pointer"
                onClick={() => handlePurchaseClick(purchase)}
              >
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">{purchase.item}</div>
                    <div className="text-sm text-gray-500">
                      {purchase.vendor} · ${purchase.price.toFixed(2)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="text-red-500 font-medium">+{purchase.impact}pts</div>
                    <div className="text-xs text-gray-500">{purchase.date}</div>
                  </div>
                </div>
              </div>
              <div className="bg-red-50 p-2 border-t border-red-100 flex justify-between items-center">
                <div className="text-xs text-red-600">
                  <span className="font-medium">Impact:</span> {getImpactText(purchase)}
                </div>
                <button
                  onClick={() => handleOffset(purchase)}
                  className="text-xs bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded"
                >
                  Offset
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* BOTTOM NAV */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2">
        <button className="p-2 flex flex-col items-center text-blue-500">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
          </svg>
          <span className="text-xs">Home</span>
        </button>
        <button className="p-2 flex flex-col items-center text-gray-500">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path>
          </svg>
          <span className="text-xs">Scan</span>
        </button>
        <button className="p-2 flex flex-col items-center text-gray-500">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-6-3a2 2 0 11-4 0 2 2 0 014 0zm-2 4a5 5 0 00-4.546 2.916A5.986 5.986 0 0010 16a5.986 5.986 0 004.546-2.084A5 5 0 0010 11z" clipRule="evenodd"></path>
          </svg>
          <span className="text-xs">Profile</span>
        </button>
      </div>
      
      {/* PURCHASE MODAL */}
      {showPurchaseModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg max-w-sm w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold">Purchase Details</h2>
                <button 
                  onClick={closePurchaseModal}
                  className="text-gray-500"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
            </div>
            
            <div className="p-4">
              <div className="mb-4">
                <div className="text-xl font-medium">{selectedPurchase.item}</div>
                <div className="text-gray-500">{selectedPurchase.vendor} - ${selectedPurchase.price.toFixed(2)}</div>
              </div>
              
              <div className="bg-red-50 p-3 rounded-lg mb-4">
                <div className="flex justify-between items-center mb-2">
                  <div className="font-medium text-gray-800">Impact Score</div>
                  <div className="text-red-600 font-bold">+{selectedPurchase.impact} pts</div>
                </div>
                <p className="text-sm text-gray-700">
                  {getDetailedImpactText(selectedPurchase)}
                </p>
              </div>
              
              <div className="bg-green-50 p-3 rounded-lg mb-4">
                <h3 className="font-medium text-gray-800 mb-2">Better Alternative</h3>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{getAlternative(selectedPurchase.category).name}</div>
                    <div className="text-sm text-gray-600">{getAlternative(selectedPurchase.category).vendor}</div>
                  </div>
                  <div className="text-green-600 font-bold">
                    {getAlternative(selectedPurchase.category).savingsPercent}% better
                  </div>
                </div>
                <button className="mt-2 w-full bg-green-600 text-white py-2 rounded-lg">
                  Shop Alternative
                </button>
              </div>
              
              <button
                onClick={() => {
                  closePurchaseModal();
                  handleOffset(selectedPurchase);
                }}
                className="w-full bg-blue-600 text-white py-3 rounded-lg"
              >
                Offset This Purchase
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* OFFSET MODAL */}
      {showOffsetModal && selectedPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
          <div className="bg-white rounded-lg max-w-sm w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold">Offset Your Purchase</h2>
            </div>
            
            <div className="p-4">
              <div className="mb-4">
                <div className="text-center text-gray-700 mb-2">You&apos;re offsetting</div>
                <div className="text-xl font-medium text-center">{selectedPurchase.item}</div>
                <div className="text-red-600 font-bold text-center">+{selectedPurchase.impact} impact points</div>
              </div>
              
              <div className="bg-blue-50 p-3 rounded-lg mb-4">
                <p className="text-sm text-blue-800">
                  Your donation will fund projects that directly counter the environmental and social impacts of this purchase.
                </p>
              </div>
              
              <div className="mb-4">
                <div className="flex justify-between items-center p-3 border border-gray-200 rounded-lg">
                  <span className="font-medium">Donation Amount</span>
                  <span className="text-lg font-bold">${(selectedPurchase.impact * 0.5).toFixed(2)}</span>
                </div>
                <div className="text-xs text-gray-500 text-center mt-1">
                  Suggested amount based on actual environmental cost
                </div>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowOffsetModal(false)}
                  className="flex-1 py-3 border border-gray-300 rounded-lg text-gray-700"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmOffset}
                  className="flex-1 py-3 bg-green-600 text-white rounded-lg"
                >
                  Complete Offset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileImpactApp;