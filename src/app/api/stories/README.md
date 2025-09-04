# Stories API

The Stories API provides endpoints for managing authentic voice stories in the EchoStone avatar system.

## Feature Flag

The Stories API is gated behind the `STORIES_ENABLED` feature flag. Set `STORIES_ENABLED=true` in your environment variables to enable the API.

## Endpoints

### GET /api/stories

Retrieve stories for a user or avatar.

**Query Parameters:**
- `avatarId` (required): The ID of the avatar or user
- `ownerType` (optional): Either 'avatar' or 'user' (defaults to 'avatar')

**Response:**
```json
{
  "success": true,
  "stories": [
    {
      "id": "story-123",
      "title": "My Childhood Memory",
      "category": "memory",
      "triggers": ["childhood", "school", "friends"],
      "duration": 45000,
      "audioUrl": "https://cdn.example.com/stories/story-123.mp3",
      "transcript": "When I was seven years old...",
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

**Rate Limiting:** 100 requests per minute per IP

### POST /api/stories

Upload and create a new story.

**Authentication:** Required (Bearer token or session cookie)

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `file` (required): MP3 audio file (max 10MB, 30s-5min duration)
- `title` (required): Story title
- `category` (required): One of 'memory', 'experience', 'advice', 'anecdote'
- `triggers` (required): Comma-separated trigger keywords (max 20)
- `transcript` (optional): Text transcript of the story
- `avatarId` (optional): Avatar ID (if not provided, story belongs to user)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "story-123",
    "title": "My Childhood Memory",
    "category": "memory",
    "triggers": ["childhood", "school", "friends"],
    "duration": 45000,
    "audioUrl": "https://cdn.example.com/stories/story-123.mp3",
    "transcript": "When I was seven years old...",
    "status": "active",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

**Rate Limiting:** 10 uploads per hour per IP

## Error Responses

All endpoints return errors in the following format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

**Common Error Codes:**
- `400`: Bad Request (missing required fields, invalid data)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (access denied, limits exceeded)
- `404`: Not Found (feature disabled)
- `413`: Payload Too Large (file size exceeded)
- `415`: Unsupported Media Type (invalid file format)
- `429`: Too Many Requests (rate limit exceeded)
- `500`: Internal Server Error

## Rate Limiting

The API includes rate limiting to prevent abuse:

- **GET requests**: 100 per minute per IP
- **POST requests**: 10 per hour per IP

Rate limit information is included in response headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: Timestamp when the rate limit resets

## Story Limits

- Maximum 5 stories per avatar
- Audio files: 30 seconds to 5 minutes duration
- File size: Maximum 10MB
- Trigger keywords: Maximum 20 per story
- Supported format: MP3 only

## Authentication

The API supports two authentication methods:

1. **Bearer Token**: Include `Authorization: Bearer <token>` header
2. **Session Cookie**: Browser-based authentication via cookies

## Example Usage

### JavaScript/Fetch

```javascript
// Get stories for an avatar
const response = await fetch('/api/stories?avatarId=avatar-123');
const data = await response.json();

// Upload a new story
const formData = new FormData();
formData.append('file', audioFile);
formData.append('title', 'My Story');
formData.append('category', 'memory');
formData.append('triggers', 'childhood,school,friends');
formData.append('avatarId', 'avatar-123');

const uploadResponse = await fetch('/api/stories', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token
  },
  body: formData
});
```

### cURL

```bash
# Get stories
curl "http://localhost:3000/api/stories?avatarId=avatar-123"

# Upload story
curl -X POST "http://localhost:3000/api/stories" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@story.mp3" \
  -F "title=My Story" \
  -F "category=memory" \
  -F "triggers=childhood,school,friends" \
  -F "avatarId=avatar-123"
```

## Testing

Run the test suite:
```bash
npm test -- src/app/api/stories/__tests__/route.simple.test.ts --run
```

Manual API testing:
```bash
node test-stories-api.js
```