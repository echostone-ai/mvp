/**
 * User Engagement Tracking Service
 * Tracks user engagement metrics and conversation quality indicators
 */

export interface EngagementEvent {
  id: string;
  userId: string;
  sessionId: string;
  conversationId: string;
  eventType: EngagementEventType;
  timestamp: Date;
  data: any;
  context: EngagementContext;
}

export type EngagementEventType = 
  | 'message_sent'
  | 'message_received'
  | 'audio_started'
  | 'audio_completed'
  | 'audio_interrupted'
  | 'expression_played'
  | 'user_interaction'
  | 'session_started'
  | 'session_ended'
  | 'conversation_paused'
  | 'conversation_resumed'
  | 'error_occurred'
  | 'quality_feedback';

export interface EngagementContext {
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browserType: string;
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor';
  audioContext: 'active' | 'suspended' | 'interrupted';
  backgroundActivity: boolean;
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface UserEngagementMetrics {
  userId: string;
  sessionId: string;
  conversationId: string;
  
  // Timing metrics
  sessionDuration: number;
  averageResponseTime: number;
  totalPauseTime: number;
  
  // Interaction metrics
  messagesExchanged: number;
  userInitiatedMessages: number;
  averageMessageLength: number;
  
  // Audio metrics
  audioPlaybackTime: number;
  audioInterruptions: number;
  audioCompletionRate: number;
  
  // Expression metrics
  expressionsHeard: number;
  expressionEngagementRate: number;
  
  // Quality metrics
  technicalIssues: number;
  userSatisfactionScore?: number;
  conversationCompletionRate: number;
  
  // Behavioral metrics
  multitaskingDetected: boolean;
  attentionScore: number;
  engagementTrend: 'increasing' | 'decreasing' | 'stable';
  
  calculatedAt: Date;
}

export interface ConversationQualityMetrics {
  conversationId: string;
  
  // Flow metrics
  naturalFlowScore: number;
  topicCoherenceScore: number;
  responseRelevanceScore: number;
  
  // Technical quality
  averageAudioLatency: number;
  audioQualityScore: number;
  expressionTimingAccuracy: number;
  
  // User experience
  userSatisfactionScore: number;
  engagementScore: number;
  conversationCompletionScore: number;
  
  // Memory integration
  memoryRelevanceScore: number;
  contextContinuityScore: number;
  
  calculatedAt: Date;
}

export interface EngagementAlert {
  id: string;
  type: 'low_engagement' | 'technical_issue' | 'quality_degradation' | 'user_frustration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  conversationId: string;
  userId: string;
  triggeredAt: Date;
  resolved: boolean;
  actions: string[];
}

export class UserEngagementTracker {
  private static instance: UserEngagementTracker;
  private events: Map<string, EngagementEvent[]> = new Map();
  private metrics: Map<string, UserEngagementMetrics> = new Map();
  private qualityMetrics: Map<string, ConversationQualityMetrics> = new Map();
  private alerts: Map<string, EngagementAlert[]> = new Map();
  private activeTracking: Map<string, NodeJS.Timeout> = new Map();

  static getInstance(): UserEngagementTracker {
    if (!UserEngagementTracker.instance) {
      UserEngagementTracker.instance = new UserEngagementTracker();
    }
    return UserEngagementTracker.instance;
  }

  /**
   * Start tracking engagement for a conversation
   */
  startTracking(userId: string, sessionId: string, conversationId: string): void {
    const trackingKey = `${userId}_${sessionId}_${conversationId}`;
    
    // Record session start event
    this.recordEvent({
      userId,
      sessionId,
      conversationId,
      eventType: 'session_started',
      data: { startTime: new Date() },
      context: this.getCurrentContext()
    });

    // Set up periodic metric calculation
    const interval = setInterval(() => {
      this.calculateEngagementMetrics(userId, sessionId, conversationId);
      this.checkForAlerts(userId, sessionId, conversationId);
    }, 30000); // Every 30 seconds

    this.activeTracking.set(trackingKey, interval);
  }

