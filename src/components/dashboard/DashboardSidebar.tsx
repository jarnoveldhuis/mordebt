// src/components/dashboard/DashboardSidebar.tsx
import { User } from "firebase/auth";
import { useCallback } from "react";

interface DashboardSidebarProps {
  user: User;
  impactScore: number;
  activeView: string;
  onViewChange: (view: string) => void;
  totalSocietalDebt: number;
  offsetsThisMonth: number;
  hasTransactions: boolean;
}

export function DashboardSidebar({
  user,
  impactScore,
  activeView,
  onViewChange,
  totalSocietalDebt,
  offsetsThisMonth,
  hasTransactions
}: DashboardSidebarProps) {
  // Get score color based on the value
  const getScoreColor = useCallback((score: number): string => {
    if (score < 40) return "from-green-500 to-teal-600";
    if (score < 70) return "from-yellow-500 to-orange-600";
    return "from-red-500 to-pink-600";
  }, []);

  // Format the total debt for display
  const formattedDebt = Math.abs(totalSocietalDebt).toFixed(2);
  const debtColor = totalSocietalDebt > 0 ? "text-red-600" : "text-green-600";
  const debtLabel = totalSocietalDebt > 0 ? "Societal Debt" : "Positive Impact";

  return (
    <div className="lg:col-span-1">
      {/* Impact Score Card */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className={`bg-gradient-to-r ${getScoreColor(impactScore)} p-6 text-white`}>
          <div className="text-center">
            <h2 className="text-xl font-bold mb-1">Your Impact Score</h2>
            <div className="text-5xl font-black mb-2">
              {impactScore}
            </div>
          </div>
        </div>

        {/* Debt summary */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">{debtLabel}</span>
            <span className={`font-bold ${debtColor}`}>
              ${formattedDebt}
            </span>
          </div>
        </div>

        {/* Offsets this month */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Offsets This Month</span>
            <span className="font-bold">
              ${offsetsThisMonth.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <div className="p-4">
          <h3 className="font-medium mb-2">Dashboard Views</h3>
          <nav className="space-y-1">
            <NavButton 
              label="Transactions" 
              isActive={activeView === "transactions"} 
              onClick={() => onViewChange("transactions")}
              disabled={!hasTransactions}
            />
            <NavButton 
              label="Impact Summary" 
              isActive={activeView === "impact"} 
              onClick={() => onViewChange("impact")}
              disabled={!hasTransactions}
            />
            <NavButton 
              label="Categories" 
              isActive={activeView === "categories"} 
              onClick={() => onViewChange("categories")}
              disabled={!hasTransactions}
            />
            <NavButton 
              label="Practice Breakdown" 
              isActive={activeView === "practices"} 
              onClick={() => onViewChange("practices")}
              disabled={!hasTransactions}
            />
          </nav>
        </div>
      </div>

      {/* Recommended Offsets */}
      {hasTransactions && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-bold">Recommended Offsets</h3>
          </div>
          <div className="p-4 space-y-3">
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center mb-2">
                <div className="text-2xl mr-2">🌳</div>
                <div>
                  <h4 className="font-medium">Reforestation Project</h4>
                  <span className="text-xs text-gray-500">Climate Change</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-green-600 font-medium">-15 pts</span>
                <button
                  className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-full"
                  onClick={() => {
                    // In a real implementation, this would trigger the donation modal
                    alert("This would open the donation modal in a complete implementation");
                  }}
                >
                  Offset $25
                </button>
              </div>
            </div>
            
            <div className="border border-gray-200 rounded-lg p-3">
              <div className="flex items-center mb-2">
                <div className="text-2xl mr-2">🔄</div>
                <div>
                  <h4 className="font-medium">Carbon Offsets</h4>
                  <span className="text-xs text-gray-500">Environmental Impact</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-green-600 font-medium">-20 pts</span>
                <button
                  className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-full"
                  onClick={() => {
                    // In a real implementation, this would trigger the donation modal
                    alert("This would open the donation modal in a complete implementation");
                  }}
                >
                  Offset $30
                </button>
              </div>
            </div>
            
            <div className="text-center">
              <button className="text-sm text-blue-600 font-medium">
                See all offset projects
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Navigation button component
interface NavButtonProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function NavButton({ label, isActive, onClick, disabled = false }: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full px-3 py-2 rounded-lg transition-colors flex items-center ${
        isActive
          ? "bg-blue-50 border-blue-200 text-blue-800"
          : disabled
            ? "text-gray-400 cursor-not-allowed"
            : "hover:bg-gray-100 text-gray-700"
      }`}
    >
      <span className="capitalize">{label}</span>
    </button>
  );
}