/**
 * Alerting System for Hybrid Retrieval Production Monitoring
 * 
 * Handles alert notifications, escalation, and integration with
 * external monitoring systems like PagerDuty, Slack, etc.
 */

import { EventEmitter } from 'events';
import { AlertEvent, DashboardMetrics } from './productionMonitoringDashboard';

export interface AlertChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'pagerduty' | 'console';
  config: Record<string, any>;
  enabled: boolean;
}

export interface AlertNotification {
  id: string;
  alertEvent: AlertEvent;
  channel: AlertChannel;
  timestamp: number;
  status: 'pending' | 'sent' | 'failed' | 'acknowledged';
  retryCount: number;
  error?: string;
}

export interface EscalationRule {
  id: string;
  name: string;
  conditions: {
    severity: ('warning' | 'critical')[];
    unacknowledgedTimeMs: number;
    repeatCount?: number;
  };
  actions: {
    channels: string[];
    escalateToChannels?: string[];
  };
}

export interface AlertingConfig {
  maxRetries: number;
  retryDelayMs: number;
  acknowledgmentTimeoutMs: number;
  enableEscalation: boolean;
  defaultChannels: string[];
}

export class AlertingSystem extends EventEmitter {
  private channels: Map<string, AlertChannel>;
  private notifications: Map<string, AlertNotification>;
  private escalationRules: Map<string, EscalationRule>;
  private config: AlertingConfig;
  private acknowledgedAlerts: Set<string>;

  constructor(config: Partial<AlertingConfig> = {}) {
    super();
    
    this.channels = new Map();
    this.notifications = new Map();
    this.escalationRules = new Map();
    this.acknowledgedAlerts = new Set();
    
    this.config = {
      maxRetries: 3,
      retryDelayMs: 60000, // 1 minute
      acknowledgmentTimeoutMs: 900000, // 15 minutes
      enableEscalation: true,
      defaultChannels: ['console'],
      ...config
    };

    this.setupDefaultChannels();
    this.setupDefaultEscalationRules();
  }

  /**
   * Add alert channel
   */
  addChannel(channel: AlertChannel): void {
    this.channels.set(channel.id, channel);
    console.log(`Alert channel added: ${channel.name} (${channel.type})`);
  }

  /**
   * Remove alert channel
   */
  removeChannel(channelId: string): void {
    this.channels.delete(channelId);
    console.log(`Alert channel removed: ${channelId}`);
  }

  /**
   * Add escalation rule
   */
  addEscalationRule(rule: EscalationRule): void {
    this.escalationRules.set(rule.id, rule);
    console.log(`Escalation rule added: ${rule.name}`);
  }

  /**
   * Process alert event and send notifications
   */
  async processAlert(alertEvent: AlertEvent): Promise<void> {
    const alertKey = `${alertEvent.ruleId}_${alertEvent.timestamp}`;
    
    // Check if alert is already acknowledged
    if (this.acknowledgedAlerts.has(alertKey)) {
      console.log(`Alert already acknowledged: ${alertEvent.ruleName}`);
      return;
    }

    // Determine channels to notify
    const channelsToNotify = this.determineChannelsForAlert(alertEvent);
    
    // Send notifications
    const notifications: AlertNotification[] = [];
    for (const channelId of channelsToNotify) {
      const channel = this.channels.get(channelId);
      if (!channel || !channel.enabled) {
        continue;
      }

      const notification: AlertNotification = {
        id: `${alertKey}_${channelId}`,
        alertEvent,
        channel,
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0
      };

      notifications.push(notification);
      this.notifications.set(notification.id, notification);
    }

    // Send notifications
    for (const notification of notifications) {
      await this.sendNotification(notification);
    }

    // Set up escalation if enabled
    if (this.config.enableEscalation) {
      this.scheduleEscalation(alertEvent, alertKey);
    }

    this.emit('alert:processed', { alertEvent, notifications });
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertKey: string, acknowledgedBy: string): void {
    this.acknowledgedAlerts.add(alertKey);
    
    console.log(`Alert acknowledged: ${alertKey} by ${acknowledgedBy}`);
    this.emit('alert:acknowledged', { alertKey, acknowledgedBy, timestamp: Date.now() });
  }

  /**
   * Get notification status
   */
  getNotificationStatus(notificationId: string): AlertNotification | undefined {
    return this.notifications.get(notificationId);
  }

