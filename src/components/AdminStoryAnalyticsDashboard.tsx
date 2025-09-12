// src/components/AdminStoryAnalyticsDashboard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import styles from './AdminStoryAnalyticsDashboard.module.css';

interface AdminAnalytics {
  totalUsers: number;
  totalAvatars: number;
  totalStories: number;
  totalTriggers: number;
  globalSuccessRate: number;
  topPerformingStories: Array<{
    storyId: string;
    title: string;
    ownerType: string;
    ownerId: string;
    successRate: number;
    totalTriggers: number;
  }>;
  categoryBreakdown: Array<{
    category: string;
    storyCount: number;
    triggerCount: number;
    successRate: number;
  }>;
}

export default function AdminStoryAnalyticsDashboard() {
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/story-analytics');
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAnalytics(data.analytics);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch admin analytics');
      console.error('Failed to fetch admin analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchAnalytics, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 90) return 'excellent';
    if (rate >= 80) return 'good';
    if (rate >= 70) return 'warning';
    return 'poor';
  };

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loading}>Loading admin analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.error}>
          <h3>Error Loading Admin Analytics</h3>
          <p>{error}</p>
          <button onClick={fetchAnalytics} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.noData}>No analytics data available</div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h1>Admin Story Analytics Dashboard</h1>
        <div className={styles.controls}>
          <label className={styles.autoRefreshToggle}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (30s)
          </label>
          <button onClick={fetchAnalytics} className={styles.refreshButton}>
            Refresh Now
          </button>
        </div>
      </div>

      {/* Global Statistics */}
      <div className={styles.globalStats}>
        <h2>Global Statistics</h2>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statIcon}>👥</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{analytics.totalUsers}</div>
              <div className={styles.statLabel}>Active Users</div>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statIcon}>🤖</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{analytics.totalAvatars}</div>
              <div className={styles.statLabel}>Active Avatars</div>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statIcon}>📚</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{analytics.totalStories}</div>
              <div className={styles.statLabel}>Total Stories</div>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statIcon}>⚡</div>
            <div className={styles.statContent}>
              <div className={styles.statValue}>{analytics.totalTriggers.toLocaleString()}</div>
              <div className={styles.statLabel}>Total Triggers</div>
            </div>
          </div>
          
          <div className={styles.statCard}>
            <div className={styles.statIcon}>✅</div>
            <div className={styles.statContent}>
              <div className={`${styles.statValue} ${getSuccessRateColor(analytics.globalSuccessRate)}`}>
                {formatPercentage(analytics.globalSuccessRate)}
              </div>
              <div className={styles.statLabel}>Global Success Rate</div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      <div className={styles.categorySection}>
        <h2>Category Performance</h2>
        <div className={styles.categoryGrid}>
          {analytics.categoryBreakdown.map((category, index) => (
            <div key={index} className={styles.categoryCard}>
              <div className={styles.categoryHeader}>
                <h3>{category.category}</h3>
                <div className={`${styles.categorySuccessRate} ${getSuccessRateColor(category.successRate)}`}>
                  {formatPercentage(category.successRate)}
                </div>
              </div>
              <div className={styles.categoryStats}>
                <div className={styles.categoryStat}>
                  <span className={styles.categoryStatLabel}>Stories:</span>
                  <span className={styles.categoryStatValue}>{category.storyCount}</span>
                </div>
                <div className={styles.categoryStat}>
                  <span className={styles.categoryStatLabel}>Triggers:</span>
                  <span className={styles.categoryStatValue}>{category.triggerCount.toLocaleString()}</span>
                </div>
              </div>
              <div className={styles.categoryProgress}>
                <div 
                  className={styles.categoryProgressBar}
                  style={{ width: `${category.successRate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Performing Stories */}
      <div className={styles.topStoriesSection}>
        <h2>Top Performing Stories</h2>
        <div className={styles.storiesTable}>
          <div className={styles.tableHeader}>
            <div className={styles.tableHeaderCell}>Story Title</div>
            <div className={styles.tableHeaderCell}>Owner</div>
            <div className={styles.tableHeaderCell}>Type</div>
            <div className={styles.tableHeaderCell}>Triggers</div>
            <div className={styles.tableHeaderCell}>Success Rate</div>
          </div>
          
          {analytics.topPerformingStories.length > 0 ? (
            analytics.topPerformingStories.map((story, index) => (
              <div key={index} className={styles.tableRow}>
                <div className={styles.tableCell}>
                  <div className={styles.storyTitle}>{story.title}</div>
                  <div className={styles.storyId}>ID: {story.storyId.slice(0, 8)}...</div>
                </div>
                <div className={styles.tableCell}>
                  <div className={styles.ownerId}>{story.ownerId.slice(0, 8)}...</div>
                </div>
                <div className={styles.tableCell}>
                  <span className={`${styles.ownerType} ${styles[story.ownerType]}`}>
                    {story.ownerType}
                  </span>
                </div>
                <div className={styles.tableCell}>
                  <span className={styles.triggerCount}>{story.totalTriggers}</span>
                </div>
                <div className={styles.tableCell}>
                  <span className={`${styles.successRate} ${getSuccessRateColor(story.successRate)}`}>
                    {formatPercentage(story.successRate)}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.noStoriesMessage}>
              No story performance data available
            </div>
          )}
        </div>
      </div>

      {/* System Health Indicators */}
      <div className={styles.healthSection}>
        <h2>System Health</h2>
        <div className={styles.healthGrid}>
          <div className={styles.healthCard}>
            <div className={styles.healthIcon}>🎯</div>
            <div className={styles.healthContent}>
              <div className={styles.healthTitle}>Story Adoption</div>
              <div className={styles.healthValue}>
                {analytics.totalUsers > 0 
                  ? `${((analytics.totalStories / analytics.totalUsers) * 100).toFixed(1)}%`
                  : '0%'
                }
              </div>
              <div className={styles.healthDescription}>
                Average stories per user
              </div>
            </div>
          </div>
          
          <div className={styles.healthCard}>
            <div className={styles.healthIcon}>📈</div>
            <div className={styles.healthContent}>
              <div className={styles.healthTitle}>Engagement Rate</div>
              <div className={styles.healthValue}>
                {analytics.totalStories > 0 
                  ? `${(analytics.totalTriggers / analytics.totalStories).toFixed(1)}`
                  : '0'
                }
              </div>
              <div className={styles.healthDescription}>
                Average triggers per story
              </div>
            </div>
          </div>
          
          <div className={styles.healthCard}>
            <div className={styles.healthIcon}>⚡</div>
            <div className={styles.healthContent}>
              <div className={styles.healthTitle}>System Reliability</div>
              <div className={`${styles.healthValue} ${getSuccessRateColor(analytics.globalSuccessRate)}`}>
                {formatPercentage(analytics.globalSuccessRate)}
              </div>
              <div className={styles.healthDescription}>
                Overall success rate
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className={styles.actionsSection}>
        <h2>Quick Actions</h2>
        <div className={styles.actionButtons}>
          <button className={styles.actionButton} onClick={() => window.open('/admin/story-performance', '_blank')}>
            📊 View Performance Metrics
          </button>
          <button className={styles.actionButton} onClick={() => window.location.reload()}>
            🔄 Refresh All Data
          </button>
          <button className={styles.actionButton} onClick={() => console.log('Export functionality would go here')}>
            📥 Export Analytics
          </button>
        </div>
      </div>
    </div>
  );
}