import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const { handleAuthCallback } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');
    
    if (error) {
      toast.error('Authentication failed. Please try again.');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
      return;
    }
    
    if (token) {
      handleAuthCallback(token)
        .then(() => {
          toast.success('Successfully authenticated!');
          setTimeout(() => {
            navigate('/dashboard');
          }, 1000);
        })
        .catch((error) => {
          toast.error('Failed to complete authentication');
          console.error('Auth callback error:', error);
          setTimeout(() => {
            navigate('/login');
          }, 2000);
        });
    } else {
      navigate('/login');
    }
  }, [searchParams, handleAuthCallback, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 flex items-center justify-center p-4">
      {/* Background Animation */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="bg-white rounded-2xl shadow-2xl p-8 text-center max-w-md w-full"
      >
        <div className="flex items-center justify-center mb-6">
          <Shield className="w-12 h-12 text-indigo-600" />
          <h1 className="text-2xl font-bold text-gray-900 ml-3">VoteChain</h1>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-6"
        >
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Completing Authentication</h2>
          <p className="text-gray-600">Please wait while we verify your credentials...</p>
        </motion.div>

        <div className="flex items-center justify-center text-sm text-gray-500">
          <Shield className="w-4 h-4 mr-2" />
          Secure authentication in progress
        </div>
      </motion.div>
    </div>
  );
};

export default AuthCallback; 