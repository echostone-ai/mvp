/**
 * Server-side Audio Analyzer
 * Provides basic audio analysis without browser APIs for use in API routes
 */

export interface ServerAudioAnalysis {
  quality_score: number
  file_size: number
  format: string
  estimated_duration: number
  recommendations: string[]
  issues: string[]
  enhancement_suggestions: string[]
}

export interface ServerAudioEnhancement {
  noise_reduction: boolean
  volume_normalization: boolean
  clarity_enhancement: boolean
  format_optimization: boolean
}

export class ServerAudioAnalyzer {
  private readonly MIN_FILE_SIZE = 50000 // 50KB
  private readonly MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB
  private readonly OPTIMAL_FILE_SIZE_MIN = 500000 // 500KB
  private readonly OPTIMAL_FILE_SIZE_MAX = 10 * 1024 * 1024 // 10MB

  /**
   * Analyze audio file quality based on file metadata and heuristics
   */
  async analyzeAudioFile(file: File): Promise<ServerAudioAnalysis> {
    const fileSize = file.size
    const format = file.type
    const estimatedDuration = this.estimateDurationFromFileSize(file)
    
    // Calculate quality score based on file characteristics
    const qualityScore = this.calculateQualityScore(file)
    
    // Generate recommendations and issues
    const recommendations = this.generateRecommendations(file, estimatedDuration)
    const issues = this.identifyIssues(file, estimatedDuration)
    const enhancementSuggestions = this.generateEnhancementSuggestions(file)

    return {
      quality_score: qualityScore,
      file_size: fileSize,
      format,
      estimated_duration: estimatedDuration,
      recommendations,
      issues,
      enhancement_suggestions: enhancementSuggestions
    }
  }

  /**
   * Calculate quality score based on file characteristics (0-10)
   */
  private calculateQualityScore(file: File): number {
    let score = 7 // Start with neutral-good score

    const fileSize = file.size
    const estimatedDuration = this.estimateDurationFromFileSize(file)
    
    // File size scoring
    if (fileSize < this.MIN_FILE_SIZE) {
      score -= 3
    } else if (fileSize < this.OPTIMAL_FILE_SIZE_MIN) {
      score -= 1
    } else if (fileSize > this.MAX_FILE_SIZE) {
      score -= 2
    } else if (fileSize > this.OPTIMAL_FILE_SIZE_MAX) {
      score -= 0.5
    }

    // Duration scoring (estimated)
    if (estimatedDuration < 10) {
      score -= 2
    } else if (estimatedDuration < 30) {
      score -= 1
    } else if (estimatedDuration > 300) {
      score -= 1.5
    } else if (estimatedDuration > 120) {
      score -= 0.5
    }

    // Format scoring
    const highQualityFormats = ['audio/wav', 'audio/flac']
    const goodFormats = ['audio/m4a', 'audio/mp3', 'audio/mpeg']
    
    if (highQualityFormats.includes(file.type)) {
      score += 0.5
    } else if (!goodFormats.includes(file.type)) {
      score -= 1
    }

    // Bitrate estimation (rough)
    const estimatedBitrate = (fileSize * 8) / estimatedDuration / 1000 // kbps
    if (estimatedBitrate < 64) {
      score -= 2
    } else if (estimatedBitrate < 128) {
      score -= 1
    } else if (estimatedBitrate > 320) {
      score += 0.5
    }

    return Math.max(0, Math.min(10, score))
  }

  /**
   * Estimate duration from file size (rough approximation)
   */
  private estimateDurationFromFileSize(file: File): number {
    // Estimation based on common bitrates for different formats
    let estimatedBitrate = 128000 // Default 128kbps

    if (file.type === 'audio/wav' || file.type === 'audio/flac') {
      estimatedBitrate = 1411000 // CD quality
    } else if (file.type === 'audio/m4a') {
      estimatedBitrate = 256000 // Higher quality AAC
    } else if (file.type === 'audio/mp3' || file.type === 'audio/mpeg') {
      estimatedBitrate = 192000 // Good quality MP3
    }

    const bytesPerSecond = estimatedBitrate / 8
    return file.size / bytesPerSecond
  }

  /**
   * Generate quality improvement recommendations
   */
  private generateRecommendations(file: File, estimatedDuration: number): string[] {
    const recommendations: string[] = []

    if (estimatedDuration < 10) {
      recommendations.push(`Recording is too short (~${estimatedDuration.toFixed(1)}s). Aim for at least 30 seconds.`)
    }

    if (estimatedDuration > 300) {
      recommendations.push(`Recording is very long (~${estimatedDuration.toFixed(1)}s). Consider splitting into shorter segments.`)
    }

    if (file.size < this.OPTIMAL_FILE_SIZE_MIN) {
      recommendations.push('File size suggests low quality. Use higher bitrate settings.')
    }

    const estimatedBitrate = (file.size * 8) / estimatedDuration / 1000
    if (estimatedBitrate < 128) {
      recommendations.push(`Low bitrate detected (~${estimatedBitrate.toFixed(0)}kbps). Use at least 128kbps for better quality.`)
    }

    if (file.type === 'audio/wav' || file.type === 'audio/flac') {
      recommendations.push('Excellent format choice for voice training!')
    } else if (file.type === 'audio/m4a') {
      recommendations.push('Good format choice. M4A provides good quality-to-size ratio.')
    }

    if (recommendations.length === 0) {
      recommendations.push('File characteristics look good for voice training.')
    }

    return recommendations
  }

