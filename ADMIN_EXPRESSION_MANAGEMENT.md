# Admin Expression Management for Jonathan Demo

This document explains how to use the admin expression management system for the `jonathan-demo` avatar, implemented as part of task 10 of the Authentic Expressions Pipeline.

## Overview

The admin expression management system allows administrators to upload and manage expression clips specifically for demo avatars like `jonathan-demo`. These admin expressions have higher priority than user expressions and are used exclusively for demo avatars.

## Key Features

### 1. Avatar-Specific Expression Assignment
- Admin expressions are assigned to specific avatars using `owner_type='avatar'` and `owner_key='jonathan-demo'`
- Demo avatars use only admin expressions, not user expressions
- Regular users continue to use their own user expressions

### 2. Priority System
- **Admin expressions**: Priority 50-100 (higher priority)
- **User expressions**: Priority 0-49 (lower priority)
- Higher priority expressions are more likely to be selected during conversations
- Admin expressions are always preferred over user expressions when both match

### 3. Expression Types Supported
- **Laugh** (😄): Natural laughter sounds
- **Sigh** (😔): Thoughtful or contemplative sighs  
- **Breath** (💨): Natural breathing sounds
- **Affirmation** (✅): Agreement sounds like "mm-hmm"
- **Greeting** (👋): Hello or hey sounds
- **Catchphrase** (💬): Personal expressions
- **Filler** (🤔): Thinking sounds like "um" or "uh"

## Admin Interface

### Accessing the Admin Panel
Navigate to: `/admin/expressions/jonathan-demo`

The admin panel provides three main functions:

#### 1. Manage Expressions Tab
- View all expressions for the jonathan-demo avatar
- See statistics: total expressions, active/inactive counts, average priority
- Type distribution showing count by expression type
- Bulk operations: select multiple expressions and activate/deactivate
- Individual controls: play preview, adjust priority, toggle status, delete
- Pagination for large expression libraries

#### 2. Single Upload Tab
- Upload individual expression files for the avatar
- Set expression type, priority (0-100), tone, and placement hints
- Supports MP3, WAV, M4A, AAC, OGG formats (max 5MB)
- Admin expressions default to priority 50

#### 3. Bulk Upload Tab
- Upload ZIP files containing multiple expressions with manifest
- Requires a `manifest.json` file describing each expression
- Processes multiple files efficiently
- Shows detailed results with success/error counts

## Bulk Upload Format

### ZIP File Structure
```
jonathan-expressions.zip
├── manifest.json
├── jonathan_laugh_cheerful.mp3
├── jonathan_sigh_thoughtful.mp3
├── jonathan_breath_natural.mp3
└── ... (other audio files)
```

### Manifest.json Format
```json
{
  "packName": "Jonathan Demo Expression Pack",
  "version": "1.0.0",
  "avatarId": "jonathan-demo",
  "expressions": [
    {
      "filename": "jonathan_laugh_cheerful.mp3",
      "type": "laugh",
      "tone": "cheerful",
      "placementHints": ["funny", "joke", "humor"],
      "priority": 70
    },
    {
      "filename": "jonathan_sigh_thoughtful.mp3",
      "type": "sigh",
      "tone": "thoughtful",
      "placementHints": ["unfortunately", "sadly"],
      "priority": 60
    }
  ]
}
```

### Example Manifest
A complete example manifest is available at: `/public/examples/jonathan-demo-expressions-manifest.json`

## API Endpoints

### Admin Single Upload
```
POST /api/expressions/admin/upload
Content-Type: multipart/form-data

Fields:
- file: Audio file
- avatarId: "jonathan-demo"
- type: Expression type
- priority: 0-100 (optional, defaults to 50)
- tone: Descriptive tone (optional)
- placementHints: JSON array of keywords (optional)
```

### Admin Bulk Upload
```
POST /api/expressions/admin/bulk-upload
Content-Type: multipart/form-data

Fields:
- zipFile: ZIP file with manifest and audio files
- avatarId: "jonathan-demo"
- packName: Name for the expression pack
- version: Version string (e.g., "1.0.0")
```

