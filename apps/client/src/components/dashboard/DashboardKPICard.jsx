import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

export const DashboardKPICard = ({
  title,
  value,
  icon: Icon,
  trend,
  trendDirection = 'up',
  color = 'emerald', // emerald, blue, amber, rose, purple
  className = '',
  onClick
}) => {
  const colorMap = {
    emerald: {
      bg: 'bg-emerald-50',
      icon: 'text-emerald-600',
      border: 'border-emerald-100'
    },
    blue: {
      bg: 'bg-sky-50',
      icon: 'text-sky-600',
      border: 'border-sky-100'
    },
    amber: {
      bg: 'bg-amber-50',
      icon: 'text-amber-600',
      border: 'border-amber-100'
    },
    rose: {
      bg: 'bg-rose-50',
      icon: 'text-rose-600',
      border: 'border-rose-100'
    },
    purple: {
      bg: 'bg-purple-50',
      icon: 'text-purple-600',
      border: 'border-purple-100'
    }
  };

  const scheme = colorMap[color] || colorMap.emerald;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs hover-card-elevate flex items-center justify-between ${
        onClick
          ? 'cursor-pointer transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-teal-500'
          : ''
      } ${className}`}
    >
      <div className="flex items-center space-x-3.5 sm:space-x-4">
        {/* Icon box */}
        <div className={`w-12 h-12 rounded-2xl ${scheme.bg} ${scheme.icon} flex items-center justify-center shrink-0 shadow-2xs`}>
          {Icon && <Icon className="w-6 h-6" />}
        </div>

        {/* Value and label */}
        <div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
            {value}
          </div>
          <div className="text-xs text-slate-500 font-medium mt-0.5">
            {title}
          </div>
          {trend && (
            <div className={`inline-flex items-center text-[11px] font-bold mt-1 ${
              trendDirection === 'down' ? 'text-rose-600' : 'text-emerald-600'
            }`}>
              {trendDirection === 'down' ? (
                <ArrowDown className="w-3 h-3 mr-0.5" />
              ) : (
                <ArrowUp className="w-3 h-3 mr-0.5" />
              )}
              {trend}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardKPICard;