  /**
   * Stop tracking engagement for a conversation
   */
  stopTracking(userId: string, sessionId: string, conversationId: string): UserEngagementMetrics {
    const trackingKey = `${userId}_${sessionId}_${conversationId}`;
    
    // Clear interval
    const interval = this.activeTracking.get(trackingKey);
    if (interval) {
      clearInterval(interval);
      this.activeTracking.delete(trackingKey);
    }

    // Record session end event
    this.recordEvent({
      userId,
      sessionId,
      conversationId,
      eventType: 'session_ended',
      data: { endTime: new Date() },
      context: this.getCurrentContext()
    });

    // Calculate final metrics
    return this.calculateEngagementMetrics(userId, sessionId, conversationId);
  }

  /**
   * Record an engagement event
   */
  recordEvent(eventData: Omit<EngagementEvent, 'id' | 'timestamp'>): void {
    const event: EngagementEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...eventData
    };

    const key = `${eventData.userId}_${eventData.sessionId}_${eventData.conversationId}`;
    if (!this.events.has(key)) {
      this.events.set(key, []);
    }
    
    this.events.get(key)!.push(event);
    
    // Keep only last 1000 events per conversation for memory management
    const events = this.events.get(key)!;
    if (events.length > 1000) {
      events.splice(0, events.length - 1000);
    }

    // Trigger real-time analysis for critical events
    if (this.isCriticalEvent(event)) {
      this.handleCriticalEvent(event);
    }
  }

  /**
   * Calculate engagement metrics for a conversation
   */
  calculateEngagementMetrics(userId: string, sessionId: string, conversationId: string): UserEngagementMetrics {
    const key = `${userId}_${sessionId}_${conversationId}`;
    const events = this.events.get(key) || [];
    
    if (events.length === 0) {
      return this.getEmptyEngagementMetrics(userId, sessionId, conversationId);
    }

    const sessionStart = events.find(e => e.eventType === 'session_started')?.timestamp || events[0].timestamp;
    const sessionEnd = events.find(e => e.eventType === 'session_ended')?.timestamp || new Date();
    
    const metrics: UserEngagementMetrics = {
      userId,
      sessionId,
      conversationId,
      
      // Timing metrics
      sessionDuration: sessionEnd.getTime() - sessionStart.getTime(),
      averageResponseTime: this.calculateAverageResponseTime(events),
      totalPauseTime: this.calculateTotalPauseTime(events),
      
      // Interaction metrics
      messagesExchanged: events.filter(e => e.eventType === 'message_sent' || e.eventType === 'message_received').length,
      userInitiatedMessages: events.filter(e => e.eventType === 'message_sent').length,
      averageMessageLength: this.calculateAverageMessageLength(events),
      
      // Audio metrics
      audioPlaybackTime: this.calculateAudioPlaybackTime(events),
      audioInterruptions: events.filter(e => e.eventType === 'audio_interrupted').length,
      audioCompletionRate: this.calculateAudioCompletionRate(events),
      
      // Expression metrics
      expressionsHeard: events.filter(e => e.eventType === 'expression_played').length,
      expressionEngagementRate: this.calculateExpressionEngagementRate(events),
      
      // Quality metrics
      technicalIssues: events.filter(e => e.eventType === 'error_occurred').length,
      userSatisfactionScore: this.calculateUserSatisfactionScore(events),
      conversationCompletionRate: this.calculateConversationCompletionRate(events),
      
      // Behavioral metrics
      multitaskingDetected: this.detectMultitasking(events),
      attentionScore: this.calculateAttentionScore(events),
      engagementTrend: this.calculateEngagementTrend(events),
      
      calculatedAt: new Date()
    };

    this.metrics.set(key, metrics);
    return metrics;
  }

