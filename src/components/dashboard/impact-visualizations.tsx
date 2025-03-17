import React, { useState } from 'react';
import { Transaction } from '@/shared/types/transactions';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

interface ImpactVisualizationsProps {
  transactions: Transaction[];
  totalSocietalDebt: number | null;
}

// Helper function to aggregate transaction data by practices
const aggregatePracticeData = (transactions: Transaction[]): Array<{
  name: string;
  negative: number;
  positive: number;
  total: number;
}> => {
  const practiceImpacts: Record<string, { negative: number, positive: number }> = {};
  
  transactions.forEach(tx => {
    // Process unethical practices (positive societal debt)
    (tx.unethicalPractices || []).forEach(practice => {
      const weight = tx.practiceWeights?.[practice] || 0;
      const impact = tx.amount * (weight / 100);
      
      if (!practiceImpacts[practice]) {
        practiceImpacts[practice] = { negative: 0, positive: 0 };
      }
      
      practiceImpacts[practice].negative += impact;
    });
    
    // Process ethical practices (negative societal debt)
    (tx.ethicalPractices || []).forEach(practice => {
      const weight = tx.practiceWeights?.[practice] || 0;
      const impact = tx.amount * (weight / 100);
      
      if (!practiceImpacts[practice]) {
        practiceImpacts[practice] = { negative: 0, positive: 0 };
      }
      
      practiceImpacts[practice].positive += impact;
    });
  });
  
  // Convert to array format for charts
  return Object.entries(practiceImpacts)
    .map(([name, { negative, positive }]) => ({
      name: name.length > 15 ? name.substring(0, 15) + '...' : name,
      negative,
      positive,
      total: negative - positive,
    }))
    .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
    .slice(0, 8); // Limit to top 8 practices
};

// Helper function to aggregate transaction data by vendors
const aggregateVendorData = (transactions: Transaction[]): Array<{
  name: string;
  spent: number;
  impact: number;
  percentage: number;
}> => {
  const vendorImpacts: Record<string, { spent: number, impact: number }> = {};
  
  transactions.forEach(tx => {
    const vendor = tx.name;
    const amount = tx.amount;
    const impact = tx.societalDebt || 0;
    
    if (!vendorImpacts[vendor]) {
      vendorImpacts[vendor] = { spent: 0, impact: 0 };
    }
    
    vendorImpacts[vendor].spent += amount;
    vendorImpacts[vendor].impact += impact;
  });
  
  // Convert to array format for charts
  return Object.entries(vendorImpacts)
    .map(([name, { spent, impact }]) => ({
      name: name.length > 12 ? name.substring(0, 12) + '...' : name,
      spent,
      impact,
      percentage: (impact / spent) * 100
    }))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
    .slice(0, 8); // Limit to top 8 vendors
};

// Helper function to aggregate impact by month
const aggregateImpactByMonth = (transactions: Transaction[]): Array<{
  month: string;
  spent: number;
  impact: number;
  percentage: number;
}> => {
  const monthlyData: Record<string, { spent: number, impact: number }> = {};
  
  // Sort transactions by date
  const sortedTransactions = [...transactions].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  
  sortedTransactions.forEach(tx => {
    // Format date to YYYY-MM
    const date = new Date(tx.date);
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!monthlyData[month]) {
      monthlyData[month] = { spent: 0, impact: 0 };
    }
    
    monthlyData[month].spent += tx.amount;
    monthlyData[month].impact += tx.societalDebt || 0;
  });
  
  // Convert to array format for charts
  return Object.entries(monthlyData)
    .map(([month, { spent, impact }]) => {
      // Format month for display (MM-YYYY)
      const [year, monthNum] = month.split('-');
      const displayMonth = `${monthNum}/${year.slice(2)}`;
      
      return {
        month: displayMonth,
        spent,
        impact,
        percentage: (impact / spent) * 100
      };
    });
};

// Define chart colors
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];
const RED_COLORS = ['#ef4444', '#dc2626', '#b91c1c', '#991b1b', '#7f1d1d'];
const GREEN_COLORS = ['#10b981', '#059669', '#047857', '#065f46', '#064e3b'];

