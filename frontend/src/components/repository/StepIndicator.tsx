// frontend/src/components/repository/StepIndicator.tsx
import React from 'react';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  number: number;
  label: string;
  active: boolean;
  completed: boolean;
}

export default function StepIndicator({ 
  number, 
  label, 
  active, 
  completed 
}: StepIndicatorProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      {/* Circle */}
      <div
        className={`
          relative w-10 h-10 rounded-full flex items-center justify-center
          font-semibold text-sm transition-all
          ${completed 
            ? 'bg-green-600 text-white' 
            : active 
              ? 'bg-blue-600 text-white ring-4 ring-blue-100' 
              : 'bg-gray-200 text-gray-500'
          }
        `}
      >
        {completed ? (
          <Check className="w-5 h-5" strokeWidth={3} />
        ) : (
          <span>{number}</span>
        )}
        
        {/* Active Pulse */}
        {active && !completed && (
          <span className="absolute inset-0 rounded-full bg-blue-600 animate-ping opacity-20" />
        )}
      </div>
      
      {/* Label */}
      <span
        className={`
          text-xs font-medium transition-colors
          ${active ? 'text-gray-900' : 'text-gray-500'}
        `}
      >
        {label}
      </span>
    </div>
  );
}