  /**
   * Identify potential issues with the audio file
   */
  private identifyIssues(file: File, estimatedDuration: number): string[] {
    const issues: string[] = []

    // Critical file size issues
    if (file.size < this.MIN_FILE_SIZE) {
      issues.push('File is too small - may be corrupted or empty')
    }

    if (file.size > this.MAX_FILE_SIZE) {
      issues.push('File exceeds maximum size limit (25MB)')
    }

    // Duration issues
    if (estimatedDuration < 5) {
      issues.push('Recording is too short for effective voice training')
    }

    if (estimatedDuration > 600) {
      issues.push('Recording is extremely long - may cause processing issues')
    }

    // Format issues
    const supportedFormats = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/m4a', 'audio/flac']
    if (!supportedFormats.includes(file.type)) {
      issues.push(`Unsupported format: ${file.type}. Use WAV, MP3, M4A, or FLAC.`)
    }

    // Quality concerns based on file size vs duration
    const estimatedBitrate = (file.size * 8) / estimatedDuration / 1000
    if (estimatedBitrate < 32) {
      issues.push('Extremely low bitrate - audio quality may be insufficient')
    }

    return issues
  }

  /**
   * Generate enhancement suggestions
   */
  private generateEnhancementSuggestions(file: File): string[] {
    const suggestions: string[] = []
    const estimatedDuration = this.estimateDurationFromFileSize(file)
    const estimatedBitrate = (file.size * 8) / estimatedDuration / 1000

    if (estimatedBitrate < 128) {
      suggestions.push('Apply noise reduction to compensate for low bitrate compression artifacts')
    }

    if (file.size < this.OPTIMAL_FILE_SIZE_MIN) {
      suggestions.push('Enhance audio clarity and volume normalization')
    }

    if (file.type === 'audio/mp3' || file.type === 'audio/mpeg') {
      suggestions.push('Apply format optimization to reduce compression artifacts')
    }

    if (estimatedDuration > 120) {
      suggestions.push('Consider trimming silence and optimizing content density')
    }

    if (suggestions.length === 0) {
      suggestions.push('File appears to be good quality - minimal enhancement needed')
    }

    return suggestions
  }

  /**
   * Analyze multiple files and provide batch recommendations
   */
  async analyzeMultipleFiles(files: File[]): Promise<{
    analyses: ServerAudioAnalysis[]
    overall_quality: number
    best_files: string[]
    issues_found: string[]
    improvement_suggestions: string[]
  }> {
    const analyses = await Promise.all(
      files.map(file => this.analyzeAudioFile(file))
    )

    const overallQuality = analyses.reduce((sum, analysis) => sum + analysis.quality_score, 0) / analyses.length

    const bestFiles = analyses
      .map((analysis, index) => ({ analysis, filename: files[index].name, index }))
      .filter(item => item.analysis.quality_score >= overallQuality)
      .sort((a, b) => b.analysis.quality_score - a.analysis.quality_score)
      .slice(0, Math.ceil(files.length / 2)) // Top half of files
      .map(item => item.filename)

    const allIssues = analyses.flatMap(analysis => analysis.issues)
    const uniqueIssues = Array.from(new Set(allIssues))

    const allSuggestions = analyses.flatMap(analysis => analysis.enhancement_suggestions)
    const uniqueSuggestions = Array.from(new Set(allSuggestions))

    return {
      analyses,
      overall_quality: overallQuality,
      best_files: bestFiles,
      issues_found: uniqueIssues,
      improvement_suggestions: uniqueSuggestions
    }
  }

  /**
   * Determine what enhancements should be applied based on analysis
   */
  getRecommendedEnhancements(analysis: ServerAudioAnalysis): ServerAudioEnhancement {
    const estimatedBitrate = (analysis.file_size * 8) / analysis.estimated_duration / 1000

    return {
      noise_reduction: estimatedBitrate < 128 || analysis.quality_score < 6,
      volume_normalization: analysis.quality_score < 7 || analysis.file_size < this.OPTIMAL_FILE_SIZE_MIN,
      clarity_enhancement: analysis.quality_score < 6,
      format_optimization: analysis.format === 'audio/mp3' || analysis.format === 'audio/mpeg'
    }
  }
}

// Export singleton instance
export const serverAudioAnalyzer = new ServerAudioAnalyzer()