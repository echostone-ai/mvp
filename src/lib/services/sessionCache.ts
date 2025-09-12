/**
 * Session Cache - Persistent In-Memory Session Context
 * Provides ultra-fast session context retrieval for hybrid streaming
 */

export type SessionKey = `${string}:${string}`; // avatarId:sessionId

export interface SessionContext {
    personaSeed: string;                 // minimal, high-signal identity/style block
    lastTurns: Array<{
        role: 'user' | 'assistant';
        content: string;
        ts: number;
    }>;
    friendEntities: Record<string, {
        name: string;
        relation: 'friend' | 'family';
        aliases: string[];
    }>;
    familyEntities: Record<string, {
        name: string;
        relation: 'family';
        aliases: string[];
    }>;
    hotMemories: Array<{
        id: string;
        text: string;
        tags?: string[];
        ts: string;
    }>;
    demoSeedMemories?: Array<{
        id: string;
        text: string;
        ctx_type: string;
    }>;
    createdAt: number;
    updatedAt: number;
}

export interface SessionCache {
    get(key: SessionKey): SessionContext | undefined;
    set(key: SessionKey, ctx: SessionContext, ttlMs?: number): void;
    touch(key: SessionKey): void;  // bump updatedAt
    prune(): void;                 // remove expired
}

/**
 * In-memory session cache with TTL and segmentation
 */
class InMemorySessionCache implements SessionCache {
    private demoSessions = new Map<SessionKey, { ctx: SessionContext; expiresAt: number }>();
    private realSessions = new Map<SessionKey, { ctx: SessionContext; expiresAt: number }>();
    private defaultTTL = 10 * 60 * 1000; // 10 minutes
    private pruneInterval: NodeJS.Timeout;

    constructor() {
        // Background prune every 60 seconds
        this.pruneInterval = setInterval(() => this.prune(), 60 * 1000);
    }

    private getMap(key: SessionKey): Map<SessionKey, { ctx: SessionContext; expiresAt: number }> {
        // Demo sessions use demo avatar IDs or contain 'demo' in the key
        return key.includes('demo') || key.includes('jonathan') ? this.demoSessions : this.realSessions;
    }

    get(key: SessionKey): SessionContext | undefined {
        const map = this.getMap(key);
        const entry = map.get(key);

        if (!entry) return undefined;

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            map.delete(key);
            return undefined;
        }

        return entry.ctx;
    }

    set(key: SessionKey, ctx: SessionContext, ttlMs?: number): void {
        const map = this.getMap(key);
        const ttl = ttlMs || this.defaultTTL;
        const expiresAt = Date.now() + ttl;

        ctx.updatedAt = Date.now();

        map.set(key, { ctx, expiresAt });
    }

    touch(key: SessionKey): void {
        const map = this.getMap(key);
        const entry = map.get(key);

        if (entry && Date.now() <= entry.expiresAt) {
            entry.ctx.updatedAt = Date.now();
        }
    }

    prune(): void {
        const now = Date.now();

        // Prune demo sessions
        for (const [key, entry] of this.demoSessions.entries()) {
            if (now > entry.expiresAt) {
                this.demoSessions.delete(key);
            }
        }

        // Prune real sessions
        for (const [key, entry] of this.realSessions.entries()) {
            if (now > entry.expiresAt) {
                this.realSessions.delete(key);
            }
        }
    }

    // Debug methods
    getStats() {
        return {
            demoSessions: this.demoSessions.size,
            realSessions: this.realSessions.size,
            total: this.demoSessions.size + this.realSessions.size
        };
    }

    clear() {
        this.demoSessions.clear();
        this.realSessions.clear();
    }

    destroy() {
        if (this.pruneInterval) {
            clearInterval(this.pruneInterval);
        }
        this.clear();
    }
}

// Global singleton instance
export const sessionCache: SessionCache = new InMemorySessionCache();

/**
 * Derive session ID from avatar and visitor context
 */
export function deriveSessionId(avatarId: string, visitorCookie: string, authUserId?: string): string {
    // Use authenticated user ID if available, otherwise visitor cookie
    const userIdentifier = authUserId || visitorCookie;
    return `${avatarId}:${userIdentifier}`;
}

/**
 * Create session key from components
 */
export function createSessionKey(avatarId: string, sessionId: string): SessionKey {
    return `${avatarId}:${sessionId}` as SessionKey;
}