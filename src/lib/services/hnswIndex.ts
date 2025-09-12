// src/lib/services/hnswIndex.ts
// Lightweight HNSW (Hierarchical Navigable Small World) implementation for fast ANN search

import { VectorIndex } from './vectorRetriever';

/**
 * Configuration for HNSW index
 */
export interface HNSWConfig {
  maxConnections: number; // M - maximum number of connections per node (default: 16)
  efConstruction: number; // efConstruction - size of dynamic candidate list (default: 200)
  efSearch: number; // ef - size of dynamic candidate list during search (default: 50)
  maxLayers: number; // Maximum number of layers (default: 16)
  levelGenerationFactor: number; // mL - level generation factor (default: 1/ln(2))
  seed?: number; // Random seed for reproducible results
}

/**
 * HNSW node representing a vector in the graph
 */
interface HNSWNode {
  id: string;
  vector: number[];
  level: number;
  connections: Map<number, Set<string>>; // layer -> set of connected node IDs
}

/**
 * Search candidate with distance
 */
interface SearchCandidate {
  id: string;
  distance: number;
}

/**
 * Priority queue for managing search candidates
 */
class PriorityQueue {
  private items: SearchCandidate[] = [];
  private maxSize: number;
  private isMaxHeap: boolean;

  constructor(maxSize: number = Infinity, isMaxHeap: boolean = false) {
    this.maxSize = maxSize;
    this.isMaxHeap = isMaxHeap;
  }

  push(candidate: SearchCandidate): void {
    this.items.push(candidate);
    this.bubbleUp(this.items.length - 1);

    // Remove worst item if over capacity
    if (this.items.length > this.maxSize) {
      this.pop();
    }
  }

  pop(): SearchCandidate | undefined {
    if (this.items.length === 0) return undefined;
    if (this.items.length === 1) return this.items.pop();

    const result = this.items[0];
    this.items[0] = this.items.pop()!;
    this.bubbleDown(0);
    return result;
  }

  peek(): SearchCandidate | undefined {
    return this.items[0];
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  toArray(): SearchCandidate[] {
    return [...this.items].sort((a, b) => 
      this.isMaxHeap ? b.distance - a.distance : a.distance - b.distance
    );
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (!this.shouldSwap(index, parentIndex)) break;

      [this.items[index], this.items[parentIndex]] = [this.items[parentIndex], this.items[index]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      let targetIndex = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (leftChild < this.items.length && this.shouldSwap(leftChild, targetIndex)) {
        targetIndex = leftChild;
      }

      if (rightChild < this.items.length && this.shouldSwap(rightChild, targetIndex)) {
        targetIndex = rightChild;
      }

      if (targetIndex === index) break;

      [this.items[index], this.items[targetIndex]] = [this.items[targetIndex], this.items[index]];
      index = targetIndex;
    }
  }

  private shouldSwap(childIndex: number, parentIndex: number): boolean {
    const childDistance = this.items[childIndex].distance;
    const parentDistance = this.items[parentIndex].distance;

    return this.isMaxHeap ? childDistance > parentDistance : childDistance < parentDistance;
  }
}

/**
 * Lightweight HNSW implementation for fast approximate nearest neighbor search
 */
export class HNSWIndex implements VectorIndex {
  private config: HNSWConfig;
  private nodes: Map<string, HNSWNode> = new Map();
  private entryPoint: string | null = null;
  private rng: () => number;
  private dimensions: number = 0;

  constructor(config: Partial<HNSWConfig> = {}) {
    this.config = {
      maxConnections: 16,
      efConstruction: 200,
      efSearch: 50,
      maxLayers: 16,
      levelGenerationFactor: 1 / Math.log(2),
      ...config
    };

    // Initialize random number generator
    if (config.seed !== undefined) {
      let seed = config.seed;
      this.rng = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      };
    } else {
      this.rng = Math.random;
    }

    console.log('hnsw_index_initialized', {
      max_connections: this.config.maxConnections,
      ef_construction: this.config.efConstruction,
      ef_search: this.config.efSearch,
      max_layers: this.config.maxLayers,
      seed: config.seed
    });
  }

