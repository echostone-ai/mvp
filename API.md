## Echostone API

### POST /api/avatars
- **Purpose**: Create an avatar. Optionally accepts `seed_text` for initial memory/fact extraction. Creation does not block on extraction errors.
- **Body**:
```json
{
  "slug": "jonathan",
  "display_name": "Jonathan",
  "seed_text": "I was born in Maine and moved to Boston in 2012.",
  "user_id": "demo"
}
```
- **Response** (201):
```json
{
  "avatar": { "id": "uuid", "slug": "jonathan", "display_name": "Jonathan", "created_at": "...", "profile_data": {"created_via_api": true} },
  "extraction_results": {
    "quick_facts_count": 3,
    "fragments_count": 2,
    "processing_time_ms": 1540,
    "fact_extraction": {
      "facts_extracted": 3,
      "processing_time_ms": 1320,
      "stage_results": { "pattern_facts": 2, "llm_facts": 1 },
      "performance_metrics": { "total_facts_count": 3 }
    },
    "memory_fragments": { "fragments_created": 2, "fragment_ids": ["..."] },
    "errors": []
  }
}
```
- **Notes**:
  - Accepts `seed_text`; returns `fact_counts` via `quick_facts_count` and overall `processing_time_ms`.
  - Extraction failures are captured in `errors` but do not prevent avatar creation.

### POST /api/avatars/:slug/memories
- **Purpose**: Batch add memory fragments to an avatar. Triggers incremental extraction and fact promotion asynchronously.
- **Body**:
```json
{
  "fragments": ["I love hiking in Acadia.", "My first job was at a bookstore."],
  "user_id": "demo",
  "context": { "source": "journal", "timestamp": "2025-08-01T12:00:00Z" }
}
```
- **Response** (201/207/400):
```json
{
  "avatar": { "id": "uuid", "slug": "jonathan" },
  "processing_results": {
    "fragments_added": 2,
    "facts_extracted": 0,
    "facts_updated": 0,
    "processing_time_ms": 420,
    "processing_statistics": {
      "successful_fragments": 2,
      "failed_fragments": 0,
      "total_processing_time_ms": 420,
      "average_processing_time_per_fragment": 210
    },
    "errors": [],
    "notes": ["Fact extraction and promotion will be processed asynchronously"]
  }
}
```

### GET /api/debug/persona?avatar=slug
- **Purpose**: Development-only persona and data health view.
- **Response**:
```json
{
  "avatar": { "id": "uuid", "slug": "jonathan", "display_name": "Jonathan" },
  "quick_facts": { "count": 42, "by_priority": { "1": 3, "2": 7 }, "by_source": { "pattern": 10 }, "average_confidence": 0.91 },
  "traits": { "count": 3, "has_personality": true, "has_speaking_style": true, "has_background_story": true },
  "memories": { "count": 5, "top_memories_preview": [{ "text": "I was born in…", "created_at": "..." }] },
  "processing_time_ms": 35,
  "extraction_statistics": { "facts_per_memory": 1.2, "high_priority_facts": 4, "medium_priority_facts": 8, "low_priority_facts": 12 }
}
```

### GET /api/debug/facts?avatar=slug
- **Purpose**: Development-only dump of `quick_facts` with metadata.
- **Includes**: `priority`, `confidence`, `expires_at`, `source_reference`, and per-fact change history.

### GET /api/debug/search?avatar=slug&q=term
- **Purpose**: Development-only memory search with relevance and timings.
- **Response**:
```json
{
  "search_memories_results": { "count": 5, "results": [{ "fragment_text": "…", "score": 0.87 }], "processing_time_ms": 12 },
  "quick_facts_matching": { "count": 2, "facts": [{ "key": "birthplace", "priority": 2, "confidence": 0.92 }], "processing_time_ms": 4 },
  "performance_timing": { "search_memories_ms": 12, "quick_facts_ms": 4, "fragments_analysis_ms": 8, "total_processing_ms": 29 }
}
```

### (Dev) GET /api/debug/metrics?avatar=<uuid>
- **Purpose**: Extraction performance rollups for the last 24h.
- **Response**:
```json
[
  { "stage": "pattern", "count": 120, "p50_ms": 80,  "p95_ms": 140 },
  { "stage": "llm",     "count": 95,  "p50_ms": 950, "p95_ms": 1600 },
  { "stage": "storage", "count": 220, "p50_ms": 12,  "p95_ms": 35  },
  { "stage": "end_to_end","count": 90, "p50_ms": 1450,"p95_ms": 2400 }
]
```

## Prompt behavior
- **Fact ordering**: priority ASC, confidence DESC, updated_at DESC, key ASC.
- **Caps**:
  - **Relevant Memories**: ≈ 2500 chars
  - **Core Identity**: ≈ 1500 chars
- **Guardrails**:
  - **Missing info**: reply “I don’t have that yet.”
  - **Conflicts with quick_facts**: ask a clarifying question before updating.
