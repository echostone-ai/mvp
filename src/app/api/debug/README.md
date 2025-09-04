# Debug Endpoints

This directory contains debug and monitoring endpoints for the Hot Facts Extraction Pipeline. These endpoints are restricted to development environments only.

## Endpoints

### GET /api/debug/persona?avatar=slug

Returns persona debugging information for an avatar.

**Parameters:**
- `avatar` (required): Avatar slug

**Response:**
```json
{
  "avatar": {
    "id": "uuid",
    "slug": "avatar-slug", 
    "display_name": "Avatar Name"
  },
  "quick_facts": {
    "count": 15,
    "by_priority": { "1": 3, "2": 5, "3": 7 },
    "by_source": { "heuristic": 8, "llm": 7 },
    "average_confidence": 0.85
  },
  "traits": {
    "count": 3,
    "has_personality": true,
    "has_speaking_style": true,
    "has_background_story": true
  },
  "memories": {
    "count": 42,
    "top_memories_preview": [...]
  },
  "processing_time_ms": 125,
  "extraction_statistics": {
    "facts_per_memory": 0.36,
    "high_priority_facts": 3,
    "medium_priority_facts": 12,
    "low_priority_facts": 0
  }
}
```

### GET /api/debug/facts?avatar=slug

Returns complete quick_facts dump with filtering options.

**Parameters:**
- `avatar` (required): Avatar slug
- `priority` (optional): Filter by priority level (1-10)
- `confidence` (optional): Filter by minimum confidence (0.0-1.0)
- `source` (optional): Filter by source type
- `date_from` (optional): Filter by creation date (ISO string)
- `date_to` (optional): Filter by creation date (ISO string)

**Response:**
```json
{
  "avatar": { ... },
  "filters_applied": {
    "priority": 2,
    "confidence": 0.8,
    "source": null,
    "date_from": null,
    "date_to": null
  },
  "summary": {
    "total_facts": 15,
    "facts_by_priority": { ... },
    "facts_by_source": { ... },
    "facts_with_history": 3,
    "expired_facts": 0,
    "average_confidence": 0.85
  },
  "facts": [
    {
      "id": "uuid",
      "key": "birth_year",
      "value": "1985",
      "confidence": 0.95,
      "priority": 1,
      "source": "heuristic",
      "created_at": "2025-01-08T...",
      "history": [...],
      "has_history": true
    }
  ],
  "processing_time_ms": 89
}
```

### GET /api/debug/search?avatar=slug&q=term

Returns search results with performance metrics.

**Parameters:**
- `avatar` (required): Avatar slug
- `q` (optional): Search query term
- `limit` (optional): Result limit (1-20, default 5)

**Response:**
```json
{
  "avatar": { ... },
  "query": {
    "text": "birth",
    "limit": 5,
    "is_empty": false
  },
  "search_memories_results": {
    "count": 3,
    "results": [...],
    "processing_time_ms": 45
  },
  "quick_facts_matching": {
    "count": 2,
    "facts": [...],
    "processing_time_ms": 12
  },
  "memory_fragment_analysis": {
    "total_fragments": 42,
    "matching_fragments": 5,
    "match_percentage": 12,
    "sample_matches": [...]
  },
  "performance_timing": {
    "search_memories_ms": 45,
    "quick_facts_ms": 12,
    "fragments_analysis_ms": 8,
    "total_processing_ms": 78
  },
  "result_quality_metrics": {
    "search_results_found": 3,
    "quick_facts_matched": 2,
    "total_relevant_items": 5,
    "has_high_priority_facts": true,
    "average_fact_confidence": 0.9
  }
}
```

## Environment Restrictions

All debug endpoints return a 403 error in production environments:

```json
{
  "error": "Debug endpoints are not available in production"
}
```

## Error Handling

- **400**: Missing required parameters
- **403**: Production environment access denied
- **404**: Avatar not found
- **500**: Internal server error or missing configuration

## Usage Examples

```bash
# Get persona overview
curl "http://localhost:3000/api/debug/persona?avatar=jonathan_braden"

# Get high-priority facts only
curl "http://localhost:3000/api/debug/facts?avatar=jonathan_braden&priority=2"

# Search for birth-related information
curl "http://localhost:3000/api/debug/search?avatar=jonathan_braden&q=birth&limit=10"
```