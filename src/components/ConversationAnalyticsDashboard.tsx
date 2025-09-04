/**
 * Conversation Analytics Dashboard
 * Displays conversation analytics, optimization insights, and A/B test results
 */

'use client';

import React, { useState, useEffect } from 'react';
import { 
  OptimizationDashboard, 
  OptimizationReport, 
  ConversationFlowAnalysis,
  UserEngagementMetrics,
  ConversationQualityMetrics 
} from '@/lib/services/conversationOptimizationService';
import { ABTestResult } from '@/lib/services/abTestingFramework';

interface ConversationAnalyticsDashboardProps {
  conversationId?: string;
  userId?: string;
  sessionId?: string;
  className?: string;
}

export default function ConversationAnalyticsDashboard({
  conversationId,
  userId,
  sessionId,
  className = ''
}: ConversationAnalyticsDashboardProps) {
  const [dashboard, setDashboard] = useState<OptimizationDashboard | null>(null);
  const [optimizationReport, setOptimizationReport] = useState<OptimizationReport | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'conversation' | 'tests' | 'export'>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  useEffect(() => {
    if (conversationId && userId && sessionId && activeTab === 'conversation') {
      loadConversationReport();
    }
  }, [conversationId, userId, sessionId, activeTab]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/analytics/conversation?type=dashboard');
      if (!response.ok) throw new Error('Failed to load dashboard');
      
      const data = await response.json();
      setDashboard(data.dashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadConversationReport = async () => {
    if (!conversationId || !userId || !sessionId) return;

    try {
      const response = await fetch(
        `/api/analytics/conversation?type=optimization&conversationId=${conversationId}&userId=${userId}&sessionId=${sessionId}`
      );
      if (!response.ok) throw new Error('Failed to load conversation report');
      
      const data = await response.json();
      setOptimizationReport(data.optimizationReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation report');
    }
  };

  const exportConversation = async (format: 'json' | 'csv' | 'html' | 'pdf') => {
    if (!conversationId || !userId) return;

    try {
      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'export_conversation',
          conversationId,
          userId,
          options: {
            includeAudio: false,
            includeAnalytics: true,
            includePersonalData: false,
            anonymize: true,
            format
          }
        })
      });

      if (!response.ok) throw new Error('Export failed');
      
      const data = await response.json();
      // In a real implementation, would trigger download
      alert(`Export created: ${data.export.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    }
  };

  const shareConversation = async () => {
    if (!conversationId || !userId) return;

    try {
      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'share_conversation',
          conversationId,
          userId,
          shareOptions: {
            isPublic: true,
            allowComments: false,
            anonymize: true,
            includeAnalytics: true
          }
        })
      });

      if (!response.ok) throw new Error('Share failed');
      
      const data = await response.json();
      // In a real implementation, would show share URL
      alert(`Conversation shared: ${data.shared.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Share failed');
    }
  };

  const createABTest = async (type: 'voice' | 'expression') => {
    try {
      const action = type === 'voice' ? 'create_voice_test' : 'create_expression_test';
      const response = await fetch('/api/analytics/ab-testing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      if (!response.ok) throw new Error('Failed to create test');
      
      const data = await response.json();
      alert(`A/B test created: ${data.testId}`);
      loadDashboardData(); // Refresh dashboard
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create test');
    }
  };

  if (loading) {
    return (
      <div className={`analytics-dashboard ${className}`}>
        <div className="loading-spinner">Loading analytics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`analytics-dashboard ${className}`}>
        <div className="error-message">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className={`analytics-dashboard ${className}`}>
      <div className="dashboard-header">
        <h2>Conversation Analytics Dashboard</h2>
        <div className="tab-navigation">
          <button 
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={activeTab === 'conversation' ? 'active' : ''}
            onClick={() => setActiveTab('conversation')}
            disabled={!conversationId}
          >
            Conversation
          </button>
          <button 
            className={activeTab === 'tests' ? 'active' : ''}
            onClick={() => setActiveTab('tests')}
          >
            A/B Tests
          </button>
          <button 
            className={activeTab === 'export' ? 'active' : ''}
            onClick={() => setActiveTab('export')}
            disabled={!conversationId}
          >
            Export
          </button>
        </div>
      </div>

      <div className="dashboard-content">
        {activeTab === 'overview' && dashboard && (
          <OverviewTab dashboard={dashboard} />
        )}

        {activeTab === 'conversation' && optimizationReport && (
          <ConversationTab report={optimizationReport} />
        )}

        {activeTab === 'tests' && (
          <ABTestsTab onCreateTest={createABTest} />
        )}

        {activeTab === 'export' && (
          <ExportTab 
            onExport={exportConversation}
            onShare={shareConversation}
            conversationId={conversationId}
          />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ dashboard }: { dashboard: OptimizationDashboard }) {
  return (
    <div className="overview-tab">
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total Conversations</h3>
          <div className="metric-value">{dashboard.overview.totalConversations}</div>
        </div>
        <div className="metric-card">
          <h3>Average Quality Score</h3>
          <div className="metric-value">{(dashboard.overview.averageQualityScore * 100).toFixed(1)}%</div>
        </div>
        <div className="metric-card">
          <h3>Average Engagement</h3>
          <div className="metric-value">{(dashboard.overview.averageEngagementScore * 100).toFixed(1)}%</div>
        </div>
        <div className="metric-card">
          <h3>Performance Improvement</h3>
          <div className="metric-value">+{dashboard.overview.performanceImprovement.toFixed(1)}%</div>
        </div>
      </div>

      <div className="trends-section">
        <h3>Performance Trends</h3>
        <div className="trends-grid">
          {dashboard.performanceTrends.map((trend, index) => (
            <div key={index} className="trend-card">
              <h4>{trend.metric}</h4>
              <div className={`trend-indicator ${trend.trend}`}>
                {trend.trend === 'improving' ? '↗' : trend.trend === 'declining' ? '↘' : '→'}
                {Math.abs(trend.changePercentage).toFixed(1)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="alerts-section">
        <h3>Alerts & Recommendations</h3>
        {dashboard.alerts.length > 0 ? (
          <div className="alerts-list">
            {dashboard.alerts.map((alert, index) => (
              <div key={index} className={`alert alert-${alert.severity}`}>
                <div className="alert-message">{alert.message}</div>
                <div className="alert-timestamp">{alert.timestamp.toLocaleString()}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-alerts">No active alerts</div>
        )}
      </div>
    </div>
  );
}

function ConversationTab({ report }: { report: OptimizationReport }) {
  return (
    <div className="conversation-tab">
      <div className="report-summary">
        <h3>Conversation Analysis</h3>
        <div className="summary-metrics">
          <div className="summary-item">
            <span>Performance Score:</span>
            <span className="score">{(report.performanceScore * 100).toFixed(1)}%</span>
          </div>
          <div className="summary-item">
            <span>Improvement Potential:</span>
            <span className="potential">+{(report.improvementPotential * 100).toFixed(1)}%</span>
          </div>
          <div className="summary-item">
            <span>Total Turns:</span>
            <span>{report.flowAnalysis.totalTurns}</span>
          </div>
        </div>
      </div>

      <div className="optimization-suggestions">
        <h3>Optimization Suggestions</h3>
        {report.prioritizedSuggestions.length > 0 ? (
          <div className="suggestions-list">
            {report.prioritizedSuggestions.map((suggestion, index) => (
              <div key={index} className={`suggestion suggestion-${suggestion.priority}`}>
                <div className="suggestion-header">
                  <span className="suggestion-type">{suggestion.type}</span>
                  <span className="suggestion-priority">{suggestion.priority}</span>
                </div>
                <div className="suggestion-description">{suggestion.description}</div>
                <div className="suggestion-action">{suggestion.suggestedAction}</div>
                <div className="suggestion-improvement">{suggestion.expectedImprovement}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-suggestions">No optimization suggestions available</div>
        )}
      </div>

      <div className="engagement-metrics">
        <h3>Engagement Metrics</h3>
        <div className="metrics-grid">
          <div className="metric-item">
            <span>Attention Score:</span>
            <span>{(report.engagementMetrics.attentionScore * 100).toFixed(1)}%</span>
          </div>
          <div className="metric-item">
            <span>Messages Exchanged:</span>
            <span>{report.engagementMetrics.messagesExchanged}</span>
          </div>
          <div className="metric-item">
            <span>Audio Completion Rate:</span>
            <span>{(report.engagementMetrics.audioCompletionRate * 100).toFixed(1)}%</span>
          </div>
          <div className="metric-item">
            <span>Expression Usage:</span>
            <span>{report.engagementMetrics.expressionsHeard}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ABTestsTab({ onCreateTest }: { onCreateTest: (type: 'voice' | 'expression') => void }) {
  const [activeTests, setActiveTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadActiveTests();
  }, []);

  const loadActiveTests = async () => {
    try {
      const response = await fetch('/api/analytics/ab-testing?action=list_tests');
      if (response.ok) {
        const data = await response.json();
        setActiveTests(data.tests);
      }
    } catch (err) {
      console.error('Failed to load tests:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ab-tests-tab">
      <div className="tests-header">
        <h3>A/B Tests</h3>
        <div className="test-actions">
          <button onClick={() => onCreateTest('voice')} className="create-test-btn">
            Create Voice Test
          </button>
          <button onClick={() => onCreateTest('expression')} className="create-test-btn">
            Create Expression Test
          </button>
        </div>
      </div>

      {loading ? (
        <div>Loading tests...</div>
      ) : activeTests.length > 0 ? (
        <div className="tests-list">
          {activeTests.map((test, index) => (
            <div key={index} className="test-card">
              <div className="test-header">
                <h4>{test.name}</h4>
                <span className={`test-status ${test.status}`}>{test.status}</span>
              </div>
              <div className="test-description">{test.description}</div>
              <div className="test-progress">
                <span>Progress: {test.currentSampleSize}/{test.targetSampleSize}</span>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(test.currentSampleSize / test.targetSampleSize) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="no-tests">No active tests</div>
      )}
    </div>
  );
}

function ExportTab({ 
  onExport, 
  onShare, 
  conversationId 
}: { 
  onExport: (format: 'json' | 'csv' | 'html' | 'pdf') => void;
  onShare: () => void;
  conversationId?: string;
}) {
  return (
    <div className="export-tab">
      <div className="export-section">
        <h3>Export Conversation</h3>
        <div className="export-options">
          <button onClick={() => onExport('json')} disabled={!conversationId}>
            Export as JSON
          </button>
          <button onClick={() => onExport('csv')} disabled={!conversationId}>
            Export as CSV
          </button>
          <button onClick={() => onExport('html')} disabled={!conversationId}>
            Export as HTML
          </button>
          <button onClick={() => onExport('pdf')} disabled={!conversationId}>
            Export as PDF
          </button>
        </div>
      </div>

      <div className="share-section">
        <h3>Share Conversation</h3>
        <div className="share-options">
          <button onClick={onShare} disabled={!conversationId}>
            Create Shareable Link
          </button>
        </div>
        <div className="share-note">
          Shared conversations are anonymized and include analytics data.
        </div>
      </div>
    </div>
  );
}