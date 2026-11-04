import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  PieChart,
  Zap,
  FileText,
  CheckCircle,
  BarChart3,
  Send,
  ChevronDown
} from 'lucide-react';

export const DashboardAnalyticsRow = ({
  chartTitle = 'Student Enrollment Trend',
  enrollmentTrend = [
    { label: 'Jan', val: 4500 },
    { label: 'Feb', val: 4800 },
    { label: 'Mar', val: 5100 },
    { label: 'Apr', val: 5400 },
    { label: 'May', val: 5800 },
    { label: 'Jun', val: 6000 },
    { label: 'Jul', val: 6100 },
    { label: 'Aug', val: 6300 },
    { label: 'Sep', val: 6400 },
    { label: 'Oct', val: 6482 }
  ],
  donutTitle = 'Department-wise Students',
  totalCount = '6,482',
  totalCountLabel = 'Students',
  deptDistribution = [
    { name: 'CSE', pct: '28%', color: '#16a34a' },
    { name: 'ECE', pct: '18%', color: '#8b5cf6' },
    { name: 'EEE', pct: '12%', color: '#06b6d4' },
    { name: 'ME', pct: '11%', color: '#f59e0b' },
    { name: 'CE', pct: '10%', color: '#f97316' },
    { name: 'Other', pct: '21%', color: '#3b82f6' }
  ],
  quickActions = null,
  onActionClick = null,
  onRangeChange = null,
  rangeOptions = ['This Year', 'Past 6 Months', 'All Time'],
  selectedRange = null
}) => {
  const navigate = useNavigate();
  const [internalRange, setInternalRange] = useState('This Year');
  const currentRange = selectedRange || internalRange;

  // Interactive SVG points for line chart
  const width = 460;
  const height = 150;

  const vals = (enrollmentTrend || []).map((d) => Number(d.val || 0));
  const hasValues = vals.length > 0;
  const isPercentage = hasValues && Math.max(...vals) <= 100 && (chartTitle.toLowerCase().includes('attendance') || Math.max(...vals) <= 100);
  
  const maxVal = isPercentage ? 100 : (hasValues ? Math.max(...vals, 1) : 100);
  const minVal = isPercentage ? 0 : (hasValues && Math.min(...vals) > 1000 ? Math.floor(Math.min(...vals) * 0.8) : 0);
  const range = maxVal - minVal || 1;

  const points = (enrollmentTrend || []).map((d, i) => {
    const x = 30 + (i * (width - 60)) / Math.max((enrollmentTrend || []).length - 1, 1);
    const rawVal = Number(d.val || 0);
    const y = height - 20 - ((rawVal - minVal) / range) * (height - 40);
    return { x, y: isNaN(y) ? height - 20 : y, label: d.label, val: d.val };
  });

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaD = points.length > 0
    ? `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`
    : '';

  const defaultActions = [
    {
      label: 'Academic Report',
      icon: FileText,
      path: '/reports?tab=academic',
      color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200/70'
    },
    {
      label: 'Approve Requests',
      icon: CheckCircle,
      path: '/principal?tab=approvals',
      color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200/70'
    },
    {
      label: 'View Analytics',
      icon: BarChart3,
      path: '/reports',
      color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200/70'
    },
    {
      label: 'Send Notice',
      icon: Send,
      path: '/notices',
      color: 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100/80 border-emerald-200/70'
    }
  ];

  const actions = quickActions || defaultActions;

  // Pure SVG circumference calculation for donut
  const radius = 38;
  const circumference = 2 * Math.PI * radius; // ~238.76
  let currentOffset = 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
      {/* 1. Student Enrollment Trend / Weekly Attendance Average Chart (5 cols) */}
      <div className="lg:col-span-5 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">{chartTitle}</h3>
          </div>
          <div className="relative">
            <select
              value={currentRange}
              onChange={(e) => {
                setInternalRange(e.target.value);
                if (onRangeChange) onRangeChange(e.target.value);
              }}
              className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl pl-3 pr-7 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {rangeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2 pointer-events-none" />
          </div>
        </div>

        {/* SVG Curve */}
        <div className="relative w-full h-44 mt-3 flex items-center justify-center">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
            <defs>
              <linearGradient id="enrollGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {/* Grid lines */}
            {[0, 1, 2, 3].map((g) => {
              const yVal = 20 + g * 35;
              return (
                <line
                  key={g}
                  x1="30"
                  y1={yVal}
                  x2={width - 20}
                  y2={yVal}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              );
            })}

            {/* Gradient Area */}
            {areaD && <path d={areaD} fill="url(#enrollGrad)" />}

            {/* Line */}
            {pathD && (
              <path
                d={pathD}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Points */}
            {points.map((p, idx) => (
              <g key={idx} className="group">
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="3.5"
                  fill="#ffffff"
                  stroke="#059669"
                  strokeWidth="2"
                  className="transition-all hover:scale-150 cursor-pointer"
                />
                <text
                  x={p.x}
                  y={height - 2}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-400 font-medium"
                >
                  {p.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* 2. Department-wise / Subject Teaching Load Distribution Donut (4 cols) */}
      <div className="lg:col-span-4 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
            <PieChart className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">{donutTitle}</h3>
        </div>

        <div className="flex items-center justify-between gap-4 py-2">
          {/* Dynamic SVG Donut graphic */}
          <div className="relative w-32 h-32 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
              <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#f1f5f9" strokeWidth="14" />
              {deptDistribution.map((d, idx) => {
                const pctNum = parseFloat(d.pct) || 0;
                const sliceLength = (pctNum / 100) * circumference;
                const offset = currentOffset;
                currentOffset += sliceLength;
                return (
                  <circle
                    key={idx}
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="transparent"
                    stroke={d.color || '#16a34a'}
                    strokeWidth="14"
                    strokeDasharray={`${sliceLength} ${circumference - sliceLength}`}
                    strokeDashoffset={-offset}
                    className="transition-all duration-500 ease-out"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-sm font-black text-slate-900 leading-tight">{totalCount}</span>
              <span className="text-[9px] text-slate-500 font-medium leading-none">{totalCountLabel}</span>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 flex-1 max-h-36 overflow-y-auto pr-1">
            {deptDistribution.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="font-semibold text-slate-700 truncate" title={d.name}>{d.name}</span>
                <span className="text-slate-400 text-[11px] ml-auto font-medium">{d.pct}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Quick Actions (3 cols) */}
      <div className="lg:col-span-3 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
            <Zap className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">Quick Actions</h3>
        </div>

        <div className="grid grid-cols-2 gap-2.5 my-auto pt-2">
          {actions.map((act) => {
            const ActIcon = act.icon;
            return (
              <button
                key={act.label}
                type="button"
                onClick={() => {
                  if (onActionClick) onActionClick(act.label);
                  else if (act.path) navigate(act.path);
                }}
                className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 font-bold text-xs transition-all shadow-2xs hover-card-elevate ${act.color}`}
              >
                <ActIcon className="w-5 h-5 shrink-0" />
                <span className="leading-tight">{act.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DashboardAnalyticsRow;