  /**
   * Calculate conversation quality metrics
   */
  calculateQualityMetrics(conversationId: string): ConversationQualityMetrics {
    // Find all events for this conversation across all users/sessions
    const allEvents: EngagementEvent[] = [];
    for (const [key, events] of this.events.entries()) {
      if (key.includes(conversationId)) {
        allEvents.push(...events);
      }
    }

    const metrics: ConversationQualityMetrics = {
      conversationId,
      
      // Flow metrics
      naturalFlowScore: this.calculateNaturalFlowScore(allEvents),
      topicCoherenceScore: this.calculateTopicCoherenceScore(allEvents),
      responseRelevanceScore: this.calculateResponseRelevanceScore(allEvents),
      
      // Technical quality
      averageAudioLatency: this.calculateAverageAudioLatency(allEvents),
      audioQualityScore: this.calculateAudioQualityScore(allEvents),
      expressionTimingAccuracy: this.calculateExpressionTimingAccuracy(allEvents),
      
      // User experience
      userSatisfactionScore: this.calculateOverallSatisfactionScore(allEvents),
      engagementScore: this.calculateOverallEngagementScore(allEvents),
      conversationCompletionScore: this.calculateOverallCompletionScore(allEvents),
      
      // Memory integration
      memoryRelevanceScore: this.calculateMemoryRelevanceScore(allEvents),
      contextContinuityScore: this.calculateContextContinuityScore(allEvents),
      
      calculatedAt: new Date()
    };

    this.qualityMetrics.set(conversationId, metrics);
    return metrics;
  }

  /**
   * Get engagement metrics for a conversation
   */
  getEngagementMetrics(userId: string, sessionId: string, conversationId: string): UserEngagementMetrics | null {
    const key = `${userId}_${sessionId}_${conversationId}`;
    return this.metrics.get(key) || null;
  }

  /**
   * Get quality metrics for a conversation
   */
  getQualityMetrics(conversationId: string): ConversationQualityMetrics | null {
    return this.qualityMetrics.get(conversationId) || null;
  }

  /**
   * Get alerts for a conversation
   */
  getAlerts(conversationId: string): EngagementAlert[] {
    return this.alerts.get(conversationId) || [];
  }

  /**
   * Private helper methods
   */
  private getCurrentContext(): EngagementContext {
    return {
      deviceType: this.detectDeviceType(),
      browserType: this.detectBrowserType(),
      networkQuality: this.detectNetworkQuality(),
      audioContext: 'active', // Would detect actual audio context state
      backgroundActivity: this.detectBackgroundActivity(),
      timeOfDay: this.getTimeOfDay()
    };
  }