### Admin Avatar Management
```
GET /api/expressions/admin/avatars/jonathan-demo
- List all expressions for the avatar
- Includes statistics and type distribution

PATCH /api/expressions/admin/avatars/jonathan-demo
- Bulk update multiple expressions
- Body: { updates: [{ id, status?, priority?, tone?, placement_hints? }] }

DELETE /api/expressions/admin/avatars/jonathan-demo?confirm=true
- Delete all expressions for avatar (requires confirmation)
- Optional: &type=laugh to delete only specific type
```

## Priority System Details

### Expression Selection Logic
1. **Admin expressions** (priority ≥ 50) are evaluated first
2. **User expressions** (priority < 50) are evaluated second
3. Within each group, higher priority expressions are preferred
4. Maximum 2 overlays per conversation turn
5. Minimum 4-second spacing between expressions
6. No duplicate expression types in the same turn

### Priority Recommendations
- **Signature expressions**: 80-100 (unique to the avatar)
- **Primary expressions**: 60-79 (main personality expressions)
- **Secondary expressions**: 50-59 (supporting expressions)
- **Background expressions**: 40-49 (subtle, infrequent)

## Runtime Behavior

### Demo Avatar Expression Loading
- Demo avatars (containing "demo" in ID) automatically load admin expressions
- Regular users load their own user expressions
- No mixing between admin and user expressions for the same conversation

### Expression Scheduling
- Text analysis identifies appropriate expression types
- Priority-based selection chooses the best matching expressions
- Timing ensures expressions don't delay TTS start
- Audio mixing applies 3-6dB ducking during expression playback

### Graceful Degradation
- System continues normal TTS operation if expressions fail to load
- Network failures don't block conversation flow
- Feature can be disabled via `FEATURE_VOICE_OVERLAYS=false`

## Best Practices

### Audio File Guidelines
- **Duration**: Keep expressions under 3 seconds for natural flow
- **Quality**: Use consistent audio quality across all expressions
- **Volume**: Normalize loudness levels for consistent playback
- **Format**: MP3 at 22.05kHz mono is recommended for optimal performance

### Priority Assignment
- Reserve high priorities (80+) for signature expressions unique to the avatar
- Use medium priorities (60-79) for primary personality expressions
- Keep background expressions (breath, filler) at lower priorities (40-59)
- Leave room for future additions by not using every priority level

### Placement Hints
- Use specific, relevant keywords that match natural conversation
- Include variations and synonyms for better matching
- Keep hint lists focused (5-10 keywords maximum)
- Test expressions with actual conversation content

## Monitoring and Maintenance

### Expression Analytics
The system tracks:
- Expression usage frequency by type
- Performance impact on TTS timing
- User engagement with expressive avatars
- Error rates and fallback behavior

### Regular Maintenance
- Review expression performance and update priorities
- Add new expressions based on conversation patterns
- Remove or update expressions that don't fit well
- Monitor storage usage and optimize file sizes

## Troubleshooting

### Common Issues
1. **Expressions not playing**: Check feature flag `FEATURE_VOICE_OVERLAYS=true`
2. **Wrong expressions selected**: Verify avatar ID and priority settings
3. **Upload failures**: Check file format, size limits, and manifest syntax
4. **Performance issues**: Reduce number of active expressions or file sizes

### Debug Information
- Check browser console for expression loading errors
- Verify API responses for expression metadata
- Test individual expressions using the preview functionality
- Monitor network requests for CDN delivery issues

## Security Considerations

### Access Control
- Admin endpoints should be protected by authentication
- File uploads are validated for type and size
- CDN URLs use public access but are not easily guessable
- Expression metadata is stored securely in the database

### Content Validation
- Audio files are processed and validated before storage
- Manifest files are parsed and validated for security
- File size limits prevent abuse
- Expression content should be appropriate for the avatar's use case

---

This admin expression management system ensures that demo avatars like `jonathan-demo` have high-quality, curated expressions that enhance the user experience while maintaining clear separation from user-generated content.