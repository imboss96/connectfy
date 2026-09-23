import React, { useState } from 'react';
import { Bell, Check, CheckCheck, Sparkles, DollarSign, Award, AlertCircle, Info, ExternalLink } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { NotificationItem } from '../types';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onActionClick?: (item: NotificationItem) => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ isOpen, onClose, onActionClick }) => {
  const { notifications, markNotificationRead, markAllNotificationsRead, role } = useApp();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  if (!isOpen) return null;

  // Filter notifications relevant to current role or general
  const filteredList = notifications
    .filter(n => n.targetRole === role || n.targetRole === 'tester')
    .filter(n => (filter === 'unread' ? !n.read : true));

  const unreadCount = notifications.filter(n => (n.targetRole === role || n.targetRole === 'tester') && !n.read).length;

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'earning':
        return <DollarSign className="w-4 h-4 text-emerald-400" />;
      case 'invite':
        return <Sparkles className="w-4 h-4 text-amber-400" />;
      case 'approval':
        return <Award className="w-4 h-4 text-blue-400" />;
      case 'revision':
        return <AlertCircle className="w-4 h-4 text-rose-400" />;
      case 'payout':
        return <DollarSign className="w-4 h-4 text-purple-400" />;
      default:
        return <Info className="w-4 h-4 text-sky-400" />;
    }
  };

  return (
    <div className="theme-notifications fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 w-auto sm:w-96 max-w-[calc(100vw-1.5rem)] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden text-slate-100 animate-fade-in">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center space-x-2">
          <Bell className="w-4 h-4 text-blue-400" />
          <span className="font-semibold text-sm text-white">Notifications</span>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-blue-500/20 text-blue-400 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllNotificationsRead}
              className="text-xs text-slate-400 hover:text-blue-400 flex items-center space-x-1 transition"
              title="Mark all as read"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1 rounded-md font-medium transition ${
            filter === 'all'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          All ({notifications.filter(n => n.targetRole === role || n.targetRole === 'tester').length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1 rounded-md font-medium transition ml-1 ${
            filter === 'unread'
              ? 'bg-slate-800 text-white'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {/* Notification Items */}
      <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-800/60">
        {filteredList.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            <Bell className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-40" />
            No notifications in this view
          </div>
        ) : (
          filteredList.map((notif) => (
            <div
              key={notif.id}
              onClick={() => {
                markNotificationRead(notif.id);
                if (onActionClick) onActionClick(notif);
              }}
              className={`p-3.5 hover:bg-slate-800/60 transition cursor-pointer flex items-start space-x-3 ${
                !notif.read ? 'bg-blue-950/20' : ''
              }`}
            >
              <div className="p-2 rounded-lg bg-slate-800 border border-slate-700/60 shrink-0 mt-0.5">
                {getIcon(notif.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className={`text-xs font-semibold truncate ${!notif.read ? 'text-white' : 'text-slate-300'}`}>
                    {notif.title}
                  </h4>
                  {!notif.read && (
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0 ml-2" />
                  )}
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {notif.message}
                </p>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500">
                  <span>{notif.createdAt}</span>
                  {notif.amount && (
                    <span className="font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      +${notif.amount.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-2.5 bg-slate-900 border-t border-slate-800 text-center">
        <span className="text-[11px] text-slate-500">Real-time status triggers enabled</span>
      </div>
    </div>
  );
};