  private detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent;
      if (/tablet|ipad/i.test(userAgent)) return 'tablet';
      if (/mobile|android|iphone/i.test(userAgent)) return 'mobile';
    }
    return 'desktop';
  }

  private detectBrowserType(): string {
    if (typeof window !== 'undefined') {
      const userAgent = window.navigator.userAgent;
      if (userAgent.includes('Chrome')) return 'Chrome';
      if (userAgent.includes('Firefox')) return 'Firefox';
      if (userAgent.includes('Safari')) return 'Safari';
      if (userAgent.includes('Edge')) return 'Edge';
    }
    return 'Unknown';
  }

  private detectNetworkQuality(): 'excellent' | 'good' | 'fair' | 'poor' {
    // Would use Network Information API if available
    return 'good'; // Default assumption
  }

  private detectBackgroundActivity(): boolean {
    if (typeof document !== 'undefined') {
      return document.hidden || false;
    }
    return false;
  }

  private getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 17) return 'afternoon';
    if (hour >= 17 && hour < 21) return 'evening';
    return 'night';
  }

  private isCriticalEvent(event: EngagementEvent): boolean {
    return ['error_occurred', 'audio_interrupted', 'session_ended'].includes(event.eventType);
  }

  private handleCriticalEvent(event: EngagementEvent): void {
    // Handle critical events that might require immediate attention
    if (event.eventType === 'error_occurred') {
      this.createAlert({
        type: 'technical_issue',
        severity: 'high',
        message: 'Technical error detected during conversation',
        conversationId: event.conversationId,
        userId: event.userId,
        actions: ['Check system logs', 'Verify audio configuration', 'Test fallback systems']
      });
    }
  }

  private createAlert(alertData: Omit<EngagementAlert, 'id' | 'triggeredAt' | 'resolved'>): void {
    const alert: EngagementAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      triggeredAt: new Date(),
      resolved: false,
      ...alertData
    };

    if (!this.alerts.has(alertData.conversationId)) {
      this.alerts.set(alertData.conversationId, []);
    }
    
    this.alerts.get(alertData.conversationId)!.push(alert);
  }

  private checkForAlerts(userId: string, sessionId: string, conversationId: string): void {
    const metrics = this.getEngagementMetrics(userId, sessionId, conversationId);
    if (!metrics) return;

    // Check for low engagement
    if (metrics.attentionScore < 0.3) {
      this.createAlert({
        type: 'low_engagement',
        severity: 'medium',
        message: 'User engagement is below optimal levels',
        conversationId,
        userId,
        actions: ['Adjust conversation pace', 'Increase expression usage', 'Check audio quality']
      });
    }

    // Check for technical issues
    if (metrics.technicalIssues > 3) {
      this.createAlert({
        type: 'technical_issue',
        severity: 'high',
        message: 'Multiple technical issues detected',
        conversationId,
        userId,
        actions: ['Review system logs', 'Check network connectivity', 'Verify audio configuration']
      });
    }
  }

  // Calculation helper methods (simplified implementations)
  private calculateAverageResponseTime(events: EngagementEvent[]): number {
    const responseTimes: number[] = [];
    let lastUserMessage: Date | null = null;

    for (const event of events) {
      if (event.eventType === 'message_sent') {
        lastUserMessage = event.timestamp;
      } else if (event.eventType === 'message_received' && lastUserMessage) {
        responseTimes.push(event.timestamp.getTime() - lastUserMessage.getTime());
        lastUserMessage = null;
      }
    }

    return responseTimes.length > 0 
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;
  }

  private calculateTotalPauseTime(events: EngagementEvent[]): number {
    // Calculate time between conversation_paused and conversation_resumed events
    let totalPause = 0;
    let pauseStart: Date | null = null;

    for (const event of events) {
      if (event.eventType === 'conversation_paused') {
        pauseStart = event.timestamp;
      } else if (event.eventType === 'conversation_resumed' && pauseStart) {
        totalPause += event.timestamp.getTime() - pauseStart.getTime();
        pauseStart = null;
      }
    }

    return totalPause;
  }

  private calculateAverageMessageLength(events: EngagementEvent[]): number {
    const messageLengths = events
      .filter(e => e.eventType === 'message_sent' && e.data?.message)
      .map(e => e.data.message.length);

    return messageLengths.length > 0
      ? messageLengths.reduce((sum, length) => sum + length, 0) / messageLengths.length
      : 0;
  }

  private calculateAudioPlaybackTime(events: EngagementEvent[]): number {
    let totalPlayback = 0;
    let playbackStart: Date | null = null;

    for (const event of events) {
      if (event.eventType === 'audio_started') {
        playbackStart = event.timestamp;
      } else if ((event.eventType === 'audio_completed' || event.eventType === 'audio_interrupted') && playbackStart) {
        totalPlayback += event.timestamp.getTime() - playbackStart.getTime();
        playbackStart = null;
      }
    }

    return totalPlayback;
  }

  private calculateAudioCompletionRate(events: EngagementEvent[]): number {
    const audioStarted = events.filter(e => e.eventType === 'audio_started').length;
    const audioCompleted = events.filter(e => e.eventType === 'audio_completed').length;
    
    return audioStarted > 0 ? audioCompleted / audioStarted : 0;
  }

  private calculateExpressionEngagementRate(events: EngagementEvent[]): number {
    // Simplified: assume expressions are engaging if not interrupted
    const expressionsPlayed = events.filter(e => e.eventType === 'expression_played').length;
    const audioInterruptions = events.filter(e => e.eventType === 'audio_interrupted').length;
    
    return expressionsPlayed > 0 ? Math.max(0, 1 - (audioInterruptions / expressionsPlayed)) : 0;
  }

  private calculateUserSatisfactionScore(events: EngagementEvent[]): number | undefined {
    const feedbackEvents = events.filter(e => e.eventType === 'quality_feedback');
    if (feedbackEvents.length === 0) return undefined;

    const scores = feedbackEvents.map(e => e.data?.score || 0.5);
    return scores.reduce((sum, score) => sum + score, 0) / scores.length;
  }

  private calculateConversationCompletionRate(events: EngagementEvent[]): number {
    const hasSessionEnd = events.some(e => e.eventType === 'session_ended');
    const sessionDuration = this.calculateSessionDuration(events);
    
    // Consider conversation "completed" if it lasted more than 2 minutes and ended normally
    return hasSessionEnd && sessionDuration > 120000 ? 1 : 0;
  }

  private calculateSessionDuration(events: EngagementEvent[]): number {
    const start = events.find(e => e.eventType === 'session_started')?.timestamp || events[0]?.timestamp;
    const end = events.find(e => e.eventType === 'session_ended')?.timestamp || new Date();
    
    return start ? end.getTime() - start.getTime() : 0;
  }

  private detectMultitasking(events: EngagementEvent[]): boolean {
    // Detect if user is multitasking based on response patterns and context
    const backgroundEvents = events.filter(e => e.context?.backgroundActivity).length;
    return backgroundEvents > events.length * 0.3; // More than 30% background activity
  }

  private calculateAttentionScore(events: EngagementEvent[]): number {
    // Calculate attention based on response times, interruptions, and background activity
    const avgResponseTime = this.calculateAverageResponseTime(events);
    const interruptions = events.filter(e => e.eventType === 'audio_interrupted').length;
    const backgroundActivity = this.detectMultitasking(events);
    
    let score = 1.0;
    
    // Penalize slow responses
    if (avgResponseTime > 10000) score -= 0.3;
    else if (avgResponseTime > 5000) score -= 0.1;
    
    // Penalize interruptions
    score -= Math.min(interruptions * 0.1, 0.4);
    
    // Penalize background activity
    if (backgroundActivity) score -= 0.2;
    
    return Math.max(0, score);
  }

  private calculateEngagementTrend(events: EngagementEvent[]): 'increasing' | 'decreasing' | 'stable' {
    // Analyze engagement over time (simplified)
    if (events.length < 10) return 'stable';
    
    const firstHalf = events.slice(0, Math.floor(events.length / 2));
    const secondHalf = events.slice(Math.floor(events.length / 2));
    
    const firstHalfEngagement = this.calculateSegmentEngagement(firstHalf);
    const secondHalfEngagement = this.calculateSegmentEngagement(secondHalf);
    
    const difference = secondHalfEngagement - firstHalfEngagement;
    
    if (difference > 0.1) return 'increasing';
    if (difference < -0.1) return 'decreasing';
    return 'stable';
  }

  private calculateSegmentEngagement(events: EngagementEvent[]): number {
    // Simplified engagement calculation for a segment of events
    const messageEvents = events.filter(e => e.eventType === 'message_sent').length;
    const interactionEvents = events.filter(e => e.eventType === 'user_interaction').length;
    const totalEvents = events.length;
    
    return totalEvents > 0 ? (messageEvents + interactionEvents) / totalEvents : 0;
  }

  // Additional quality metric calculations (simplified implementations)
  private calculateNaturalFlowScore(events: EngagementEvent[]): number { return 0.8; }
  private calculateTopicCoherenceScore(events: EngagementEvent[]): number { return 0.7; }
  private calculateResponseRelevanceScore(events: EngagementEvent[]): number { return 0.85; }
  private calculateAverageAudioLatency(events: EngagementEvent[]): number { return 800; }
  private calculateAudioQualityScore(events: EngagementEvent[]): number { return 0.9; }
  private calculateExpressionTimingAccuracy(events: EngagementEvent[]): number { return 0.75; }
  private calculateOverallSatisfactionScore(events: EngagementEvent[]): number { return 0.8; }
  private calculateOverallEngagementScore(events: EngagementEvent[]): number { return 0.75; }
  private calculateOverallCompletionScore(events: EngagementEvent[]): number { return 0.85; }
  private calculateMemoryRelevanceScore(events: EngagementEvent[]): number { return 0.7; }
  private calculateContextContinuityScore(events: EngagementEvent[]): number { return 0.8; }

  private getEmptyEngagementMetrics(userId: string, sessionId: string, conversationId: string): UserEngagementMetrics {
    return {
      userId,
      sessionId,
      conversationId,
      sessionDuration: 0,
      averageResponseTime: 0,
      totalPauseTime: 0,
      messagesExchanged: 0,
      userInitiatedMessages: 0,
      averageMessageLength: 0,
      audioPlaybackTime: 0,
      audioInterruptions: 0,
      audioCompletionRate: 0,
      expressionsHeard: 0,
      expressionEngagementRate: 0,
      technicalIssues: 0,
      conversationCompletionRate: 0,
      multitaskingDetected: false,
      attentionScore: 1.0,
      engagementTrend: 'stable',
      calculatedAt: new Date()
    };
  }
}