const ImpactVisualizations: React.FC<ImpactVisualizationsProps> = ({
  transactions,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  totalSocietalDebt
}) => {
  const [chartType, setChartType] = useState<'practices' | 'vendors' | 'timeline'>('practices');
  
  // Prepare data for visualizations
  const practiceData = React.useMemo(() => aggregatePracticeData(transactions), [transactions]);
  const vendorData = React.useMemo(() => aggregateVendorData(transactions), [transactions]);
  const timelineData = React.useMemo(() => aggregateImpactByMonth(transactions), [transactions]);
  
  // Custom tooltip formatter for currency
  const formatTooltipValue = (value: number, name: string) => {
    return [`$${Math.abs(value).toFixed(2)}`, name];
  };
  
  if (transactions.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No transaction data available for visualization.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Impact Visualizations</h2>
      
      {/* Chart selector */}
      <div className="flex space-x-2 mb-6">
        <button
          onClick={() => setChartType('practices')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            chartType === 'practices' 
              ? 'bg-blue-100 text-blue-800 border border-blue-300' 
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200'
          }`}
        >
          Practices Impact
        </button>
        <button
          onClick={() => setChartType('vendors')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            chartType === 'vendors' 
              ? 'bg-blue-100 text-blue-800 border border-blue-300' 
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200'
          }`}
        >
          Vendor Impact
        </button>
        <button
          onClick={() => setChartType('timeline')}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            chartType === 'timeline' 
              ? 'bg-blue-100 text-blue-800 border border-blue-300' 
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200 border border-gray-200'
          }`}
        >
          Impact Timeline
        </button>
      </div>
      
      {/* Charts container */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        {/* Practice Impact Chart */}
        {chartType === 'practices' && (
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-4">Impact by Ethical Practice</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar chart */}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={practiceData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => `$${Math.abs(value).toFixed(0)}`} />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip formatter={formatTooltipValue} />
                    <Legend />
                    <Bar dataKey="negative" name="Negative Impact" fill="#ef4444" />
                    <Bar dataKey="positive" name="Positive Impact" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Pie chart */}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={practiceData}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry) => entry.name}
                      labelLine={true}
                    >
                      {practiceData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.total < 0 ? GREEN_COLORS[index % GREEN_COLORS.length] : RED_COLORS[index % RED_COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${Math.abs(Number(value)).toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
        
        {/* Vendor Impact Chart */}
        {chartType === 'vendors' && (
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-4">Impact by Vendor</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar chart - Absolute amounts */}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={vendorData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" height={70} />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={formatTooltipValue} />
                    <Legend />
                    <Bar dataKey="spent" name="Amount Spent" fill="#3b82f6" />
                    <Bar dataKey="impact" name="Ethical Impact" fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              
              {/* Bar chart - Percentage impact */}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={vendorData}
                    margin={{ top: 5, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-35} textAnchor="end" height={70} />
                    <YAxis tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Impact Percentage']} />
                    <Bar dataKey="percentage" name="Impact Percentage">
                      {vendorData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.percentage < 0 ? GREEN_COLORS[index % GREEN_COLORS.length] : RED_COLORS[index % RED_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
        
        {/* Timeline Chart */}
        {chartType === 'timeline' && (
          <div>
            <h3 className="text-lg font-medium text-gray-800 mb-4">Impact Timeline</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={timelineData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" tickFormatter={(value) => `$${value}`} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `$${value}`} />
                  <Tooltip formatter={formatTooltipValue} />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="spent" 
                    name="Total Spending" 
                    stroke="#3b82f6" 
                    activeDot={{ r: 8 }} 
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="impact" 
                    name="Ethical Impact" 
                    stroke="#ef4444" 
                    activeDot={{ r: 8 }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            {/* Percentage chart */}
            <div className="mt-6 h-60">
              <h4 className="text-md font-medium text-gray-700 mb-3">Impact as Percentage of Spending</h4>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={timelineData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis tickFormatter={(value) => `${value}%`} />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Impact Percentage']} />
                  <Bar dataKey="percentage" name="Impact Percentage">
                    {timelineData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.percentage < 0 ? '#10b981' : '#ef4444'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
      
      {/* Information panel */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-md font-medium text-blue-800 mb-2">Understanding These Charts</h3>
        <p className="text-sm text-blue-700">
          {chartType === 'practices' && 
            "These charts show the ethical impact breakdown by practice. Negative impact (red) represents practices that increase societal debt, while positive impact (green) represents practices that reduce it."}
          {chartType === 'vendors' && 
            "These charts show your spending and ethical impact by vendor. The left chart shows absolute amounts spent and impact, while the right chart shows impact as a percentage of spending."}
          {chartType === 'timeline' && 
            "These charts show how your spending and ethical impact have changed over time. The top chart shows absolute amounts, while the bottom chart shows impact as a percentage of spending."}
        </p>
      </div>
    </div>
  );
};

export default ImpactVisualizations;