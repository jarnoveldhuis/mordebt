import React, { useState, useEffect, useMemo } from 'react';
import { Transaction } from '@/shared/types/transactions';

interface RecommendationsProps {
  transactions: Transaction[];
  totalSocietalDebt: number | null;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  impact: number; // Estimated impact reduction
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  relevance: number; // 0-100 score of how relevant this is to the user
  practices: string[]; // Related ethical/unethical practices
}

// Difficulty badge component
const DifficultyBadge: React.FC<{ difficulty: 'easy' | 'medium' | 'hard' }> = ({ difficulty }) => {
  const colors = {
    easy: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    hard: 'bg-red-100 text-red-800'
  };
  
  return (
    <span className={`text-xs px-2 py-1 rounded-full ${colors[difficulty]}`}>
      {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
    </span>
  );
};

const RecommendationsComponent: React.FC<RecommendationsProps> = ({
  transactions,
  // totalSocietalDebt
}) => {
  const [filter, setFilter] = useState<'all' | 'easy' | 'medium' | 'hard'>('all');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [savedRecommendations, setSavedRecommendations] = useState<string[]>([]);
  
  // Toggle a recommendation's expanded state
  const toggleExpanded = (id: string) => {
    if (expanded.includes(id)) {
      setExpanded(expanded.filter(item => item !== id));
    } else {
      setExpanded([...expanded, id]);
    }
  };
  
  // Toggle a recommendation's saved state
  const toggleSaved = (id: string) => {
    if (savedRecommendations.includes(id)) {
      setSavedRecommendations(savedRecommendations.filter(item => item !== id));
    } else {
      setSavedRecommendations([...savedRecommendations, id]);
    }
  };
  
  // Load saved recommendations from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('savedRecommendations');
      if (saved) {
        setSavedRecommendations(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load saved recommendations:', error);
    }
  }, []);
  
  // Save recommendations to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('savedRecommendations', JSON.stringify(savedRecommendations));
    } catch (error) {
      console.error('Failed to save recommendations:', error);
    }
  }, [savedRecommendations]);
  
  // Generate recommendations based on transaction data
  const recommendations = useMemo(() => {
    if (!transactions || transactions.length === 0) {
      return [];
    }
    
    // Find common unethical practices
    const practiceFrequency: Record<string, number> = {};
    const vendorPracticeMap: Record<string, Set<string>> = {};
    
    transactions.forEach(tx => {
      const vendor = tx.name;
      
      // Initialize vendor practice set
      if (!vendorPracticeMap[vendor]) {
        vendorPracticeMap[vendor] = new Set();
      }
      
      // Count unethical practices
      (tx.unethicalPractices || []).forEach(practice => {
        practiceFrequency[practice] = (practiceFrequency[practice] || 0) + 1;
        vendorPracticeMap[vendor].add(practice);
      });
    });
    
    // Sort practices by frequency
    const topPractices = Object.entries(practiceFrequency)
      .sort((a, b) => b[1] - a[1])
      .map(([practice]) => practice);
    
    // Generate recommendations based on top practices
    const generatedRecommendations: Recommendation[] = [];
    
    // Define recommendation templates
    const recommendationTemplates: Record<string, Partial<Recommendation>[]> = {
      'Factory Farming': [
        {
          id: 'reduce-meat',
          title: 'Reduce meat consumption',
          description: 'Consider participating in "Meatless Mondays" or reducing meat portions in your meals. This reduces demand for factory farmed animal products.',
          impact: 15,
          difficulty: 'medium',
          category: 'Food'
        },
        {
          id: 'local-farms',
          title: 'Purchase from local, ethical farms',
          description: 'Look for meat and animal products from local farms that use humane, sustainable practices. Many farmers markets have these options.',
          impact: 25,
          difficulty: 'medium',
          category: 'Food'
        }
      ],
      'High Emissions': [
        {
          id: 'reduce-car-use',
          title: 'Reduce car usage',
          description: 'Consider using public transportation, carpooling, or biking for some trips to reduce your carbon footprint.',
          impact: 20,
          difficulty: 'medium',
          category: 'Transportation'
        },
        {
          id: 'renewable-energy',
          title: 'Switch to renewable energy',
          description: 'Check if your utility provider offers renewable energy options, or consider installing solar panels.',
          impact: 30,
          difficulty: 'hard',
          category: 'Energy'
        }
      ],
      'Labor Exploitation': [
        {
          id: 'ethical-clothing',
          title: 'Shop ethical clothing brands',
          description: 'Look for clothing brands that are certified fair trade or have transparent supply chains.',
          impact: 18,
          difficulty: 'medium',
          category: 'Fashion'
        },
        {
          id: 'secondhand-shopping',
          title: 'Shop secondhand',
          description: 'Consider purchasing clothes, furniture, and electronics secondhand to reduce demand for new products.',
          impact: 12,
          difficulty: 'easy',
          category: 'Shopping'
        }
      ],
      'Excessive Packaging': [
        {
          id: 'bulk-shopping',
          title: 'Shop at bulk stores',
          description: 'Purchase items from bulk bins using reusable containers to reduce packaging waste.',
          impact: 10,
          difficulty: 'easy',
          category: 'Shopping'
        },
        {
          id: 'reusable-bags',
          title: 'Use reusable bags and containers',
          description: 'Bring your own bags, produce bags, and containers when shopping to reduce single-use packaging.',
          impact: 5,
          difficulty: 'easy',
          category: 'Shopping'
        }
      ],
      'Water Waste': [
        {
          id: 'water-efficient',
          title: 'Install water-efficient fixtures',
          description: 'Replace showerheads, faucets, and toilets with water-efficient models to reduce water consumption.',
          impact: 8,
          difficulty: 'medium',
          category: 'Home'
        },
        {
          id: 'shorter-showers',
          title: 'Take shorter showers',
          description: 'Reducing shower time by just 2 minutes can save up to 10 gallons of water.',
          impact: 3,
          difficulty: 'easy',
          category: 'Lifestyle'
        }
      ],
      'Environmental Degradation': [
        {
          id: 'sustainable-products',
          title: 'Choose sustainably sourced products',
          description: 'Look for certifications like FSC for wood products or MSC for seafood to ensure sustainable sourcing.',
          impact: 15,
          difficulty: 'medium',
          category: 'Shopping'
        },
        {
          id: 'support-conservation',
          title: 'Support conservation organizations',
          description: 'Donate to or volunteer with organizations working to protect natural habitats.',
          impact: 10,
          difficulty: 'easy',
          category: 'Philanthropy'
        }
      ],
      'Data Privacy Issues': [
        {
          id: 'privacy-settings',
          title: 'Review privacy settings',
          description: 'Regularly check and update privacy settings on social media and online accounts.',
          impact: 5,
          difficulty: 'easy',
          category: 'Digital'
        },
        {
          id: 'alternative-services',
          title: 'Use privacy-focused alternatives',
          description: 'Consider switching to services that prioritize user privacy for email, search, and browsing.',
          impact: 12,
          difficulty: 'medium',
          category: 'Digital'
        }
      ]
    };
    
    // Add general recommendations that apply to everyone
    const generalRecommendations: Partial<Recommendation>[] = [
      {
        id: 'offset-carbon',
        title: 'Offset your carbon footprint',
        description: 'Consider purchasing carbon offsets for unavoidable emissions from travel and home energy use.',
        impact: 20,
        difficulty: 'easy',
        category: 'Climate',
        practices: ['High Emissions']
      },
      {
        id: 'local-shopping',
        title: 'Shop locally',
        description: 'Support local businesses to reduce transportation emissions and strengthen your community\'s economy.',
        impact: 10,
        difficulty: 'easy',
        category: 'Shopping',
        practices: ['High Emissions', 'Labor Exploitation']
      }
    ];
    
    // Add general recommendations
    generalRecommendations.forEach(rec => {
      const relevance = rec.practices?.filter(p => topPractices.includes(p)).length || 0;
      
      generatedRecommendations.push({
        ...rec,
        id: rec.id || 'general',
        title: rec.title || 'Recommendation',
        description: rec.description || '',
        impact: rec.impact || 5,
        category: rec.category || 'General',
        difficulty: rec.difficulty || 'medium',
        relevance: relevance * 20,
        practices: rec.practices || []
      } as Recommendation);
    });
    
    // Add specific practice recommendations
    topPractices.forEach(practice => {
      const templates = recommendationTemplates[practice] || [];
      
      templates.forEach(rec => {
        generatedRecommendations.push({
          ...rec,
          id: rec.id || practice.toLowerCase().replace(/\s+/g, '-'),
          title: rec.title || `Reduce ${practice}`,
          description: rec.description || `Find ways to reduce the impact of ${practice} in your everyday life.`,
          impact: rec.impact || 10,
          category: rec.category || 'General',
          difficulty: rec.difficulty || 'medium',
          relevance: 80, // High relevance for explicit practice recommendations
          practices: [practice]
        } as Recommendation);
      });
    });
    
    // Sort by relevance and return
    return generatedRecommendations
      .sort((a, b) => b.relevance - a.relevance)
      .filter((rec, index, self) => 
        // Remove duplicates
        index === self.findIndex(r => r.id === rec.id)
      );
  }, [transactions]);
  
  // Apply filters
  const filteredRecommendations = useMemo(() => {
    return recommendations.filter(rec => {
      if (filter === 'all') return true;
      return rec.difficulty === filter;
    });
  }, [recommendations, filter]);
  
  // Calculate total potential impact
  const totalPotentialImpact = useMemo(() => {
    return filteredRecommendations.reduce((sum, rec) => sum + rec.impact, 0);
  }, [filteredRecommendations]);
  
  if (transactions.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-500">No transaction data available for recommendations.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-2">Personalized Recommendations</h2>
      <p className="text-gray-600 mb-6">
        Based on your spending patterns, here are some recommendations to reduce your societal debt.
      </p>
      
      {/* Filter controls */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div className="flex space-x-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filter === 'all' 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            All Recommendations
          </button>
          <button
            onClick={() => setFilter('easy')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filter === 'easy' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            Easy
          </button>
          <button
            onClick={() => setFilter('medium')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filter === 'medium' 
                ? 'bg-yellow-100 text-yellow-800' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            Medium
          </button>
          <button
            onClick={() => setFilter('hard')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              filter === 'hard' 
                ? 'bg-red-100 text-red-800' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }`}
          >
            Hard
          </button>
        </div>
        
        <div className="text-sm text-gray-600">
          Potential impact: <span className="font-bold text-green-600">${totalPotentialImpact.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Recommendations list */}
      <div className="space-y-4">
        {filteredRecommendations.length === 0 ? (
          <div className="text-center p-6 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-gray-600">No recommendations available with the current filter.</p>
          </div>
        ) : (
          filteredRecommendations.map((recommendation) => (
            <div 
              key={recommendation.id}
              className={`border rounded-lg overflow-hidden transition-colors ${
                savedRecommendations.includes(recommendation.id) 
                  ? 'border-green-400 bg-green-50' 
                  : 'border-gray-200'
              }`}
            >
              {/* Recommendation header */}
              <div 
                className="p-4 cursor-pointer flex items-center justify-between"
                onClick={() => toggleExpanded(recommendation.id)}
              >
                <div className="flex items-center">
                  <div className="mr-3">
                    {savedRecommendations.includes(recommendation.id) ? (
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                        ✓
                      </div>
                    ) : (
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                        {recommendation.id.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">{recommendation.title}</h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        {recommendation.category}
                      </span>
                      <DifficultyBadge difficulty={recommendation.difficulty} />
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Impact</div>
                    <div className="font-bold text-green-600">${recommendation.impact.toFixed(2)}</div>
                  </div>
                  <div className="text-gray-400">
                    {expanded.includes(recommendation.id) ? '▲' : '▼'}
                  </div>
                </div>
              </div>
              
              {/* Expanded details */}
              {expanded.includes(recommendation.id) && (
                <div className="p-4 border-t border-gray-200 bg-white">
                  <p className="text-gray-700 mb-3">{recommendation.description}</p>
                  
                  {recommendation.practices && recommendation.practices.length > 0 && (
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-700 mb-1">Related Practices:</div>
                      <div className="flex flex-wrap gap-1">
                        {recommendation.practices.map(practice => (
                          <span 
                            key={practice} 
                            className="text-xs bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full"
                          >
                            {practice}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Action buttons */}
                  <div className="flex justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSaved(recommendation.id);
                      }}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        savedRecommendations.includes(recommendation.id)
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-blue-600 hover:bg-blue-700 text-white'
                      }`}
                    >
                      {savedRecommendations.includes(recommendation.id) ? 'Saved ✓' : 'Save for Later'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      {/* Saved recommendations section - only show if there are saved recommendations */}
      {savedRecommendations.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">Saved Recommendations</h3>
          <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
            <p className="text-sm text-green-800 mb-2">
              You have saved {savedRecommendations.length} recommendation{savedRecommendations.length !== 1 ? 's' : ''}.
              Track your progress with these recommendations to reduce your societal debt.
            </p>
            <div className="flex justify-end">
              <button 
                onClick={() => setSavedRecommendations([])}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Clear Saved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecommendationsComponent;