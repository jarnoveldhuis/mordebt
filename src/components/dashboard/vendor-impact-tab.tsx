import React, { useState, useMemo } from 'react';
import { Transaction } from '@/shared/types/transactions';
// import { LoadingSpinner } from '@/shared/components/ui/LoadingSpinner';

interface VendorImpactTabProps {
  transactions: Transaction[];
  totalSocietalDebt: number | null;
  onOffsetVendor?: (vendorName: string, amount: number) => void;
}

interface VendorImpact {
  name: string;
  totalSpent: number;
  impactAmount: number;
  impactPercentage: number;
  transactions: number;
  practices: {
    name: string;
    impact: number;
    isEthical: boolean;
  }[];
}

const VendorImpactTab: React.FC<VendorImpactTabProps> = ({
  transactions,
  // totalSocietalDebt,
  onOffsetVendor
}) => {
  const [sortBy, setSortBy] = useState<'impact' | 'spent' | 'percentage'>('impact');
  const [filterType, setFilterType] = useState<'all' | 'negative' | 'positive'>('all');
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);

  // Process transactions to get vendor impacts
  const vendorImpacts = useMemo(() => {
    // Create a map to hold vendor data
    const vendorMap = new Map<string, VendorImpact>();
    
    // Process each transaction
    transactions.forEach(tx => {
      const vendorName = tx.name;
      const amount = tx.amount;
      const societalDebt = tx.societalDebt || 0;
      
      // Initialize vendor if needed
      if (!vendorMap.has(vendorName)) {
        vendorMap.set(vendorName, {
          name: vendorName,
          totalSpent: 0,
          impactAmount: 0,
          impactPercentage: 0,
          transactions: 0,
          practices: []
        });
      }
      
      const vendor = vendorMap.get(vendorName)!;
      
      // Update base vendor metrics
      vendor.totalSpent += amount;
      vendor.impactAmount += societalDebt;
      vendor.transactions += 1;
      
      // Process practices for this transaction
      const uniquePractices = new Set<string>();
      
      // Add unethical practices
      (tx.unethicalPractices || []).forEach(practice => {
        if (!uniquePractices.has(practice)) {
          uniquePractices.add(practice);
          
          // Calculate impact for this practice
          const weight = tx.practiceWeights?.[practice] || 0;
          const practiceImpact = tx.amount * (weight / 100);
          
          // Check if practice already exists for vendor
          const existingPractice = vendor.practices.find(p => p.name === practice);
          
          if (existingPractice) {
            existingPractice.impact += practiceImpact;
          } else {
            vendor.practices.push({
              name: practice,
              impact: practiceImpact,
              isEthical: false
            });
          }
        }
      });
      
      // Add ethical practices
      (tx.ethicalPractices || []).forEach(practice => {
        if (!uniquePractices.has(practice)) {
          uniquePractices.add(practice);
          
          // Calculate impact for this practice (negative value for ethical practices)
          const weight = tx.practiceWeights?.[practice] || 0;
          const practiceImpact = -1 * (tx.amount * (weight / 100));
          
          // Check if practice already exists for vendor
          const existingPractice = vendor.practices.find(p => p.name === practice);
          
          if (existingPractice) {
            existingPractice.impact += practiceImpact;
          } else {
            vendor.practices.push({
              name: practice,
              impact: practiceImpact,
              isEthical: true
            });
          }
        }
      });
    });
    
    // Calculate impact percentages and sort practices
    vendorMap.forEach(vendor => {
      // Calculate impact as percentage of total spent
      vendor.impactPercentage = (vendor.impactAmount / vendor.totalSpent) * 100;
      
      // Sort practices by absolute impact (highest first)
      vendor.practices.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    });
    
    // Convert to array for rendering
    return Array.from(vendorMap.values());
  }, [transactions]);
  
  // Apply sorting and filtering
  const filteredVendors = useMemo(() => {
    let filtered = [...vendorImpacts];
    
    // Apply type filter
    if (filterType === 'negative') {
      filtered = filtered.filter(vendor => vendor.impactAmount > 0);
    } else if (filterType === 'positive') {
      filtered = filtered.filter(vendor => vendor.impactAmount < 0);
    }
    
    // Apply sorting
    if (sortBy === 'impact') {
      filtered.sort((a, b) => Math.abs(b.impactAmount) - Math.abs(a.impactAmount));
    } else if (sortBy === 'spent') {
      filtered.sort((a, b) => b.totalSpent - a.totalSpent);
    } else if (sortBy === 'percentage') {
      filtered.sort((a, b) => Math.abs(b.impactPercentage) - Math.abs(a.impactPercentage));
    }
    
    return filtered;
  }, [vendorImpacts, sortBy, filterType]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };
  
  // Get color based on impact
  const getImpactColor = (value: number): string => {
    if (value < 0) return "text-green-600"; // Positive impact (reduces debt)
    if (value === 0) return "text-gray-600"; // Neutral impact
    if (value < 15) return "text-yellow-600"; // Low negative impact
    if (value < 30) return "text-orange-600"; // Medium negative impact
    return "text-red-600"; // High negative impact
  };

  // Handle the offset action
  const handleOffset = (vendorName: string, amount: number) => {
    if (onOffsetVendor) {
      onOffsetVendor(vendorName, amount);
    } else {
      // Default behavior: show vendor details
      setSelectedVendor(vendorName);
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No transaction data available.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Vendor Impact Analysis</h2>
      
      {/* Filter and sort controls */}
      <div className="flex flex-wrap justify-between gap-4 mb-6">
        <div className="flex space-x-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filterType === 'all' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            All Vendors
          </button>
          <button
            onClick={() => setFilterType('negative')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filterType === 'negative' 
                ? 'bg-red-100 text-red-800' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            Negative Impact
          </button>
          <button
            onClick={() => setFilterType('positive')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filterType === 'positive' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            Positive Impact
          </button>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'impact' | 'spent' | 'percentage')}
            className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="impact">Impact Amount</option>
            <option value="spent">Total Spent</option>
            <option value="percentage">Impact Percentage</option>
          </select>
        </div>
      </div>
      
      {/* Vendor list */}
      <div className="space-y-4">
        {filteredVendors.length === 0 ? (
          <div className="text-center p-6 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-gray-600">No vendors match your current filters.</p>
          </div>
        ) : (
          filteredVendors.map((vendor) => (
            <div 
              key={vendor.name}
              className={`border rounded-lg overflow-hidden transition-colors ${
                selectedVendor === vendor.name ? 'border-blue-400 bg-blue-50' : 'border-gray-200'
              }`}
            >
              {/* Vendor header */}
              <div 
                className="p-4 cursor-pointer"
                onClick={() => setSelectedVendor(selectedVendor === vendor.name ? null : vendor.name)}
              >
                <div className="flex flex-wrap justify-between mb-2">
                  <div className="mb-2 md:mb-0">
                    <h3 className="font-medium text-lg">{vendor.name}</h3>
                    <div className="text-sm text-gray-500">
                      {vendor.transactions} transaction{vendor.transactions !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">{formatCurrency(vendor.totalSpent)}</div>
                    <div className={`font-medium ${getImpactColor(vendor.impactAmount)}`}>
                      Impact: {formatCurrency(Math.abs(vendor.impactAmount))}
                      <span className="text-xs ml-1">
                        ({vendor.impactPercentage.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Impact visualization */}
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${vendor.impactAmount < 0 ? 'bg-green-500' : 'bg-red-500'}`}
                    style={{ 
                      width: `${Math.min(Math.abs(vendor.impactPercentage) * 3, 100)}%` 
                    }}
                  ></div>
                </div>
              </div>
              
              {/* Detailed view when selected */}
              {selectedVendor === vendor.name && (
                <div className="p-4 border-t border-gray-200 bg-white">
                  <h4 className="font-medium text-gray-800 mb-2">Impact Breakdown</h4>
                  
                  {vendor.practices.length === 0 ? (
                    <p className="text-gray-500 text-sm">No specific practices identified.</p>
                  ) : (
                    <div className="space-y-2">
                      {vendor.practices.map((practice, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <div className="flex items-center">
                            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
                              practice.isEthical ? 'bg-green-500' : 'bg-red-500'
                            }`}></span>
                            <span className="text-sm font-medium">{practice.name}</span>
                          </div>
                          <span className={`text-sm font-medium ${getImpactColor(practice.impact)}`}>
                            {formatCurrency(Math.abs(practice.impact))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  <div className="mt-4 flex justify-end">
                    {vendor.impactAmount > 0 && (
                      <button
                        onClick={() => handleOffset(vendor.name, vendor.impactAmount)}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        Offset Impact (${vendor.impactAmount.toFixed(2)})
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default VendorImpactTab;