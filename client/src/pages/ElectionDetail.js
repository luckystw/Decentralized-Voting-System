import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Vote, 
  Users, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  Shield
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const ElectionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [election, setElection] = useState(null);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);

  const fetchElectionDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/elections/${id}`);
      setElection(response.data);
    } catch (error) {
      console.error('Error fetching election details:', error);
      toast.error('Failed to load election details');
      navigate('/elections');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchElectionDetails();
  }, [fetchElectionDetails]);

  const handleVote = async () => {
    if (!selectedCandidate) {
      toast.error('Please select a candidate');
      return;
    }

    try {
      setVoting(true);
      await api.post(`/api/elections/${id}/vote`, {
        candidateId: selectedCandidate.id
      });
      
      toast.success('Vote cast successfully!');
      fetchElectionDetails(); // Refresh data
      setSelectedCandidate(null);
    } catch (error) {
      console.error('Error casting vote:', error);
      toast.error(error.response?.data?.message || 'Failed to cast vote');
    } finally {
      setVoting(false);
    }
  };

  const getElectionStatus = () => {
    if (!election) return { status: 'loading', color: 'text-gray-600' };
    
    const now = new Date();
    const startDate = new Date(election.startDate);
    const endDate = new Date(election.endDate);
    
    if (now < startDate) {
      return { status: 'upcoming', color: 'text-blue-600' };
    } else if (now >= startDate && now <= endDate) {
      return { status: 'active', color: 'text-green-600' };
    } else {
      return { status: 'ended', color: 'text-gray-600' };
    }
  };

  const hasVoted = election?.voters?.includes(user?.id);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!election) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Election Not Found</h2>
          <p className="text-gray-600 mb-4">The election you're looking for doesn't exist.</p>
          <button
            onClick={() => navigate('/elections')}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Back to Elections
          </button>
        </div>
      </div>
    );
  }

  const status = getElectionStatus();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <button
            onClick={() => navigate('/elections')}
            className="flex items-center text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Elections
          </button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{election.title}</h1>
              <p className="text-gray-600 max-w-2xl">{election.description}</p>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 ${status.color}`}>
                {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Election Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center">
              <Clock className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Start Date</p>
                <p className="text-sm text-gray-900">{new Date(election.startDate).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center">
              <Clock className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">End Date</p>
                <p className="text-sm text-gray-900">{new Date(election.endDate).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center">
              <Users className="w-5 h-5 text-gray-400 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Votes</p>
                <p className="text-sm text-gray-900">{election.totalVotes || 0}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Candidates */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8"
        >
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Candidates</h2>
          
          {hasVoted && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-green-800 font-medium">You have already voted in this election</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {election.candidates?.map((candidate, index) => (
              <motion.div
                key={candidate.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                  selectedCandidate?.id === candidate.id
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => !hasVoted && status.status === 'active' && setSelectedCandidate(candidate)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {candidate.name.charAt(0)}
                    </div>
                    <div className="ml-4">
                      <h3 className="font-semibold text-gray-900">{candidate.name}</h3>
                      <p className="text-sm text-gray-600">{candidate.party}</p>
                    </div>
                  </div>
                  {selectedCandidate?.id === candidate.id && (
                    <CheckCircle className="w-5 h-5 text-indigo-600" />
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-3">{candidate.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">
                    {candidate.votes || 0} votes
                  </span>
                  {election.totalVotes > 0 && (
                    <span className="text-sm text-gray-500">
                      {Math.round(((candidate.votes || 0) / election.totalVotes) * 100)}%
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {status.status === 'active' && !hasVoted && (
            <div className="mt-6">
              <button
                onClick={handleVote}
                disabled={!selectedCandidate || voting}
                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
              >
                {voting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Casting Vote...
                  </>
                ) : (
                  <>
                    <Vote className="w-5 h-5 mr-2" />
                    Cast Vote
                  </>
                )}
              </button>
            </div>
          )}

          {status.status === 'upcoming' && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-blue-600 mr-2" />
                <span className="text-blue-800">Voting will begin on {new Date(election.startDate).toLocaleDateString()}</span>
              </div>
            </div>
          )}

          {status.status === 'ended' && (
            <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-gray-600 mr-2" />
                <span className="text-gray-800">Voting has ended on {new Date(election.endDate).toLocaleDateString()}</span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Security Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl p-6 text-white"
        >
          <div className="flex items-center">
            <Shield className="w-8 h-8 mr-4" />
            <div>
              <h3 className="text-lg font-semibold mb-2">Secure Voting</h3>
              <p className="text-purple-100">
                Your vote is encrypted and stored on the blockchain. Once cast, it cannot be 
                changed or deleted, ensuring the integrity of the democratic process.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ElectionDetail; 