/**
 * Conversation Export and Sharing Service
 * Enables users to export conversations and share insights
 */

export interface ConversationExport {
  id: string;
  conversationId: string;
  userId: string;
  exportType: 'full' | 'summary' | 'analytics' | 'audio_transcript';
  format: 'json' | 'csv' | 'pdf' | 'txt' | 'html';
  createdAt: Date;
  expiresAt?: Date;
  downloadUrl?: string;
  shareUrl?: string;
  isPublic: boolean;
  metadata: ExportMetadata;
}

export interface ExportMetadata {
  conversationLength: number;
  dateRange: [Date, Date];
  participantCount: number;
  totalAudioDuration: number;
  expressionsUsed: number;
  memoryFragmentsReferenced: number;
  qualityScore: number;
  topics: string[];
}

export interface ShareableConversation {
  id: string;
  conversationId: string;
  title: string;
  description: string;
  anonymizedTranscript: ConversationTurn[];
  analytics: ConversationAnalytics;
  insights: ConversationInsight[];
  createdAt: Date;
  sharedBy: string;
  viewCount: number;
  isPublic: boolean;
}

export interface ConversationTurn {
  turnNumber: number;
  speaker: 'user' | 'assistant';
  message: string;
  timestamp: Date;
  audioLatency?: number;
  expressionsUsed?: string[];
  confidence?: number;
}

export interface ConversationAnalytics {
  totalTurns: number;
  averageResponseTime: number;
  averageAudioLatency: number;
  expressionUsageRate: number;
  engagementScore: number;
  topicDiversity: number;
  conversationFlow: FlowMetric[];
}

export interface FlowMetric {
  turnNumber: number;
  responseTime: number;
  engagementLevel: number;
  topicCoherence: number;
}

export interface ConversationInsight {
  type: 'performance' | 'engagement' | 'technical' | 'content';
  title: string;
  description: string;
  value: string | number;
  trend: 'improving' | 'declining' | 'stable';
  importance: 'high' | 'medium' | 'low';
}

export interface ExportOptions {
  includeAudio: boolean;
  includeAnalytics: boolean;
  includePersonalData: boolean;
  anonymize: boolean;
  dateRange?: [Date, Date];
  format: 'json' | 'csv' | 'pdf' | 'txt' | 'html';
  compression?: 'none' | 'zip' | 'gzip';
}

export interface ShareOptions {
  isPublic: boolean;
  allowComments: boolean;
  expiresIn?: number; // days
  password?: string;
  anonymize: boolean;
  includeAnalytics: boolean;
}

export class ConversationExportService {
  private static instance: ConversationExportService;
  private exports: Map<string, ConversationExport> = new Map();
  private sharedConversations: Map<string, ShareableConversation> = new Map();

  static getInstance(): ConversationExportService {
    if (!ConversationExportService.instance) {
      ConversationExportService.instance = new ConversationExportService();
    }
    return ConversationExportService.instance;
  }

  /**
   * Export conversation data
   */
  async exportConversation(
    conversationId: string,
    userId: string,
    options: ExportOptions
  ): Promise<ConversationExport> {
    const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get conversation data (would typically come from database)
    const conversationData = await this.getConversationData(conversationId);
    
    // Process data based on options
    const processedData = await this.processConversationData(conversationData, options);
    
    // Generate export file
    const exportFile = await this.generateExportFile(processedData, options.format);
    
    // Create export record
    const exportRecord: ConversationExport = {
      id: exportId,
      conversationId,
      userId,
      exportType: this.determineExportType(options),
      format: options.format,
      createdAt: new Date(),
      expiresAt: options.compression ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : undefined, // 7 days
      downloadUrl: `/api/exports/${exportId}/download`,
      isPublic: false,
      metadata: this.generateExportMetadata(conversationData)
    };

    this.exports.set(exportId, exportRecord);
    
    // Store export file (in real implementation, would use cloud storage)
    await this.storeExportFile(exportId, exportFile);
    
    return exportRecord;
  }

  /**
   * Share conversation with analytics
   */
  async shareConversation(
    conversationId: string,
    userId: string,
    options: ShareOptions
  ): Promise<ShareableConversation> {
    const shareId = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get conversation data
    const conversationData = await this.getConversationData(conversationId);
    
    // Anonymize if requested
    const processedTranscript = options.anonymize 
      ? this.anonymizeConversation(conversationData.turns)
      : conversationData.turns;
    
    // Generate analytics
    const analytics = this.generateConversationAnalytics(conversationData);
    
    // Generate insights
    const insights = this.generateConversationInsights(conversationData, analytics);
    
    const sharedConversation: ShareableConversation = {
      id: shareId,
      conversationId: conversationId,
      title: this.generateConversationTitle(conversationData),
      description: this.generateConversationDescription(conversationData),
      anonymizedTranscript: processedTranscript,
      analytics: options.includeAnalytics ? analytics : this.getEmptyAnalytics(),
      insights,
      createdAt: new Date(),
      sharedBy: options.anonymize ? 'Anonymous' : userId,
      viewCount: 0,
      isPublic: options.isPublic
    };

    this.sharedConversations.set(shareId, sharedConversation);
    
    return sharedConversation;
  }