  /**
   * Add a vector to the index
   */
  add(id: string, vector: number[]): void {
    if (this.nodes.has(id)) {
      console.warn('hnsw_duplicate_id', { id });
      return;
    }

    // Set dimensions from first vector
    if (this.dimensions === 0) {
      this.dimensions = vector.length;
    } else if (vector.length !== this.dimensions) {
      throw new Error(`Vector dimension mismatch: expected ${this.dimensions}, got ${vector.length}`);
    }

    // Generate random level for the new node
    const level = this.generateRandomLevel();

    // Create new node
    const node: HNSWNode = {
      id,
      vector: [...vector], // Copy vector to avoid mutations
      level,
      connections: new Map()
    };

    // Initialize connection sets for each layer
    for (let layer = 0; layer <= level; layer++) {
      node.connections.set(layer, new Set());
    }

    this.nodes.set(id, node);

    // If this is the first node, make it the entry point
    if (this.entryPoint === null) {
      this.entryPoint = id;
      console.log('hnsw_entry_point_set', { id, level });
      return;
    }

    // Insert the node into the graph
    this.insertNode(node);

    console.log('hnsw_node_added', {
      id,
      level,
      total_nodes: this.nodes.size,
      vector_dimensions: vector.length
    });
  }

  /**
   * Search for k nearest neighbors
   */
  search(query: number[], k: number): { id: string; distance: number }[] {
    if (this.nodes.size === 0 || this.entryPoint === null) {
      return [];
    }

    if (query.length !== this.dimensions) {
      throw new Error(`Query dimension mismatch: expected ${this.dimensions}, got ${query.length}`);
    }

    const startTime = Date.now();

    // Start from entry point and search down through layers
    let currentBest = new Set([this.entryPoint]);
    const entryNode = this.nodes.get(this.entryPoint)!;

    // Search from top layer down to layer 1
    for (let layer = entryNode.level; layer >= 1; layer--) {
      currentBest = this.searchLayer(query, currentBest, 1, layer);
    }

    // Search layer 0 with ef parameter
    const candidates = this.searchLayer(query, currentBest, Math.max(this.config.efSearch, k), 0);

    // Convert to results and sort by distance
    const results: { id: string; distance: number }[] = [];
    for (const nodeId of candidates) {
      const node = this.nodes.get(nodeId);
      if (node) {
        const distance = this.calculateDistance(query, node.vector);
        results.push({ id: nodeId, distance });
      }
    }

    // Sort by distance and return top k
    results.sort((a, b) => a.distance - b.distance);
    const finalResults = results.slice(0, k);

    const elapsedMs = Date.now() - startTime;
    console.log('hnsw_search_complete', {
      query_dimensions: query.length,
      k,
      results_count: finalResults.length,
      search_time_ms: elapsedMs,
      ef_search: this.config.efSearch
    });

    return finalResults;
  }

  /**
   * Get the number of nodes in the index
   */
  size(): number {
    return this.nodes.size;
  }

  /**
   * Clear all nodes from the index
   */
  clear(): void {
    this.nodes.clear();
    this.entryPoint = null;
    this.dimensions = 0;
    console.log('hnsw_index_cleared');
  }

  /**
   * Get index statistics
   */
  getStats(): {
    nodeCount: number;
    dimensions: number;
    maxLevel: number;
    avgConnections: number;
    memoryUsageMB: number;
  } {
    if (this.nodes.size === 0) {
      return {
        nodeCount: 0,
        dimensions: 0,
        maxLevel: 0,
        avgConnections: 0,
        memoryUsageMB: 0
      };
    }

    let maxLevel = 0;
    let totalConnections = 0;

    for (const node of this.nodes.values()) {
      maxLevel = Math.max(maxLevel, node.level);
      
      // Count connections across all layers
      for (const connections of node.connections.values()) {
        totalConnections += connections.size;
      }
    }

    const avgConnections = totalConnections / this.nodes.size;

    // Rough memory usage estimation
    const bytesPerNode = this.dimensions * 8 + 100; // 8 bytes per float + overhead
    const memoryUsageMB = (this.nodes.size * bytesPerNode) / (1024 * 1024);

    return {
      nodeCount: this.nodes.size,
      dimensions: this.dimensions,
      maxLevel,
      avgConnections,
      memoryUsageMB
    };
  }

