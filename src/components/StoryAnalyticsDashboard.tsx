// src/components/StoryAnalyticsDashboard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import styles from './StoryAnalyticsDashboard.module.css';

interface StoryUsageReport {
  storyId: string;
  title: string;
  category: string;
  totalTriggers: number;
  successfulPlays: number;
  failedPlays: number;
  successRate: number;
  avgPlaybackDuration: number;
  avgConfidenceScore: number;
  topTriggerKeywords: Array<{ keyword: string; count: number }>;
  lastTriggered: string | null;
  createdAt: string;
}

interface StoryEffectivenessMetrics {
  storyId: string;
  title: string;
  category: string;
  triggerFrequency: number;
  engagementScore: number;
  userSatisfactionScore: number;
  recommendedActions: string[];
}

interface AggregatedAnalytics {
  totalStories: number;
  totalTriggers: number;
  totalSuccessfulPlays: number;
  overallSuccessRate: number;
  avgStoryDuration: number;
  topCategories: Array<{ category: string; count: number; successRate: number }>;
  triggerTrends: Array<{ date: string; triggers: number; successes: number }>;
  performanceMetrics: {
    avgMatchLatency: number;
    avgStartLatency: number;
    slaCompliance: number;
  };
}

interface StoryAnalyticsDashboardProps {
  ownerId: string;
  ownerType: 'user' | 'avatar';
}

