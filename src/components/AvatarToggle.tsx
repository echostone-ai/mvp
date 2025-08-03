'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function AvatarToggle() {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {showPrompt && (
        <div className="absolute bottom-16 right-0 bg-white/90 backdrop-blur-lg rounded-lg p-4 shadow-lg mb-2 w-64">
          <p className="text-sm text-gray-800 mb-3">
            Want to see me as a talking avatar? Try the new demo!
          </p>
          <div className="flex gap-2">
            <Link 
              href="/avatar-demo"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-2 rounded text-center transition-colors"
            >
              Try Avatar Demo
            </Link>
            <button
              onClick={() => setShowPrompt(false)}
              className="px-3 py-2 text-gray-600 hover:text-gray-800 text-sm"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      <button
        onClick={() => setShowPrompt(!showPrompt)}
        className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
        title="Try Avatar Demo"
      >
        <div className="w-6 h-6 flex items-center justify-center">
          🎭
        </div>
      </button>
    </div>
  );
}