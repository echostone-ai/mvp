'use client';

import { useState } from 'react';
import DIDAgent from './DIDAgent';

interface EchostoneAgentProps {
  className?: string;
  showToggle?: boolean;
  defaultOpen?: boolean;
}

export default function EchostoneAgent({ 
  className = '',
  showToggle = true,
  defaultOpen = false 
}: EchostoneAgentProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  if (showToggle && !isOpen) {
    return (
      <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
        <button
          onClick={() => setIsOpen(true)}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white p-4 rounded-full shadow-lg transition-all duration-300 hover:scale-110"
          title="Chat with AI Agent"
        >
          <div className="w-8 h-8 flex items-center justify-center">
            🎭
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className={`${showToggle ? 'fixed bottom-6 right-6 z-50' : ''} ${className}`}>
      <div className={`bg-white rounded-lg shadow-2xl ${showToggle ? 'w-96 h-96' : 'w-full h-full'}`}>
        {showToggle && (
          <div className="flex justify-between items-center p-4 border-b">
            <h3 className="font-semibold text-gray-800">Echostone AI</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-500 hover:text-gray-700 text-xl"
            >
              ×
            </button>
          </div>
        )}
        
        <div className={`${showToggle ? 'h-80' : 'h-full'}`}>
          <DIDAgent 
            className="w-full h-full"
            onMessage={(data) => {
              // Handle agent messages if needed
              console.log('Agent interaction:', data);
            }}
          />
        </div>
      </div>
    </div>
  );
}