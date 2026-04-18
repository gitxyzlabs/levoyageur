import React, { useState, useEffect } from 'react';
import { Users, MapPin, Heart, Bookmark, Award, Star, TrendingUp, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { api } from '../../utils/api';
import { toast } from 'sonner';

interface AdminStats {
  totalUsers: number;
  totalLocations: number;
  totalFavorites: number;
  totalWantToGo: number;
  lvRatedLocations: number;
  michelinLocations: number;
}

export function AdminStatsPanel() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const result = await api.getAdminStats();
      setStats(result.stats);
    } catch (error: any) {
      console.error('Failed to load admin stats:', error);
      toast.error('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-600" />
            Platform Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return null;
  }

  const statItems = [
    {
      label: 'Total Users',
      value: stats.totalUsers,
      icon: Users,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700'
    },
    {
      label: 'Total Locations',
      value: stats.totalLocations,
      icon: MapPin,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700'
    },
    {
      label: 'Total Favorites',
      value: stats.totalFavorites,
      icon: Heart,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      textColor: 'text-red-700'
    },
    {
      label: 'Want to Go',
      value: stats.totalWantToGo,
      icon: Bookmark,
      color: 'bg-amber-500',
      bgColor: 'bg-amber-50',
      textColor: 'text-amber-700'
    },
    {
      label: 'LV Rated',
      value: stats.lvRatedLocations,
      icon: Award,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700'
    },
    {
      label: 'Michelin Locations',
      value: stats.michelinLocations,
      icon: Star,
      color: 'bg-rose-500',
      bgColor: 'bg-rose-50',
      textColor: 'text-rose-700'
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-purple-600" />
          Platform Statistics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {statItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={index}
                className={`${item.bgColor} rounded-xl p-4 transition-all hover:shadow-md`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 ${item.color} rounded-lg`}>
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                </div>
                <div className={`text-2xl font-bold ${item.textColor} mb-1`}>
                  {item.value.toLocaleString()}
                </div>
                <div className="text-xs text-gray-600 font-medium">
                  {item.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Engagement Metrics */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-gray-500" />
            <h4 className="text-sm font-semibold text-gray-700">Engagement</h4>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Avg. Favorites per Location</span>
              <span className="font-medium text-gray-900">
                {stats.totalLocations > 0
                  ? (stats.totalFavorites / stats.totalLocations).toFixed(2)
                  : '0.00'
                }
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">LV Coverage</span>
              <span className="font-medium text-gray-900">
                {stats.totalLocations > 0
                  ? `${((stats.lvRatedLocations / stats.totalLocations) * 100).toFixed(1)}%`
                  : '0%'
                }
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Michelin Coverage</span>
              <span className="font-medium text-gray-900">
                {stats.totalLocations > 0
                  ? `${((stats.michelinLocations / stats.totalLocations) * 100).toFixed(1)}%`
                  : '0%'
                }
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
