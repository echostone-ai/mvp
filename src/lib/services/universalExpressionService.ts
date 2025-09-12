/**
 * Universal Expression Service
 * Provides expression overlays for all avatars with intelligent fallbacks
 * System-wide improvements that benefit all users
 */

import { SimpleExpressionPlayer, SimpleExpression } from '../simpleExpressionPlayer'
import { ExpressionPackService } from './expressionPackService'
import { isFeatureEnabled } from '../featureFlags'

export interface UniversalExpressionPack {
  expressions: SimpleExpression[]
  buffers: Map<string, AudioBuffer>
  avatarId: string
  loadedAt: Date
}

export class UniversalExpressionService {
  private static cache = new Map<string, UniversalExpressionPack>()
  private static readonly CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

  /**
   * Load avatar-specific expressions with enhanced support for different avatar types
   */
  private static async loadAvatarSpecificExpressions(avatarId: string): Promise<any> {
    try {
      // For jonathan-demo, try API first, then fallback to uploaded expressions
      if (avatarId === 'jonathan-demo') {
        console.log(`[UniversalExpression] Loading jonathan-demo expressions via API...`)
        
        try {
          const response = await fetch(`/api/expressions?avatarId=${avatarId}&ownerType=avatar`)
          
          if (response.ok) {
            const data = await response.json()
            
            if (data && data.success && Array.isArray(data.expressions) && data.expressions.length > 0) {
              console.log(`[UniversalExpression] ✅ Found ${data.expressions.length} uploaded expressions for jonathan-demo`)
              return {
                id: `real-${avatarId}`,
                avatarId,
                expressions: data.expressions,
                buffers: new Map(),
                loadedAt: new Date()
              }
            }
          } else {
            console.warn(`[UniversalExpression] API request failed with status ${response.status}`)
          }
        } catch (apiError) {
          console.warn(`[UniversalExpression] API request failed:`, {
            error: apiError instanceof Error ? apiError.message : String(apiError)
          })
        }
      }
      
      // For user avatars, load their custom expressions
      else {
        console.log(`[UniversalExpression] Loading user avatar expressions for ${avatarId}...`)
        
        try {
          const response = await fetch(`/api/expressions?avatarId=${avatarId}&ownerType=user`)
          
          if (response.ok) {
            const data = await response.json()
            
            if (data && data.success && Array.isArray(data.expressions) && data.expressions.length > 0) {
              console.log(`[UniversalExpression] ✅ Found ${data.expressions.length} user expressions for ${avatarId}`)
              return {
                id: `user-${avatarId}`,
                avatarId,
                expressions: data.expressions,
                buffers: new Map(),
                loadedAt: new Date()
              }
            }
          }
        } catch (apiError) {
          console.warn(`[UniversalExpression] User API request failed:`, {
            error: apiError instanceof Error ? apiError.message : String(apiError)
          })
        }
      }
      
      // Try ExpressionPackService as fallback
      try {
        const pack = await ExpressionPackService.loadExpressionPack({
          avatarId,
          includeUserExpressions: true,
          maxExpressionsPerType: 5
        })
        
        if (pack && Array.isArray(pack.expressions)) {
          return pack
        }
      } catch (packError) {
        console.warn(`[UniversalExpression] ExpressionPackService failed:`, {
          error: packError instanceof Error ? packError.message : String(packError)
        })
      }
      
      return null
      
    } catch (error) {
      console.error(`[UniversalExpression] Failed to load avatar-specific expressions for ${avatarId}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      return null
    }
  }

  /**
   * Create intelligent fallback pack based on avatar type
   */
  private static async createIntelligentFallbackPack(avatarId: string): Promise<any> {
    // For jonathan-demo, use high-quality fallback expressions
    if (avatarId === 'jonathan-demo') {
      return this.createJonathanDemoFallbackPack()
    }
    
    // For user avatars, use generic but natural fallback expressions
    return this.createUserAvatarFallbackPack(avatarId)
  }

  /**
   * Create jonathan-demo specific fallback expressions
   */
  private static createJonathanDemoFallbackPack(): any {
    return {
      id: 'jonathan-demo-fallback',
      avatarId: 'jonathan-demo',
      expressions: [
        {
          id: 'laugh',
          type: 'laugh',
          keywords: ['funny', 'hilarious', 'laugh', 'haha', 'lol', 'cracking up'],
          audioUrl: '/snippets/laugh_short.mp3',
          volume: 0.4,
          cdnUrl: '/snippets/laugh_short.mp3'
        },
        {
          id: 'sigh',
          type: 'sigh',
          keywords: ['sigh', 'overwhelm', 'tired', 'stressed', 'sad'],
          audioUrl: '/snippets/sigh_soft.mp3',
          volume: 0.3,
          cdnUrl: '/snippets/sigh_soft.mp3'
        },
        {
          id: 'wow',
          type: 'wow',
          keywords: ['wow', 'amazing', 'incredible', 'fantastic'],
          audioUrl: '/snippets/wow.mp3',
          volume: 0.4,
          cdnUrl: '/snippets/wow.mp3'
        },
        {
          id: 'hmm',
          type: 'hmm',
          keywords: ['hmm', 'thinking', 'interesting', 'curious'],
          audioUrl: '/snippets/hmm.mp3',
          volume: 0.3,
          cdnUrl: '/snippets/hmm.mp3'
        },
        {
          id: 'absolutely',
          type: 'absolutely',
          keywords: ['absolutely', 'exactly', 'definitely', 'totally'],
          audioUrl: '/snippets/absolutely.mp3',
          volume: 0.4,
          cdnUrl: '/snippets/absolutely.mp3'
        }
      ],
      buffers: new Map(),
      loadedAt: new Date()
    }
  }

  /**
   * Create user avatar fallback expressions (generic but natural)
   */
  private static createUserAvatarFallbackPack(avatarId: string): any {
    return {
      id: `user-${avatarId}-fallback`,
      avatarId,
      expressions: [
        {
          id: 'laugh',
          type: 'laugh',
          keywords: ['funny', 'hilarious', 'laugh', 'haha'],
          audioUrl: '/snippets/laugh_short.mp3',
          volume: 0.3,
          cdnUrl: '/snippets/laugh_short.mp3'
        },
        {
          id: 'hmm',
          type: 'hmm',
          keywords: ['hmm', 'thinking', 'interesting'],
          audioUrl: '/snippets/hmm.mp3',
          volume: 0.3,
          cdnUrl: '/snippets/hmm.mp3'
        },
        {
          id: 'wow',
          type: 'wow',
          keywords: ['wow', 'amazing', 'incredible'],
          audioUrl: '/snippets/wow.mp3',
          volume: 0.3,
          cdnUrl: '/snippets/wow.mp3'
        }
      ],
      buffers: new Map(),
      loadedAt: new Date()
    }
  }

  /**
   * Get expression pack for any avatar with intelligent fallbacks
   * Enhanced for both jonathan-demo and user-created avatars
   */
  static async getExpressionPack(avatarId: string): Promise<UniversalExpressionPack> {
    // Validate input
    if (!avatarId || typeof avatarId !== 'string') {
      console.warn(`[UniversalExpression] Invalid avatarId provided:`, avatarId)
      return this.createMinimalFallbackPack('unknown')
    }

    // Check cache first
    const cached = this.cache.get(avatarId)
    if (cached && this.isCacheValid(cached)) {
      console.log(`[UniversalExpression] Using cached pack for avatar ${avatarId}`)
      return cached
    }

    try {
      console.log(`[UniversalExpression] Loading expression pack for avatar ${avatarId}`)
      
      // Enhanced loading strategy for different avatar types
      let pack = await this.loadAvatarSpecificExpressions(avatarId)
      
      // Validate pack structure
      if (!pack || typeof pack !== 'object') {
        console.log(`[UniversalExpression] Invalid pack structure for ${avatarId}, creating intelligent fallback`)
        pack = await this.createIntelligentFallbackPack(avatarId)
      } else if (!Array.isArray(pack.expressions) || pack.expressions.length === 0) {
        console.log(`[UniversalExpression] No expressions found for ${avatarId}, creating intelligent fallback`)
        pack = await this.createIntelligentFallbackPack(avatarId)
      }
      
      // Ensure pack has required structure
      if (!pack || !Array.isArray(pack.expressions)) {
        console.warn(`[UniversalExpression] Fallback pack creation failed for ${avatarId}, using minimal pack`)
        return this.createMinimalFallbackPack(avatarId)
      }
      
      // Convert to universal format and load audio buffers with M4A support
      const universalPack = await this.convertToUniversalPack(pack, avatarId)
      
      // Validate universal pack
      if (!universalPack || !Array.isArray(universalPack.expressions)) {
        console.error(`[UniversalExpression] Failed to convert pack for ${avatarId}, using minimal fallback`)
        return this.createMinimalFallbackPack(avatarId)
      }
      
      // Cache the pack
      this.cache.set(avatarId, universalPack)
      
      console.log(`[UniversalExpression] Expression pack ready for ${avatarId}: ${universalPack.expressions.length} expressions, ${universalPack.buffers.size} audio buffers`)
      
      return universalPack
      
    } catch (error) {
      console.error(`[UniversalExpression] Failed to load expression pack for ${avatarId}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      
      // Final fallback - create minimal universal pack
      const fallbackPack = this.createMinimalFallbackPack(avatarId)
      console.warn(`[UniversalExpression] Using minimal fallback pack for ${avatarId}`)
      return fallbackPack
    }
  }

  /**
   * Create universal fallback pack when no avatar-specific expressions exist
   */
  private static createUniversalFallbackPack(avatarId: string): any {
    return {
      id: `universal-${avatarId}`,
      avatarId,
      expressions: this.getUniversalExpressions(),
      buffers: new Map(),
      loadedAt: new Date()
    }
  }

  /**
   * Create minimal fallback pack for error cases
   */
  private static createMinimalFallbackPack(avatarId: string): UniversalExpressionPack {
    return {
      expressions: this.getUniversalExpressions(),
      buffers: new Map(),
      avatarId,
      loadedAt: new Date()
    }
  }

  /**
   * Get universal expressions that work for any avatar
   */
  private static getUniversalExpressions(): SimpleExpression[] {
    return [
      {
        id: 'universal-laugh',
        type: 'laugh',
        keywords: ['funny', 'hilarious', 'laugh', 'joke', 'humor', 'haha', 'lol', 'amusing', 'comedy', 'tickled', 'giggle', 'chuckle', 'crack up'],
        audioUrl: '/snippets/laugh_short.mp3',
        volume: 0.4
      },
      {
        id: 'universal-thinking',
        type: 'thinking',
        keywords: ['hmm', 'thinking', 'let me think', 'consider', 'wondering', 'pondering', 'reflecting'],
        audioUrl: '/snippets/hmm.mp3',
        volume: 0.5
      },
      {
        id: 'universal-affirmation',
        type: 'affirmation',
        keywords: ['absolutely', 'exactly', 'definitely', 'totally', 'yes', 'indeed', 'certainly', 'precisely'],
        audioUrl: '/snippets/absolutely.mp3',
        volume: 0.4
      },
      {
        id: 'universal-amazement',
        type: 'amazement',
        keywords: ['wow', 'amazing', 'incredible', 'unbelievable', 'fantastic', 'remarkable', 'extraordinary'],
        audioUrl: '/snippets/wow.mp3',
        volume: 0.4
      },
      {
        id: 'universal-understanding',
        type: 'understanding',
        keywords: ['understand', 'i see', 'got it', 'makes sense', 'i get it', 'clear'],
        audioUrl: '/snippets/i_understand.mp3',
        volume: 0.4
      },
      {
        id: 'universal-interest',
        type: 'interest',
        keywords: ['interesting', 'fascinating', 'intriguing', 'curious', 'tell me more'],
        audioUrl: '/snippets/interesting.mp3',
        volume: 0.4
      },
      {
        id: 'universal-sigh',
        type: 'sigh',
        keywords: ['sigh', 'oh well', 'unfortunately', 'sadly', 'disappointing', 'frustrating'],
        audioUrl: '/snippets/sigh_soft.mp3',
        volume: 0.4
      },
      {
        id: 'universal-surprise',
        type: 'surprise',
        keywords: ['jeez', 'geez', 'oh my', 'whoa', 'surprised', 'unexpected', 'sudden'],
        audioUrl: '/snippets/wow.mp3', // Using wow as fallback for jeez
        volume: 0.4
      }
    ]
  }

  /**
   * Convert expression pack to universal format and load audio buffers
   */
  private static async convertToUniversalPack(pack: any, avatarId: string): Promise<UniversalExpressionPack> {
    // Validate input pack
    if (!pack || typeof pack !== 'object') {
      console.warn(`[UniversalExpression] Invalid pack provided for ${avatarId}, using universal expressions`)
      return {
        expressions: this.getUniversalExpressions(),
        buffers: new Map(),
        avatarId,
        loadedAt: new Date()
      }
    }

    // Ensure expressions array exists
    const expressions = Array.isArray(pack.expressions) ? pack.expressions : []
    const universalExpressions: SimpleExpression[] = []
    
    // Convert stored expressions to simple expressions with enhanced keywords
    for (const expr of expressions) {
      // Validate expression object
      if (!expr || typeof expr !== 'object') {
        console.warn(`[UniversalExpression] Invalid expression object for ${avatarId}:`, expr)
        continue
      }

      // Check required fields
      if (!expr.id || !expr.type || !expr.cdnUrl) {
        console.warn(`[UniversalExpression] Expression missing required fields for ${avatarId}:`, {
          id: expr.id,
          type: expr.type,
          cdnUrl: expr.cdnUrl
        })
        continue
      }

      let keywords = Array.isArray(expr.placementHints) ? expr.placementHints : [expr.type]
      
      console.log(`[UniversalExpression] Processing expression: ${expr.filename || expr.id}`)
      console.log(`[UniversalExpression] - Type: ${expr.type}`)
      console.log(`[UniversalExpression] - Tone: ${expr.tone}`)
      console.log(`[UniversalExpression] - Initial keywords: ${keywords}`)
      
      // Add more keywords based on the expression type and tone
      if (expr.type === 'laugh') {
        keywords = [...keywords, 'funny', 'hilarious', 'laugh', 'joke', 'humor', 'haha', 'lol', 'amusing', 'comedy', 'tickled', 'giggle', 'chuckle', 'ridiculous', 'silly', 'witty', 'clever']
      } else if (expr.type === 'catchphrase' && expr.tone?.toLowerCase().includes('jeez')) {
        keywords = [...keywords, 'jeez', 'geez', 'wow', 'amazing', 'astonished', 'excited', 'unbelievable', 'incredible', 'fantastic', 'remarkable', 'extraordinary', 'stunning']
      } else if (expr.tone?.toLowerCase().includes('sigh')) {
        keywords = [...keywords, 'sigh', 'oh well', 'unfortunately', 'sadly', 'disappointing', 'frustrating', 'nostalgic', 'overwhelmed', 'tired', 'exhausted', 'weary']
      }
      
      // Special handling for the sigh expression that's incorrectly typed as "laugh"
      if (expr.filename?.includes('Sigh') || expr.tone?.toLowerCase().includes('sigh')) {
        keywords = [...keywords, 'sigh', 'oh well', 'unfortunately', 'sadly', 'disappointing', 'frustrating', 'nostalgic', 'overwhelmed', 'tired', 'exhausted', 'weary', 'difficult', 'challenging']
      }
      
      // Special handling for the jeez expression
      if (expr.filename?.includes('Jeez') || expr.tone?.toLowerCase().includes('jeez')) {
        keywords = [...keywords, 'jeez', 'geez', 'wow', 'amazing', 'astonished', 'excited', 'unbelievable', 'incredible', 'fantastic', 'remarkable', 'extraordinary', 'stunning', 'impressive', 'wild', 'crazy']
      }
      
      // Special handling for laugh expression - add more common triggers
      if (expr.filename?.includes('Laugh') || expr.type === 'laugh') {
        keywords = [...keywords, 'funny', 'hilarious', 'laugh', 'joke', 'humor', 'haha', 'lol', 'amusing', 'comedy', 'ridiculous', 'silly', 'witty', 'clever', 'entertaining', 'comical']
      }
      
      const finalKeywords = [...new Set(keywords.filter(k => k && typeof k === 'string'))]; // Remove duplicates and invalid keywords
      console.log(`[UniversalExpression] - Final keywords: ${finalKeywords}`)
      
      universalExpressions.push({
        id: expr.id,
        type: expr.type,
        keywords: finalKeywords,
        audioUrl: expr.cdnUrl,
        volume: 0.4
      })
    }
    
    // If no expressions, use universal fallback
    if (universalExpressions.length === 0) {
      console.log(`[UniversalExpression] No valid expressions found for ${avatarId}, using universal fallback`)
      universalExpressions.push(...this.getUniversalExpressions())
    }
    
    // Load audio buffers on client side only
    const buffers = new Map<string, AudioBuffer>()
    if (typeof window !== 'undefined') {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        
        // Load buffers in parallel with M4A support
        const loadPromises = universalExpressions.map(async (expression) => {
          try {
            console.log(`[UniversalExpression] Loading ${expression.type} from: ${expression.audioUrl}`)
            const response = await fetch(expression.audioUrl)
            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer()
              console.log(`[UniversalExpression] Downloaded ${expression.id}: ${arrayBuffer.byteLength} bytes`)
              
              try {
                // Try AudioContext decode first (works for MP3, WAV)
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
                buffers.set(expression.id, audioBuffer)
                console.log(`[UniversalExpression] ✅ AudioContext loaded ${expression.type} for ${avatarId} (${audioBuffer.duration.toFixed(2)}s)`)
                return true
              } catch (decodeError) {
                console.warn(`[UniversalExpression] AudioContext decode failed for ${expression.id}, trying HTML Audio fallback:`, decodeError)
                
                // Fallback: Use HTML Audio for M4A and other formats
                try {
                  const audio = new Audio(expression.audioUrl)
                  audio.preload = 'auto'
                  
                  await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Audio load timeout')), 5000)
                    audio.addEventListener('canplaythrough', () => {
                      clearTimeout(timeout)
                      resolve(undefined)
                    })
                    audio.addEventListener('error', (e) => {
                      clearTimeout(timeout)
                      reject(e)
                    })
                    audio.load()
                  })
                  
                  // Store HTML Audio element (will be handled by SimpleExpressionPlayer)
                  buffers.set(expression.id, audio as any)
                  console.log(`[UniversalExpression] ✅ HTML Audio fallback loaded ${expression.type} for ${avatarId}`)
                  return true
                } catch (htmlAudioError) {
                  console.error(`[UniversalExpression] ❌ Both AudioContext and HTML Audio failed for ${expression.id}:`, htmlAudioError)
                  return false
                }
              }
            } else {
              console.warn(`[UniversalExpression] HTTP error loading ${expression.id}: ${response.status}`)
              return false
            }
          } catch (error) {
            console.warn(`[UniversalExpression] Failed to load ${expression.id}:`, {
              error: error instanceof Error ? error.message : String(error)
            })
            return false
          }
        })
        
