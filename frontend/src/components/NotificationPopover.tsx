import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  Bell,
  Check,
  Trash2,
  ShieldAlert,
  AlertTriangle,
  Info,
  CheckCircle2,
} from "lucide-react";
import { api, NotificationItem } from "../services/api";
import { useNavigate } from "react-router-dom";

function formatTimeAgo(dateString?: string): string {
  if (!dateString) return "Just now";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHour < 24) return `${diffHour} ${diffHour === 1 ? "hour" : "hours"} ago`;
  if (diffDay < 7) return `${diffDay} ${diffDay === 1 ? "day" : "days"} ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getNotificationIcon(type?: string) {
  switch (type?.toLowerCase()) {
    case "alert":
    case "warning":
      return (
        <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30 shrink-0">
          <AlertTriangle className="w-3.5 h-3.5" />
        </div>
      );
    case "error":
    case "danger":
      return (
        <div className="p-1.5 rounded-lg bg-rose-500/15 text-rose-400 border border-rose-500/30 shrink-0">
          <ShieldAlert className="w-3.5 h-3.5" />
        </div>
      );
    case "success":
      return (
        <div className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
      );
    default:
      return (
        <div className="p-1.5 rounded-lg bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/30 shrink-0">
          <Bell className="w-3.5 h-3.5" />
        </div>
      );
  }
}

import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function NotificationPopover() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const { data: notifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ["notifications"],
    queryFn: () => api.getNotifications(),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000, // Single global 60s background refresh (Phase 10)
  });

  // Position calculation: strictly prevents overlapping sidebar and keeps inside viewport
  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const isMobile = viewportWidth < 1024; // Tailwind lg breakpoint

    const panelWidth = isMobile
      ? Math.min(360, viewportWidth - 24)
      : Math.min(360, viewportWidth - 32);

    let top: number;
    let left: number;

    if (isMobile) {
      // Mobile positioning: Anchor cleanly below bell, aligned within viewport with safe margins
      top = Math.min(rect.bottom + 8, viewportHeight - 120);
      left = Math.max(12, Math.min(rect.right - panelWidth + 8, viewportWidth - panelWidth - 12));
    } else {
      // Desktop positioning:
      // The sidebar boundary is at x = 270px.
      // The popover MUST open toward the RIGHT side of the bell and NEVER overlap the left sidebar.
      // Maintain a safe gap of 14–16px from sidebar boundary (minimum left = 284px).
      const sidebarWidth = 270;
      const minSafeDesktopLeft = sidebarWidth + 14;

      if (rect.left < sidebarWidth) {
        // Bell is inside the sidebar:
        // Position popover outside the sidebar to the right of the bell
        left = Math.max(rect.right + 14, minSafeDesktopLeft);
        top = Math.max(16, Math.min(rect.top - 6, viewportHeight - 500));
      } else {
        // Bell is in a top navbar outside the sidebar:
        left = Math.max(minSafeDesktopLeft, rect.left);
        if (left + panelWidth > viewportWidth - 16) {
          left = viewportWidth - panelWidth - 16;
        }
        top = Math.min(rect.bottom + 8, viewportHeight - 500);
      }
    }

    setCoords({ top, left, width: panelWidth });
  }, []);

  useEffect(() => {
    if (!open) return;

    updatePosition();

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, updatePosition]);

  // Click outside listener
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleMarkRead = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      queryClient.setQueryData<NotificationItem[]>(["notifications"], (prev) =>
        prev ? prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)) : []
      );
    } catch {
      // Ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      queryClient.setQueryData<NotificationItem[]>(["notifications"], (prev) =>
        prev ? prev.map((n) => ({ ...n, is_read: true })) : []
      );
    } catch {
      // Ignore
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteNotification(id);
      queryClient.setQueryData<NotificationItem[]>(["notifications"], (prev) =>
        prev ? prev.filter((n) => n.id !== id) : []
      );
    } catch {
      // Ignore
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="relative inline-block">
      {/* Enhanced Notification Bell Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`relative p-2 rounded-xl transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#A78BFA]/40 ${
          open
            ? "bg-[#252141] text-[#A78BFA] border border-[#8B5CF6]/50 shadow-sm shadow-[#8B5CF6]/20"
            : "text-[#B7B1D1] hover:text-[#F5F3FF] hover:bg-[#1C1933] border border-[#383154]"
        }`}
        aria-label="View notifications"
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className={`w-4 h-4 transition-transform duration-150 ${open ? "scale-105" : ""}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-500 rounded-full ring-2 ring-[#1C1933] animate-pulse shadow-sm shadow-rose-500/30">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Modern Popover Panel Portaled into Body to Escape Overflow/Stacking Bounds */}
      {open &&
        coords &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              maxHeight: "480px",
            }}
            className="z-[9999] rounded-2xl bg-[#1C1933] border border-[#383154] shadow-2xl shadow-[#0C0A1D]/90 backdrop-blur-xl overflow-hidden flex flex-col animate-popover-in"
            role="dialog"
            aria-label="Notifications"
          >
            {/* Header: Title on Left, Mark All As Read Action on Right */}
            <div className="flex items-center justify-between px-4 py-3 sm:px-4.5 sm:py-3.5 border-b border-[#383154] bg-[#252141]/90 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-[#F5F3FF] tracking-tight font-['Space_Grotesk']">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#8B5CF6]/15 text-[#A78BFA] border border-[#8B5CF6]/30">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-[#A78BFA] hover:text-[#F5F3FF] flex items-center gap-1 font-medium transition-colors hover:underline focus:outline-none"
                >
                  <Check className="w-3 h-3" />
                  Mark all as read
                </button>
              ) : (
                <span className="text-[10px] text-[#B7B1D1] font-medium">All caught up</span>
              )}
            </div>

            {/* Scrollable Notification Items List */}
            <div className="flex-1 overflow-y-auto max-h-[410px] divide-y divide-[#383154]/80 custom-scrollbar">
              {notifications.length === 0 ? (
                /* Polished Empty State */
                <div className="py-10 px-6 text-center flex flex-col items-center justify-center">
                  <div className="w-11 h-11 rounded-2xl bg-[#151229] border border-[#383154] flex items-center justify-center mb-3 text-[#B7B1D1] shadow-inner">
                    <Bell className="w-5 h-5 text-[#B7B1D1]" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold text-[#F5F3FF] font-['Space_Grotesk']">No notifications yet</p>
                  <p className="text-[11px] text-[#B7B1D1] mt-1 max-w-[230px] leading-relaxed">
                    You're all caught up with your assessments, risk alerts, and review statuses.
                  </p>
                </div>
              ) : (
                notifications.map((n) => {
                  const isUnread = !n.is_read;
                  return (
                    <div
                      key={n.id}
                      className={`p-3.5 sm:p-4 flex items-start gap-3 transition-colors duration-150 relative ${
                        isUnread
                          ? "bg-[#252141]/80 hover:bg-[#30294D]"
                          : "bg-transparent hover:bg-[#252141]/50 opacity-80 hover:opacity-100"
                      }`}
                    >
                      {/* Left accent bar for unread items */}
                      {isUnread && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#8B5CF6] rounded-r" />
                      )}

                      {/* Icon */}
                      {getNotificationIcon(n.type)}

                      {/* Content Area */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          if (isUnread) handleMarkRead(n.id);
                          if (n.link) {
                            setOpen(false);
                            navigate(n.link);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p
                            className={`text-xs truncate ${
                              isUnread ? "text-[#F5F3FF] font-bold" : "text-[#F5F3FF] font-medium"
                            }`}
                          >
                            {n.title}
                          </p>
                          {isUnread && (
                            <span
                              className="w-2 h-2 rounded-full bg-[#8B5CF6] shrink-0 shadow-sm shadow-[#8B5CF6]/50"
                              title="Unread"
                            />
                          )}
                        </div>

                        <p className="text-[11px] text-[#B7B1D1] leading-relaxed line-clamp-2">
                          {n.message}
                        </p>

                        <div className="flex items-center justify-between mt-2 pt-0.5">
                          <span className="text-[10px] text-[#B7B1D1] font-medium">
                            {formatTimeAgo(n.created_at)}
                          </span>

                          <div
                            className="flex items-center gap-1.5 opacity-80 hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isUnread && (
                              <button
                                type="button"
                                onClick={() => handleMarkRead(n.id)}
                                className="p-1 text-[#B7B1D1] hover:text-[#A78BFA] hover:bg-[#8B5CF6]/10 rounded transition-colors"
                                title="Mark as read"
                                aria-label="Mark as read"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDelete(n.id)}
                              className="p-1 text-[#B7B1D1] hover:text-[#F87171] hover:bg-rose-500/10 rounded transition-colors"
                              title="Delete notification"
                              aria-label="Delete notification"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
