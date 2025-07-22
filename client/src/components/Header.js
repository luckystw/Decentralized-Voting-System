import React from 'react';
import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';

const Header = () => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-purple-600" />
            <span className="text-xl font-bold text-gray-900">VoteChain</span>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header; 