  /**
   * Get shared conversation
   */
  getSharedConversation(shareId: string): ShareableConversation | null {
    const shared = this.sharedConversations.get(shareId);
    if (shared) {
      shared.viewCount++;
    }
    return shared || null;
  }

  /**
   * Generate conversation summary
   */
  generateConversationSummary(conversationId: string): ConversationSummary {
    // This would integrate with the conversation analytics service
    return {
      id: conversationId,
      totalTurns: 0,
      duration: 0,
      keyTopics: [],
      highlights: [],
      qualityScore: 0,
      recommendations: []
    };
  }

  /**
   * Export conversation as JSON
   */
  private async generateJSONExport(data: any): Promise<string> {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Export conversation as CSV
   */
  private async generateCSVExport(data: any): Promise<string> {
    const turns = data.turns || [];
    const headers = ['Turn', 'Speaker', 'Message', 'Timestamp', 'Audio Latency', 'Expressions Used'];
    
    let csv = headers.join(',') + '\n';
    
    turns.forEach((turn: ConversationTurn, index: number) => {
      const row = [
        index + 1,
        turn.speaker,
        `"${turn.message.replace(/"/g, '""')}"`, // Escape quotes
        turn.timestamp.toISOString(),
        turn.audioLatency || '',
        turn.expressionsUsed?.join(';') || ''
      ];
      csv += row.join(',') + '\n';
    });
    
    return csv;
  }

  /**
   * Export conversation as HTML
   */
  private async generateHTMLExport(data: any): Promise<string> {
    const turns = data.turns || [];
    const analytics = data.analytics || {};
    
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Conversation Export</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #ccc; padding-bottom: 10px; margin-bottom: 20px; }
        .turn { margin-bottom: 15px; padding: 10px; border-radius: 5px; }
        .user { background-color: #e3f2fd; }
        .assistant { background-color: #f3e5f5; }
        .speaker { font-weight: bold; margin-bottom: 5px; }
        .message { margin-bottom: 5px; }
        .metadata { font-size: 0.8em; color: #666; }
        .analytics { margin-top: 30px; padding: 15px; background-color: #f5f5f5; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Conversation Export</h1>
        <p>Generated on: ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="conversation">
`;

    turns.forEach((turn: ConversationTurn) => {
      html += `
        <div class="turn ${turn.speaker}">
            <div class="speaker">${turn.speaker === 'user' ? 'User' : 'Assistant'}</div>
            <div class="message">${turn.message}</div>
            <div class="metadata">
                ${turn.timestamp.toLocaleString()}
                ${turn.audioLatency ? ` | Latency: ${turn.audioLatency}ms` : ''}
                ${turn.expressionsUsed?.length ? ` | Expressions: ${turn.expressionsUsed.join(', ')}` : ''}
            </div>
        </div>
`;
    });

    html += `
    </div>
    
    <div class="analytics">
        <h2>Analytics Summary</h2>
        <p><strong>Total Turns:</strong> ${analytics.totalTurns || 0}</p>
        <p><strong>Average Response Time:</strong> ${analytics.averageResponseTime || 0}ms</p>
        <p><strong>Average Audio Latency:</strong> ${analytics.averageAudioLatency || 0}ms</p>
        <p><strong>Engagement Score:</strong> ${(analytics.engagementScore || 0).toFixed(2)}</p>
        <p><strong>Expression Usage Rate:</strong> ${((analytics.expressionUsageRate || 0) * 100).toFixed(1)}%</p>
    </div>
</body>
</html>
`;

    return html;
  }

  /**
   * Export conversation as plain text
   */
  private async generateTextExport(data: any): Promise<string> {
    const turns = data.turns || [];
    let text = `Conversation Export\nGenerated: ${new Date().toLocaleString()}\n\n`;
    
    turns.forEach((turn: ConversationTurn, index: number) => {
      text += `[${index + 1}] ${turn.speaker.toUpperCase()}: ${turn.message}\n`;
      text += `    Time: ${turn.timestamp.toLocaleString()}`;
      if (turn.audioLatency) text += ` | Latency: ${turn.audioLatency}ms`;
      if (turn.expressionsUsed?.length) text += ` | Expressions: ${turn.expressionsUsed.join(', ')}`;
      text += '\n\n';
    });
    
    return text;
  }

  /**
   * Private helper methods
   */
  private async getConversationData(conversationId: string): Promise<any> {
    // In real implementation, this would fetch from database
    // For now, return mock data
    return {
      id: conversationId,
      turns: [],
      metadata: {},
      analytics: {}
    };
  }

  private async processConversationData(data: any, options: ExportOptions): Promise<any> {
    let processedData = { ...data };
    
    if (options.anonymize) {
      processedData.turns = this.anonymizeConversation(data.turns);
    }
    
    if (options.dateRange) {
      processedData.turns = data.turns.filter((turn: ConversationTurn) => {
        const turnDate = new Date(turn.timestamp);
        return turnDate >= options.dateRange![0] && turnDate <= options.dateRange![1];
      });
    }
    
    if (!options.includePersonalData) {
      processedData = this.removePersonalData(processedData);
    }
    
    return processedData;
  }

  private async generateExportFile(data: any, format: string): Promise<string> {
    switch (format) {
      case 'json':
        return this.generateJSONExport(data);
      case 'csv':
        return this.generateCSVExport(data);
      case 'html':
        return this.generateHTMLExport(data);
      case 'txt':
        return this.generateTextExport(data);
      default:
        return this.generateJSONExport(data);
    }
  }

  private determineExportType(options: ExportOptions): 'full' | 'summary' | 'analytics' | 'audio_transcript' {
    if (options.includeAudio) return 'audio_transcript';
    if (options.includeAnalytics && !options.includePersonalData) return 'analytics';
    if (!options.includePersonalData) return 'summary';
    return 'full';
  }

  private generateExportMetadata(data: any): ExportMetadata {
    const turns = data.turns || [];
    return {
      conversationLength: turns.length,
      dateRange: turns.length > 0 ? [turns[0].timestamp, turns[turns.length - 1].timestamp] : [new Date(), new Date()],
      participantCount: 2, // User and assistant
      totalAudioDuration: 0, // Would calculate from audio data
      expressionsUsed: turns.reduce((sum: number, turn: ConversationTurn) => sum + (turn.expressionsUsed?.length || 0), 0),
      memoryFragmentsReferenced: 0, // Would calculate from memory data
      qualityScore: 0.8, // Would calculate from analytics
      topics: [] // Would extract from conversation analysis
    };
  }

  private async storeExportFile(exportId: string, content: string): Promise<void> {
    // In real implementation, would store in cloud storage
    // For now, just keep in memory (not recommended for production)
    console.log(`Storing export ${exportId} with ${content.length} characters`);
  }

  private anonymizeConversation(turns: ConversationTurn[]): ConversationTurn[] {
    return turns.map(turn => ({
      ...turn,
      message: this.anonymizeText(turn.message)
    }));
  }

  private anonymizeText(text: string): string {
    // Simple anonymization - replace names, emails, phone numbers, etc.
    return text
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[NAME]') // Names
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]') // Emails
      .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]') // Phone numbers
      .replace(/\b\d{1,5}\s+\w+\s+(Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln)\b/gi, '[ADDRESS]'); // Addresses
  }

  private removePersonalData(data: any): any {
    // Remove or anonymize personal data fields
    const cleaned = { ...data };
    delete cleaned.userId;
    delete cleaned.personalInfo;
    return cleaned;
  }

  private generateConversationAnalytics(data: any): ConversationAnalytics {
    const turns = data.turns || [];
    return {
      totalTurns: turns.length,
      averageResponseTime: 0, // Would calculate from actual data
      averageAudioLatency: 0, // Would calculate from actual data
      expressionUsageRate: 0, // Would calculate from actual data
      engagementScore: 0.8, // Would calculate from actual data
      topicDiversity: 0.6, // Would calculate from actual data
      conversationFlow: [] // Would generate from actual data
    };
  }

  private generateConversationInsights(data: any, analytics: ConversationAnalytics): ConversationInsight[] {
    const insights: ConversationInsight[] = [];
    
    // Performance insights
    if (analytics.averageAudioLatency > 1000) {
      insights.push({
        type: 'performance',
        title: 'High Audio Latency',
        description: 'Audio responses are taking longer than optimal',
        value: `${analytics.averageAudioLatency}ms`,
        trend: 'declining',
        importance: 'high'
      });
    }
    
    // Engagement insights
    if (analytics.engagementScore > 0.8) {
      insights.push({
        type: 'engagement',
        title: 'High User Engagement',
        description: 'User is highly engaged in the conversation',
        value: analytics.engagementScore.toFixed(2),
        trend: 'improving',
        importance: 'medium'
      });
    }
    
    return insights;
  }

  private generateConversationTitle(data: any): string {
    const turns = data.turns || [];
    if (turns.length === 0) return 'Empty Conversation';
    
    // Extract key topics or use first user message
    const firstUserMessage = turns.find((turn: ConversationTurn) => turn.speaker === 'user')?.message || '';
    return firstUserMessage.length > 50 
      ? firstUserMessage.substring(0, 47) + '...'
      : firstUserMessage || 'Conversation';
  }

  private generateConversationDescription(data: any): string {
    const turns = data.turns || [];
    return `Conversation with ${turns.length} turns, generated on ${new Date().toLocaleDateString()}`;
  }

  private getEmptyAnalytics(): ConversationAnalytics {
    return {
      totalTurns: 0,
      averageResponseTime: 0,
      averageAudioLatency: 0,
      expressionUsageRate: 0,
      engagementScore: 0,
      topicDiversity: 0,
      conversationFlow: []
    };
  }
}

export interface ConversationSummary {
  id: string;
  totalTurns: number;
  duration: number;
  keyTopics: string[];
  highlights: string[];
  qualityScore: number;
  recommendations: string[];
}