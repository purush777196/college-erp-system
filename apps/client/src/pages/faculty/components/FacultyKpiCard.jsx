import React from 'react';
import { ChevronRight } from 'lucide-react';

export const FacultyKpiCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  destinationTab,
  isActive = false,
  onClick,
  ariaLabel
}) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel || `${title}: ${value}. Click to view ${title} details.`}
      className={`w-full text-left bg-white rounded-2xl border p-4 sm:p-5 shadow-card hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500/50 group flex items-center justify-between ${
        isActive
          ? 'border-purple-600 ring-2 ring-purple-500/20 bg-purple-50/20'
          : 'border-slate-200/90 hover:border-purple-300'
      }`}
    >
      <div className="flex-1 min-w-0 pr-3">
        <div className="flex items-center space-x-1.5">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block truncate group-hover:text-purple-700 transition-colors">
            {title}
          </span>
          {isActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" title="Active Tab" />
          )}
        </div>

        <div className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 group-hover:text-purple-900 transition-colors truncate">
          {value}
        </div>

        {subtitle && (
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-[11px] text-slate-400 font-medium truncate group-hover:text-slate-600 transition-colors">
              {subtitle}
            </span>
            <span className="text-[10px] text-purple-600 font-semibold opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center ml-1">
              <span>View Details</span>
              <ChevronRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
        )}
      </div>

      {Icon && (
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs transition-colors ${
            isActive
              ? 'bg-purple-600 text-white'
              : 'bg-purple-50 text-purple-700 group-hover:bg-purple-600 group-hover:text-white'
          }`}
        >
          <Icon className="w-5 h-5" />
        </div>
      )}
    </button>
  );
};

export default FacultyKpiCard;
