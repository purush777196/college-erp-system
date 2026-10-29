import React, { useState, useEffect } from 'react';
import { Menu, Search, Bell, Calendar } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ProfileMenu from './ProfileMenu';
import { getRoleTheme } from '../../theme/roleThemes';
import api from '../../api/apiClient';

export const Topbar = ({ onToggleSidebar }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = getRoleTheme(user?.role, location.pathname);
  const [apiOnline, setApiOnline] = useState(true);
  const [searchVal, setSearchVal] = useState('');
  const [unreadNoticesCount, setUnreadNoticesCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function checkPing() {
      try {
        await api.checkHealth();
        if (isMounted) setApiOnline(true);
      } catch {
        if (isMounted) setApiOnline(false);
      }
    }
    checkPing();
    const interval = setInterval(checkPing, 45000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function fetchNoticesCount() {
      try {
        const res = await api.getNotices();
        if (isMounted && res?.data) {
          setUnreadNoticesCount(res.data.length);
        }
      } catch {
        // Fallback gracefully without error
      }
    }
    if (isAuthenticated) {
      fetchNoticesCount();
    }
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  const getTimetablePath = () => {
    switch (user?.role) {
      case 'student': return '/student?tab=timetable';
      case 'faculty': return '/faculty?tab=timetable';
      case 'hod': return '/hod?tab=timetable';
      default: return '/timetable';
    }
  };

  const getSearchPlaceholder = () => {
    switch (user?.role) {
      case 'super_admin': return 'Search anything...';
      case 'principal': return 'Search...';
      case 'hod': return 'Search students, faculty, courses...';
      case 'faculty': return 'Search students, courses...';
      case 'student': return 'Search notices, timetable...';
      case 'accounts': return 'Search by student, receipt no...';
      default: return 'Search...';
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchVal.trim()) return;
    const term = searchVal.trim();
    if (user?.role === 'hod') {
      navigate(`/hod?q=${encodeURIComponent(term)}`);
    } else if (user?.role === 'student') {
      navigate(`/notices?q=${encodeURIComponent(term)}`);
    } else if (user?.role === 'faculty') {
      navigate(`/faculty?q=${encodeURIComponent(term)}`);
    } else {
      navigate(`/courses?q=${encodeURIComponent(term)}`);
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-100 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: Mobile hamburger */}
      <div className="flex items-center space-x-3 flex-1 max-w-md">
        <button
          onClick={onToggleSidebar}
          className="p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-50 lg:hidden focus:outline-none transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Input */}
        <form onSubmit={handleSearchSubmit} className="relative w-full max-w-sm hidden sm:block">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
            placeholder={getSearchPlaceholder()}
            className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </form>
      </div>

      {/* Right: Notifications, status, and profile avatar */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Calendar / Schedule quick link - role-aware */}
        <Link
          to={getTimetablePath()}
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors hidden sm:inline-flex"
          title="Class Schedule"
        >
          <Calendar className="w-4 h-4" />
        </Link>

        {/* Notices notification bell */}
        <Link
          to="/notices"
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors relative"
          title={unreadNoticesCount > 0 ? `${unreadNoticesCount} Active Notice(s)` : 'Circulars & Notices'}
        >
          <Bell className="w-4 h-4" />
          {unreadNoticesCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white" />
          )}
        </Link>

        {/* User initials avatar circle matching the reference image */}
        {isAuthenticated && user && (
          <div className="flex items-center space-x-2">
            <ProfileMenu />
          </div>
        )}
      </div>
    </header>
  );
};

export default Topbar;
