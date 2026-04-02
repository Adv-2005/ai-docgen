import React from 'react';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, FileText, Clock, DollarSign, Activity } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  color: string;
}

function MetricCard({ title, value, change, icon, color }: MetricCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center`}>
          {icon}
        </div>
        {change && (
          <span className="text-sm font-medium text-green-600 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            {change}
          </span>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

interface ActivityItem {
  id: string;
  type: 'doc_generated' | 'pr_analyzed' | 'repo_connected';
  repo: string;
  timestamp: string;
  details: string;
}

interface OverviewTabProps {
  metrics?: {
    activeRepos: number;
    totalDocs: number;
    timeSaved: string;
    costSavings: string;
  } | null;
  repositories?: any[];
  documents?: any[];
  coverageTrend?: Array<{ date: string; coverage: number }>;
  jobStatus?: Array<{ name: string; value: number }>;
  recentActivity?: ActivityItem[];
}

export default function OverviewTab({ 
  metrics: metricsFromProps,
  repositories = [],
  documents = [],
  coverageTrend = [
    { date: 'Mon', coverage: 45 },
    { date: 'Tue', coverage: 52 },
    { date: 'Wed', coverage: 58 },
    { date: 'Thu', coverage: 65 },
    { date: 'Fri', coverage: 68 },
    { date: 'Sat', coverage: 72 },
    { date: 'Sun', coverage: 75 },
  ],
  jobStatus = [
    { name: 'Completed', value: 145 },
    { name: 'In Progress', value: 8 },
    { name: 'Failed', value: 3 },
  ],
  recentActivity = [
    { id: '1', type: 'doc_generated', repo: 'ai-docgen', timestamp: '2 min ago', details: 'Architecture overview generated' },
    { id: '2', type: 'pr_analyzed', repo: 'WanderLust', timestamp: '15 min ago', details: 'PR #123 documentation created' },
    { id: '3', type: 'doc_generated', repo: 'api-server', timestamp: '1 hour ago', details: 'API reference updated' },
    { id: '4', type: 'repo_connected', repo: 'new-project', timestamp: '3 hours ago', details: 'Initial analysis completed' },
  ]
}: OverviewTabProps) {
  const COLORS = ['#22c55e', '#3b82f6', '#ef4444'];

  // Calculate metrics from repositories and documents if not provided
  const metrics = metricsFromProps || {
    activeRepos: repositories.length,
    totalDocs: documents.length,
    timeSaved: `${documents.length * 2} hrs`,
    costSavings: `$${(documents.length * 0.5).toFixed(1)}k`,
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'doc_generated':
        return <FileText className="w-5 h-5 text-blue-600" />;
      case 'pr_analyzed':
        return <Activity className="w-5 h-5 text-green-600" />;
      case 'repo_connected':
        return <TrendingUp className="w-5 h-5 text-purple-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Active Repositories"
          value={metrics.activeRepos}
          change="+2 this week"
          icon={<FileText className="w-6 h-6 text-white" />}
          color="bg-blue-600"
        />
        <MetricCard
          title="Total Documents"
          value={metrics.totalDocs}
          change="+18 this week"
          icon={<FileText className="w-6 h-6 text-white" />}
          color="bg-green-600"
        />
        <MetricCard
          title="Time Saved"
          value={metrics.timeSaved}
          change="+24 hrs"
          icon={<Clock className="w-6 h-6 text-white" />}
          color="bg-purple-600"
        />
        <MetricCard
          title="Cost Savings"
          value={metrics.costSavings}
          change="+$2.1k"
          icon={<DollarSign className="w-6 h-6 text-white" />}
          color="bg-orange-600"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coverage Trend */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Documentation Coverage Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={coverageTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="coverage" 
                stroke="#3b82f6" 
                strokeWidth={3}
                dot={{ fill: '#3b82f6', r: 5 }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Job Status Pie Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Status</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={jobStatus}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {jobStatus.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {recentActivity.map((activity) => (
            <div 
              key={activity.id}
              className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex-shrink-0">
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{activity.details}</p>
                <p className="text-sm text-gray-600 mt-1">
                  <span className="font-medium">{activity.repo}</span> • {activity.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}