  /**
   * Serialize index to JSON for persistence
   */
  serialize(): string {
    const data = {
      config: this.config,
      dimensions: this.dimensions,
      entryPoint: this.entryPoint,
      nodes: Array.from(this.nodes.entries()).map(([id, node]) => ({
        id,
        vector: node.vector,
        level: node.level,
        connections: Array.from(node.connections.entries()).map(([layer, connections]) => ({
          layer,
          connections: Array.from(connections)
        }))
      }))
    };

    return JSON.stringify(data);
  }

  /**
   * Deserialize index from JSON
   */
  static deserialize(json: string): HNSWIndex {
    const data = JSON.parse(json);
    const index = new HNSWIndex(data.config);
    
    index.dimensions = data.dimensions;
    index.entryPoint = data.entryPoint;

    // Reconstruct nodes
    for (const nodeData of data.nodes) {
      const node: HNSWNode = {
        id: nodeData.id,
        vector: nodeData.vector,
        level: nodeData.level,
        connections: new Map()
      };

      // Reconstruct connections
      for (const connData of nodeData.connections) {
        node.connections.set(connData.layer, new Set(connData.connections));
      }

      index.nodes.set(nodeData.id, node);
    }

    console.log('hnsw_index_deserialized', {
      node_count: index.nodes.size,
      dimensions: index.dimensions,
      entry_point: index.entryPoint
    });

    return index;
  }

  /**
   * Generate random level for a new node using exponential decay
   */
  private generateRandomLevel(): number {
    let level = 0;
    while (this.rng() < this.config.levelGenerationFactor && level < this.config.maxLayers) {
      level++;
    }
    return level;
  }

  /**
   * Insert a node into the HNSW graph
   */
  private insertNode(newNode: HNSWNode): void {
    if (this.entryPoint === null) return;

    // Find closest nodes starting from entry point
    let currentBest = new Set([this.entryPoint]);
    const entryNode = this.nodes.get(this.entryPoint)!;

    // Search from top layer down to newNode.level + 1
    for (let layer = entryNode.level; layer >= newNode.level + 1; layer--) {
      currentBest = this.searchLayer(newNode.vector, currentBest, 1, layer);
    }

    // Insert connections from newNode.level down to 0
    for (let layer = Math.min(newNode.level, entryNode.level); layer >= 0; layer--) {
      const candidates = this.searchLayer(newNode.vector, currentBest, this.config.efConstruction, layer);
      
      // Select best connections for this layer
      const maxConnections = layer === 0 ? this.config.maxConnections * 2 : this.config.maxConnections;
      const selectedConnections = this.selectBestConnections(newNode.vector, candidates, maxConnections);

      // Add bidirectional connections
      for (const connectionId of selectedConnections) {
        newNode.connections.get(layer)!.add(connectionId);
        this.nodes.get(connectionId)!.connections.get(layer)!.add(newNode.id);

        // Prune connections if necessary
        this.pruneConnections(connectionId, layer);
      }

      currentBest = selectedConnections;
    }

    // Update entry point if new node has higher level
    if (newNode.level > entryNode.level) {
      this.entryPoint = newNode.id;
      console.log('hnsw_entry_point_updated', { 
        old_entry: entryNode.id, 
        new_entry: newNode.id,
        old_level: entryNode.level,
        new_level: newNode.level
      });
    }
  }

