import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Vote, 
  Users, 
  BarChart3, 
  Shield, 
  Clock,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalElections: 0,
    activeElections: 0,
    totalVotes: 0,
    userVotes: 0
  });
  const [recentElections, setRecentElections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResponse, electionsResponse] = await Promise.all([
        api.get('/api/stats'),
        api.get('/api/elections?limit=5')
      ]);
      
      setStats(statsResponse.data);
      setRecentElections(electionsResponse.data.elections);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Elections',
      value: stats.totalElections,
      icon: Vote,
      color: 'bg-blue-500',
      change: '+12%'
    },
    {
      title: 'Active Elections',
      value: stats.activeElections,
      icon: Clock,
      color: 'bg-green-500',
      change: '+5%'
    },
    {
      title: 'Total Votes Cast',
      value: stats.totalVotes,
      icon: BarChart3,
      color: 'bg-purple-500',
      change: '+23%'
    },
    {
      title: 'Your Votes',
      value: stats.userVotes,
      icon: Users,
      color: 'bg-orange-500',
      change: '+8%'
    }
  ];

  const getElectionStatus = (election) => {
    const now = new Date();
    const startDate = new Date(election.startDate);
    const endDate = new Date(election.endDate);
    
    if (now < startDate) {
      return { status: 'upcoming', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    } else if (now >= startDate && now <= endDate) {
      return { status: 'active', color: 'text-green-600', bgColor: 'bg-green-100' };
    } else {
      return { status: 'ended', color: 'text-gray-600', bgColor: 'bg-gray-100' };
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name || 'Voter'}!
          </h1>
          <p className="text-gray-600">
            Here's what's happening with your voting activity
          </p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-full ${stat.color} bg-opacity-10`}>
                  <stat.icon className={`w-6 h-6 ${stat.color.replace('bg-', 'text-')}`} />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span className="text-sm font-medium text-green-600">{stat.change}</span>
                <span className="text-sm text-gray-500 ml-2">from last month</span>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Recent Elections */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200"
        >
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Elections</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentElections.map((election, index) => {
              const status = getElectionStatus(election);
              return (
                <motion.div
                  key={election.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  className="px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900">{election.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">{election.description}</p>
                      <div className="flex items-center mt-2 space-x-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.bgColor} ${status.color}`}>
                          {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(election.startDate).toLocaleDateString()} - {new Date(election.endDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">{election.totalVotes} votes</span>
                      <ArrowRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <div className="px-6 py-4 border-t border-gray-200">
            <a
              href="/elections"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              View all elections →
            </a>
          </div>
        </motion.div>

        {/* Security Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="mt-8 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-6 text-white"
        >
          <div className="flex items-center">
            <Shield className="w-8 h-8 mr-4" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Your Vote is Secure</h3>
              <p className="text-purple-100">
                Every vote is encrypted and stored on the blockchain, ensuring complete transparency 
                and immutability. Your identity is protected while maintaining vote integrity.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Dashboard; 