export default function StoryAnalyticsDashboard({ ownerId, ownerType }: StoryAnalyticsDashboardProps) {
  const [aggregatedData, setAggregatedData] = useState<AggregatedAnalytics | null>(null);
  const [effectivenessMetrics, setEffectivenessMetrics] = useState<StoryEffectivenessMetrics[]>([]);
  const [selectedStoryReport, setSelectedStoryReport] = useState<StoryUsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'effectiveness' | 'details'>('overview');

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch aggregated analytics
      const aggregatedResponse = await fetch(
        `/api/stories/analytics?ownerId=${ownerId}&ownerType=${ownerType}&type=aggregated`
      );
      if (!aggregatedResponse.ok) {
        throw new Error(`Failed to fetch aggregated analytics: ${aggregatedResponse.statusText}`);
      }
      const aggregatedResult = await aggregatedResponse.json();
      setAggregatedData(aggregatedResult.analytics);

      // Fetch effectiveness metrics
      const effectivenessResponse = await fetch(
        `/api/stories/analytics?ownerId=${ownerId}&ownerType=${ownerType}&type=effectiveness`
      );
      if (!effectivenessResponse.ok) {
        throw new Error(`Failed to fetch effectiveness metrics: ${effectivenessResponse.statusText}`);
      }
      const effectivenessResult = await effectivenessResponse.json();
      setEffectivenessMetrics(effectivenessResult.metrics);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
      console.error('Failed to fetch story analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStoryReport = async (storyId: string) => {
    try {
      const response = await fetch(
        `/api/stories/analytics?ownerId=${ownerId}&ownerType=${ownerType}&type=story&storyId=${storyId}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch story report: ${response.statusText}`);
      }
      const result = await response.json();
      setSelectedStoryReport(result.report);
      setActiveTab('details');
    } catch (err) {
      console.error('Failed to fetch story report:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch story report');
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [ownerId, ownerType]);

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString();
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'good';
    if (score >= 60) return 'warning';
    return 'poor';
  };

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loading}>Loading story analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.error}>
          <h3>Error Loading Analytics</h3>
          <p>{error}</p>
          <button onClick={fetchAnalytics} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h2>Story Analytics Dashboard</h2>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'effectiveness' ? styles.active : ''}`}
            onClick={() => setActiveTab('effectiveness')}
          >
            Effectiveness
          </button>
          {selectedStoryReport && (
            <button
              className={`${styles.tab} ${activeTab === 'details' ? styles.active : ''}`}
              onClick={() => setActiveTab('details')}
            >
              Story Details
            </button>
          )}
        </div>
        <button onClick={fetchAnalytics} className={styles.refreshButton}>
          Refresh
        </button>
      </div>

      {activeTab === 'overview' && aggregatedData && (
        <div className={styles.overviewTab}>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h3>Total Stories</h3>
              <div className={styles.statValue}>{aggregatedData.totalStories}</div>
            </div>
            <div className={styles.statCard}>
              <h3>Total Triggers</h3>
              <div className={styles.statValue}>{aggregatedData.totalTriggers}</div>
            </div>
            <div className={styles.statCard}>
              <h3>Successful Plays</h3>
              <div className={styles.statValue}>{aggregatedData.totalSuccessfulPlays}</div>
            </div>
            <div className={styles.statCard}>
              <h3>Success Rate</h3>
              <div className={`${styles.statValue} ${getScoreColor(aggregatedData.overallSuccessRate)}`}>
                {formatPercentage(aggregatedData.overallSuccessRate)}
              </div>
            </div>
            <div className={styles.statCard}>
              <h3>Avg Duration</h3>
              <div className={styles.statValue}>
                {formatDuration(aggregatedData.avgStoryDuration)}
              </div>
            </div>
          </div>

          <div className={styles.chartsGrid}>
            <div className={styles.chartCard}>
              <h3>Categories Performance</h3>
              <div className={styles.categoryList}>
                {aggregatedData.topCategories.map((category, index) => (
                  <div key={index} className={styles.categoryItem}>
                    <div className={styles.categoryName}>{category.category}</div>
                    <div className={styles.categoryStats}>
                      <span>{category.count} stories</span>
                      <span className={getScoreColor(category.successRate)}>
                        {formatPercentage(category.successRate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.chartCard}>
              <h3>Trigger Trends (Last 30 Days)</h3>
              <div className={styles.trendChart}>
                {aggregatedData.triggerTrends.slice(-7).map((trend, index) => (
                  <div key={index} className={styles.trendItem}>
                    <div className={styles.trendDate}>{formatDate(trend.date)}</div>
                    <div className={styles.trendBars}>
                      <div 
                        className={styles.trendBar}
                        style={{ 
                          height: `${Math.max(4, (trend.triggers / Math.max(...aggregatedData.triggerTrends.map(t => t.triggers))) * 40)}px` 
                        }}
                        title={`${trend.triggers} triggers, ${trend.successes} successes`}
                      />
                    </div>
                    <div className={styles.trendValue}>{trend.triggers}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'effectiveness' && (
        <div className={styles.effectivenessTab}>
          <div className={styles.metricsGrid}>
            {effectivenessMetrics.map((metric, index) => (
              <div key={index} className={styles.metricCard}>
                <div className={styles.metricHeader}>
                  <h3 
                    className={styles.clickableTitle}
                    onClick={() => fetchStoryReport(metric.storyId)}
                  >
                    {metric.title}
                  </h3>
                  <span className={styles.category}>{metric.category}</span>
                </div>
                
                <div className={styles.scoreGrid}>
                  <div className={styles.scoreItem}>
                    <span className={styles.scoreLabel}>Trigger Frequency</span>
                    <span className={styles.scoreValue}>
                      {metric.triggerFrequency.toFixed(1)}/day
                    </span>
                  </div>
                  <div className={styles.scoreItem}>
                    <span className={styles.scoreLabel}>Engagement</span>
                    <span className={`${styles.scoreValue} ${getScoreColor(metric.engagementScore)}`}>
                      {metric.engagementScore}
                    </span>
                  </div>
                  <div className={styles.scoreItem}>
                    <span className={styles.scoreLabel}>Satisfaction</span>
                    <span className={`${styles.scoreValue} ${getScoreColor(metric.userSatisfactionScore)}`}>
                      {metric.userSatisfactionScore}
                    </span>
                  </div>
                </div>

                <div className={styles.recommendations}>
                  <h4>Recommendations:</h4>
                  <ul>
                    {metric.recommendedActions.map((action, actionIndex) => (
                      <li key={actionIndex}>{action}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'details' && selectedStoryReport && (
        <div className={styles.detailsTab}>
          <div className={styles.storyHeader}>
            <h3>{selectedStoryReport.title}</h3>
            <span className={styles.category}>{selectedStoryReport.category}</span>
            <button 
              onClick={() => setActiveTab('effectiveness')}
              className={styles.backButton}
            >
              ← Back to Effectiveness
            </button>
          </div>

          <div className={styles.detailsGrid}>
            <div className={styles.detailCard}>
              <h4>Usage Statistics</h4>
              <div className={styles.detailStats}>
                <div className={styles.detailStat}>
                  <span>Total Triggers:</span>
                  <span>{selectedStoryReport.totalTriggers}</span>
                </div>
                <div className={styles.detailStat}>
                  <span>Successful Plays:</span>
                  <span>{selectedStoryReport.successfulPlays}</span>
                </div>
                <div className={styles.detailStat}>
                  <span>Failed Plays:</span>
                  <span>{selectedStoryReport.failedPlays}</span>
                </div>
                <div className={styles.detailStat}>
                  <span>Success Rate:</span>
                  <span className={getScoreColor(selectedStoryReport.successRate)}>
                    {formatPercentage(selectedStoryReport.successRate)}
                  </span>
                </div>
                <div className={styles.detailStat}>
                  <span>Avg Playback Duration:</span>
                  <span>{formatDuration(selectedStoryReport.avgPlaybackDuration)}</span>
                </div>
                <div className={styles.detailStat}>
                  <span>Avg Confidence Score:</span>
                  <span>{(selectedStoryReport.avgConfidenceScore * 100).toFixed(1)}%</span>
                </div>
                <div className={styles.detailStat}>
                  <span>Last Triggered:</span>
                  <span>
                    {selectedStoryReport.lastTriggered 
                      ? formatDate(selectedStoryReport.lastTriggered)
                      : 'Never'
                    }
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.detailCard}>
              <h4>Top Trigger Keywords</h4>
              <div className={styles.keywordList}>
                {selectedStoryReport.topTriggerKeywords.length > 0 ? (
                  selectedStoryReport.topTriggerKeywords.map((keyword, index) => (
                    <div key={index} className={styles.keywordItem}>
                      <span className={styles.keyword}>{keyword.keyword}</span>
                      <span className={styles.keywordCount}>{keyword.count}</span>
                    </div>
                  ))
                ) : (
                  <p>No trigger data available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}