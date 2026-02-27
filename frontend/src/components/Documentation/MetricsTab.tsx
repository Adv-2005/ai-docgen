import React from 'react';
import { BarChart, Bar, LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, Clock, DollarSign, Users, Target, Zap } from 'lucide-react';

interface ImpactCardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

function ImpactCard({ title, value, change, icon, color, description }: ImpactCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-14 h-14 ${color} rounded-xl flex items-center justify-center`}>
          {icon}
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-green-600 flex items-center gap-1 justify-end">
            <TrendingUp className="w-4 h-4" />
            {change}
          </p>
        </div>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-1">{value}</h3>
      <p className="text-sm font-medium text-gray-700 mb-2">{title}</p>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}

interface MetricsTabProps {
  impactMetrics?: {
    onboardingReduction: { value: string; change: string };
    timeSaved: { value: string; change: string };
    costSavings: { value: string; change: string };
  };
  usageStats?: {
    activeUsers: number;
    totalAnalyses: number;
    avgResponseTime: string;
  };
  coverageTrend?: Array<{ month: string; coverage: number }>;
  timeSavedTrend?: Array<{ month: string; hours: number }>;
  documentTypes?: Array<{ name: string; count: number }>;
}

export default function MetricsTab({
  impactMetrics = {
    onboardingReduction: { value: '65%', change: '+12% this quarter' },
    timeSaved: { value: '156 hrs/month', change: '+24 hrs' },
    costSavings: { value: '$12.4k/quarter', change: '+$2.1k' },
  },
  usageStats = {
    activeUsers: 24,
    totalAnalyses: 1847,
    avgResponseTime: '2.3s',
  },
  coverageTrend = [
    { month: 'Jul', coverage: 45 },
    { month: 'Aug', coverage: 52 },
    { month: 'Sep', coverage: 58 },
    { month: 'Oct', coverage: 63 },
    { month: 'Nov', coverage: 68 },
    { month: 'Dec', coverage: 75 },
  ],
  timeSavedTrend = [
    { month: 'Jul', hours: 89 },
    { month: 'Aug', hours: 102 },
    { month: 'Sep', hours: 118 },
    { month: 'Oct', hours: 134 },
    { month: 'Nov', hours: 145 },
    { month: 'Dec', hours: 156 },
  ],
  documentTypes = [
    { name: 'Architecture', count: 45 },
    { name: 'API Docs', count: 68 },
    { name: 'Onboarding', count: 23 },
    { name: 'PR Summaries', count: 91 },
  ],
}: MetricsTabProps) {
  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-cyan-600 rounded-lg p-8 text-white">
        <h2 className="text-3xl font-bold mb-2">Business Impact Dashboard</h2>
        <p className="text-blue-100 mb-6">
          Real-time metrics showing how AI DocGen drives efficiency and cost savings
        </p>
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <Users className="w-8 h-8 mb-2" />
            <p className="text-2xl font-bold">{usageStats.activeUsers}</p>
            <p className="text-sm text-blue-100">Active Users</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <Target className="w-8 h-8 mb-2" />
            <p className="text-2xl font-bold">{usageStats.totalAnalyses.toLocaleString()}</p>
            <p className="text-sm text-blue-100">Total Analyses</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <Zap className="w-8 h-8 mb-2" />
            <p className="text-2xl font-bold">{usageStats.avgResponseTime}</p>
            <p className="text-sm text-blue-100">Avg Response Time</p>
          </div>
        </div>
      </div>

      {/* Impact Metrics */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 mb-4">Key Impact Metrics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ImpactCard
            title="Onboarding Time Reduction"
            value={impactMetrics.onboardingReduction.value}
            change={impactMetrics.onboardingReduction.change}
            icon={<Clock className="w-7 h-7 text-white" />}
            color="bg-gradient-to-br from-purple-500 to-purple-600"
            description="New developers onboard 65% faster with AI-generated docs"
          />
          <ImpactCard
            title="Time Saved per Month"
            value={impactMetrics.timeSaved.value}
            change={impactMetrics.timeSaved.change}
            icon={<TrendingUp className="w-7 h-7 text-white" />}
            color="bg-gradient-to-br from-blue-500 to-blue-600"
            description="Documentation automation saves 156 engineering hours monthly"
          />
          <ImpactCard
            title="Cost Savings per Quarter"
            value={impactMetrics.costSavings.value}
            change={impactMetrics.costSavings.change}
            icon={<DollarSign className="w-7 h-7 text-white" />}
            color="bg-gradient-to-br from-green-500 to-green-600"
            description="Direct cost reduction from automated documentation"
          />
        </div>
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Coverage Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentation Coverage Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={coverageTrend}>
              <defs>
                <linearGradient id="coverageGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px' 
                }}
              />
              <Area 
                type="monotone" 
                dataKey="coverage" 
                stroke="#3b82f6" 
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#coverageGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
          <p className="text-sm text-gray-600 mt-4 text-center">
            Steady 30% increase in coverage over 6 months
          </p>
        </div>

        {/* Time Saved Trend */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Engineering Hours Saved</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeSavedTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#fff', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px' 
                }}
              />
              <Line 
                type="monotone" 
                dataKey="hours" 
                stroke="#10b981" 
                strokeWidth={3}
                dot={{ fill: '#10b981', r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
          <p className="text-sm text-gray-600 mt-4 text-center">
            75% increase in monthly time savings
          </p>
        </div>
      </div>

      {/* Document Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentation by Type</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={documentTypes}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#fff', 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px' 
              }}
            />
            <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ROI Calculation */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Return on Investment (ROI)</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Implementation Cost</p>
            <p className="text-2xl font-bold text-gray-900">$8,500</p>
            <p className="text-xs text-gray-500">One-time development</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Monthly Savings</p>
            <p className="text-2xl font-bold text-green-600">$4,133</p>
            <p className="text-xs text-gray-500">Avg. engineering cost saved</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Break-even Period</p>
            <p className="text-2xl font-bold text-blue-600">2.1 months</p>
            <p className="text-xs text-gray-500">Faster ROI than expected</p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Annual ROI</p>
            <p className="text-2xl font-bold text-purple-600">486%</p>
            <p className="text-xs text-gray-500">Outstanding investment return</p>
          </div>
        </div>
      </div>

      {/* Additional Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">Top Benefits</h4>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 font-bold">1</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Faster Onboarding</p>
                <p className="text-sm text-gray-600">New developers productive in days, not weeks</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Reduced Documentation Debt</p>
                <p className="text-sm text-gray-600">Always up-to-date with code changes</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Better Code Quality</p>
                <p className="text-sm text-gray-600">Clear documentation encourages better practices</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-lg font-semibold text-gray-900 mb-4">User Feedback</h4>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 italic mb-2">
                "Cut our onboarding time from 2 weeks to 3 days. Game changer for our team."
              </p>
              <p className="text-xs text-gray-500">- Engineering Manager</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 italic mb-2">
                "Finally, documentation that actually reflects our current codebase!"
              </p>
              <p className="text-xs text-gray-500">- Senior Developer</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-700 italic mb-2">
                "The PR summaries alone have saved us hours in code review time."
              </p>
              <p className="text-xs text-gray-500">- Tech Lead</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}