  /**
   * Search a specific layer for closest nodes
   */
  private searchLayer(
    query: number[], 
    entryPoints: Set<string>, 
    numClosest: number, 
    layer: number
  ): Set<string> {
    const visited = new Set<string>();
    const candidates = new PriorityQueue(Infinity, false); // Min heap for closest
    const dynamic = new PriorityQueue(Infinity, true); // Max heap for furthest

    // Initialize with entry points
    for (const entryId of entryPoints) {
      const distance = this.calculateDistance(query, this.nodes.get(entryId)!.vector);
      candidates.push({ id: entryId, distance });
      dynamic.push({ id: entryId, distance });
      visited.add(entryId);
    }

    while (!candidates.isEmpty()) {
      const current = candidates.pop()!;
      
      // Stop if current is further than furthest in dynamic list
      const furthest = dynamic.peek();
      if (furthest && current.distance > furthest.distance) {
        break;
      }

      // Explore neighbors
      const currentNode = this.nodes.get(current.id)!;
      const connections = currentNode.connections.get(layer);
      
      if (connections) {
        for (const neighborId of connections) {
          if (!visited.has(neighborId)) {
            visited.add(neighborId);
            
            const neighborDistance = this.calculateDistance(query, this.nodes.get(neighborId)!.vector);
            const furthestInDynamic = dynamic.peek();
            
            if (dynamic.size() < numClosest || !furthestInDynamic || neighborDistance < furthestInDynamic.distance) {
              candidates.push({ id: neighborId, distance: neighborDistance });
              dynamic.push({ id: neighborId, distance: neighborDistance });
              
              // Keep dynamic list size bounded
              if (dynamic.size() > numClosest) {
                dynamic.pop();
              }
            }
          }
        }
      }
    }

    // Return the closest nodes
    return new Set(dynamic.toArray().map(c => c.id));
  }

  /**
   * Select best connections using a simple heuristic
   */
  private selectBestConnections(
    queryVector: number[], 
    candidates: Set<string>, 
    maxConnections: number
  ): Set<string> {
    if (candidates.size <= maxConnections) {
      return candidates;
    }

    // Calculate distances and sort
    const candidatesWithDistance = Array.from(candidates).map(id => ({
      id,
      distance: this.calculateDistance(queryVector, this.nodes.get(id)!.vector)
    }));

    candidatesWithDistance.sort((a, b) => a.distance - b.distance);

    // Return closest connections
    return new Set(candidatesWithDistance.slice(0, maxConnections).map(c => c.id));
  }

  /**
   * Prune connections for a node if it has too many
   */
  private pruneConnections(nodeId: string, layer: number): void {
    const node = this.nodes.get(nodeId)!;
    const connections = node.connections.get(layer)!;
    const maxConnections = layer === 0 ? this.config.maxConnections * 2 : this.config.maxConnections;

    if (connections.size <= maxConnections) {
      return;
    }

    // Select best connections to keep
    const bestConnections = this.selectBestConnections(node.vector, connections, maxConnections);
    
    // Remove excess connections (bidirectional)
    for (const connectionId of connections) {
      if (!bestConnections.has(connectionId)) {
        connections.delete(connectionId);
        this.nodes.get(connectionId)!.connections.get(layer)!.delete(nodeId);
      }
    }
  }

  /**
   * Calculate Euclidean distance between two vectors
   */
  private calculateDistance(a: number[], b: number[]): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Get default HNSW configuration
   */
  static getDefaultConfig(): HNSWConfig {
    return {
      maxConnections: 16,
      efConstruction: 200,
      efSearch: 50,
      maxLayers: 16,
      levelGenerationFactor: 1 / Math.log(2)
    };
  }

  /**
   * Get optimized configuration for small datasets (< 10k vectors)
   */
  static getSmallDatasetConfig(): HNSWConfig {
    return {
      maxConnections: 8,
      efConstruction: 100,
      efSearch: 32,
      maxLayers: 12,
      levelGenerationFactor: 1 / Math.log(2)
    };
  }

  /**
   * Get optimized configuration for large datasets (> 100k vectors)
   */
  static getLargeDatasetConfig(): HNSWConfig {
    return {
      maxConnections: 32,
      efConstruction: 400,
      efSearch: 100,
      maxLayers: 20,
      levelGenerationFactor: 1 / Math.log(2)
    };
  }
}