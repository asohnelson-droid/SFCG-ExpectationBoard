import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { cn } from '../utils/cn';

interface BackButtonProps {
  fallbackPath?: string;
  className?: string;
  label?: string;
  tooltip?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ 
  fallbackPath = '/dashboard', 
  className,
  label,
  tooltip = "Go back"
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    // Check if there's history to go back to
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(fallbackPath);
    }
  };

  return (
    <Tooltip text={tooltip}>
      <button
        onClick={handleBack}
        className={cn(
          "flex items-center gap-2 p-2 hover:bg-zinc-100 rounded-xl transition-colors text-zinc-600 group",
          className
        )}
      >
        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
        {label && <span className="font-medium">{label}</span>}
      </button>
    </Tooltip>
  );
};