  /**
   * Get all active notifications
   */
  getActiveNotifications(): AlertNotification[] {
    return Array.from(this.notifications.values())
      .filter(n => n.status === 'pending' || n.status === 'sent');
  }

  /**
   * Test alert channel
   */
  async testChannel(channelId: string): Promise<boolean> {
    const channel = this.channels.get(channelId);
    if (!channel) {
      throw new Error(`Channel not found: ${channelId}`);
    }

    const testAlert: AlertEvent = {
      ruleId: 'test',
      ruleName: 'Test Alert',
      severity: 'warning',
      timestamp: Date.now(),
      metrics: {} as DashboardMetrics,
      message: 'This is a test alert to verify channel configuration'
    };

    const testNotification: AlertNotification = {
      id: `test_${Date.now()}`,
      alertEvent: testAlert,
      channel,
      timestamp: Date.now(),
      status: 'pending',
      retryCount: 0
    };

    try {
      await this.sendNotification(testNotification);
      return testNotification.status === 'sent';
    } catch (error) {
      console.error(`Channel test failed for ${channelId}:`, error);
      return false;
    }
  }

  private setupDefaultChannels(): void {
    // Console channel (always available)
    this.addChannel({
      id: 'console',
      name: 'Console Logger',
      type: 'console',
      config: {},
      enabled: true
    });

    // Webhook channel template
    this.addChannel({
      id: 'webhook',
      name: 'Generic Webhook',
      type: 'webhook',
      config: {
        url: process.env.ALERT_WEBHOOK_URL || '',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      },
      enabled: !!process.env.ALERT_WEBHOOK_URL
    });

    // Slack channel template
    this.addChannel({
      id: 'slack',
      name: 'Slack Notifications',
      type: 'slack',
      config: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
        channel: process.env.SLACK_CHANNEL || '#alerts',
        username: 'Hybrid Retrieval Monitor'
      },
      enabled: !!process.env.SLACK_WEBHOOK_URL
    });
  }

  private setupDefaultEscalationRules(): void {
    // Critical alert escalation
    this.addEscalationRule({
      id: 'critical_escalation',
      name: 'Critical Alert Escalation',
      conditions: {
        severity: ['critical'],
        unacknowledgedTimeMs: 300000, // 5 minutes
      },
      actions: {
        channels: ['slack', 'webhook'],
        escalateToChannels: ['pagerduty']
      }
    });

    // Warning alert escalation
    this.addEscalationRule({
      id: 'warning_escalation',
      name: 'Warning Alert Escalation',
      conditions: {
        severity: ['warning'],
        unacknowledgedTimeMs: 900000, // 15 minutes
        repeatCount: 3
      },
      actions: {
        channels: ['slack']
      }
    });
  }

  private determineChannelsForAlert(alertEvent: AlertEvent): string[] {
    const channels = new Set<string>();
    
    // Add default channels
    for (const channelId of this.config.defaultChannels) {
      channels.add(channelId);
    }

    // Add severity-specific channels
    if (alertEvent.severity === 'critical') {
      channels.add('slack');
      channels.add('webhook');
    }

    return Array.from(channels);
  }

  private async sendNotification(notification: AlertNotification): Promise<void> {
    try {
      notification.status = 'pending';
      
      switch (notification.channel.type) {
        case 'console':
          await this.sendConsoleNotification(notification);
          break;
        case 'webhook':
          await this.sendWebhookNotification(notification);
          break;
        case 'slack':
          await this.sendSlackNotification(notification);
          break;
        case 'email':
          await this.sendEmailNotification(notification);
          break;
        default:
          throw new Error(`Unsupported channel type: ${notification.channel.type}`);
      }

      notification.status = 'sent';
      console.log(`Notification sent: ${notification.id}`);
      
    } catch (error) {
      notification.status = 'failed';
      notification.error = error instanceof Error ? error.message : String(error);
      
      console.error(`Notification failed: ${notification.id}`, error);
      
      // Retry if under limit
      if (notification.retryCount < this.config.maxRetries) {
        setTimeout(() => {
          notification.retryCount++;
          this.sendNotification(notification);
        }, this.config.retryDelayMs);
      }
    }
  }

  private async sendConsoleNotification(notification: AlertNotification): Promise<void> {
    const { alertEvent } = notification;
    const severity = alertEvent.severity.toUpperCase();
    
    console.log(`
🚨 ALERT [${severity}] - ${alertEvent.ruleName}
Time: ${new Date(alertEvent.timestamp).toISOString()}
Message: ${alertEvent.message}
Metrics:
  - P95 Latency: ${alertEvent.metrics.currentP95Latency}ms
  - Error Rate: ${alertEvent.metrics.errorRate}%
  - Cache Efficiency: ${alertEvent.metrics.cacheEfficiency}%
  - Memory Usage: ${alertEvent.metrics.memoryUsageMB}MB
    `);
  }

  private async sendWebhookNotification(notification: AlertNotification): Promise<void> {
    const { url, method, headers } = notification.channel.config;
    
    if (!url) {
      throw new Error('Webhook URL not configured');
    }

    const payload = {
      alert: notification.alertEvent,
      timestamp: notification.timestamp,
      source: 'hybrid-retrieval-monitor'
    };

    const response = await fetch(url, {
      method: method || 'POST',
      headers: headers || { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }
  }

  private async sendSlackNotification(notification: AlertNotification): Promise<void> {
    const { webhookUrl, channel, username } = notification.channel.config;
    
    if (!webhookUrl) {
      throw new Error('Slack webhook URL not configured');
    }

    const { alertEvent } = notification;
    const color = alertEvent.severity === 'critical' ? 'danger' : 'warning';
    const emoji = alertEvent.severity === 'critical' ? '🔥' : '⚠️';

    const payload = {
      channel: channel || '#alerts',
      username: username || 'Hybrid Retrieval Monitor',
      attachments: [{
        color,
        title: `${emoji} ${alertEvent.ruleName}`,
        text: alertEvent.message,
        fields: [
          {
            title: 'Severity',
            value: alertEvent.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Time',
            value: new Date(alertEvent.timestamp).toISOString(),
            short: true
          },
          {
            title: 'P95 Latency',
            value: `${alertEvent.metrics.currentP95Latency}ms`,
            short: true
          },
          {
            title: 'Error Rate',
            value: `${alertEvent.metrics.errorRate}%`,
            short: true
          }
        ],
        footer: 'Hybrid Retrieval Monitor',
        ts: Math.floor(alertEvent.timestamp / 1000)
      }]
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.status} ${response.statusText}`);
    }
  }

  private async sendEmailNotification(notification: AlertNotification): Promise<void> {
    // Email implementation would depend on the email service being used
    // This is a placeholder for email notification logic
    console.log('Email notification not implemented yet');
    throw new Error('Email notifications not implemented');
  }

  private scheduleEscalation(alertEvent: AlertEvent, alertKey: string): void {
    const applicableRules = Array.from(this.escalationRules.values())
      .filter(rule => rule.conditions.severity.includes(alertEvent.severity));

    for (const rule of applicableRules) {
      setTimeout(() => {
        // Check if alert is still unacknowledged
        if (!this.acknowledgedAlerts.has(alertKey)) {
          this.escalateAlert(alertEvent, rule, alertKey);
        }
      }, rule.conditions.unacknowledgedTimeMs);
    }
  }

  private async escalateAlert(alertEvent: AlertEvent, rule: EscalationRule, alertKey: string): Promise<void> {
    console.log(`Escalating alert: ${alertEvent.ruleName} (rule: ${rule.name})`);

    const escalationChannels = rule.actions.escalateToChannels || rule.actions.channels;
    
    for (const channelId of escalationChannels) {
      const channel = this.channels.get(channelId);
      if (!channel || !channel.enabled) {
        continue;
      }

      const escalationNotification: AlertNotification = {
        id: `escalation_${alertKey}_${channelId}`,
        alertEvent: {
          ...alertEvent,
          ruleName: `[ESCALATED] ${alertEvent.ruleName}`,
          message: `ESCALATION: ${alertEvent.message} (unacknowledged for ${rule.conditions.unacknowledgedTimeMs / 60000} minutes)`
        },
        channel,
        timestamp: Date.now(),
        status: 'pending',
        retryCount: 0
      };

      await this.sendNotification(escalationNotification);
    }

    this.emit('alert:escalated', { alertEvent, rule, alertKey });
  }
}