        const results = await Promise.all(loadPromises)
        const successCount = results.filter(Boolean).length
        console.log(`[UniversalExpression] Loaded ${successCount}/${universalExpressions.length} audio buffers for ${avatarId}`)
        
      } catch (audioError) {
        console.warn(`[UniversalExpression] Failed to initialize audio context for ${avatarId}:`, {
          error: audioError instanceof Error ? audioError.message : String(audioError)
        })
      }
    }
    
    return {
      expressions: universalExpressions,
      buffers,
      avatarId,
      loadedAt: new Date()
    }
  }

  /**
   * Create simple expression player for any avatar
   */
  static async createExpressionPlayer(avatarId: string): Promise<SimpleExpressionPlayer | null> {
    if (!isFeatureEnabled('EXPRESSION_OVERLAYS_ENABLED')) {
      console.log(`[UniversalExpression] Expression overlays disabled for ${avatarId}`)
      return null
    }

    try {
      const pack = await this.getExpressionPack(avatarId)
      
      // Pack should never be null now, but add safety check
      if (!pack || !Array.isArray(pack.expressions)) {
        console.warn(`[UniversalExpression] Invalid expression pack for ${avatarId}:`, pack)
        return null
      }

      const player = new SimpleExpressionPlayer()
      
      // Load expressions and transfer pre-loaded buffers
      await player.loadExpressions(pack.expressions)
      
      // Transfer pre-loaded buffers to avoid re-downloading
      if (pack.buffers && pack.buffers instanceof Map) {
        for (const [id, buffer] of pack.buffers) {
          if (buffer && typeof player.setBuffer === 'function') {
            player.setBuffer(id, buffer)
          }
        }
      }
      
      console.log(`[UniversalExpression] Expression player created for ${avatarId} with ${pack.buffers?.size || 0} pre-loaded buffers`)
      return player
      
    } catch (error) {
      console.error(`[UniversalExpression] Failed to create expression player for ${avatarId}:`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      return null
    }
  }

  /**
   * Check if cached pack is still valid
   */
  private static isCacheValid(pack: UniversalExpressionPack): boolean {
    const age = Date.now() - pack.loadedAt.getTime()
    return age < this.CACHE_TTL_MS
  }

  /**
   * Clear expression pack cache
   */
  static clearCache(): void {
    this.cache.clear()
    console.log('[UniversalExpression] Expression pack cache cleared')
  }

  /**
   * Get cache statistics
   */
  static getCacheStats() {
    return {
      cacheSize: this.cache.size,
      cachedAvatars: Array.from(this.cache.keys())
    }
  }
}