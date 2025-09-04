# Factbook Kill Switch Documentation

This document describes the feature flags and kill switch system for the factbook architecture rollout.

## Overview

The factbook architecture includes a comprehensive feature flag system with runtime kill switches to ensure safe rollout and immediate fallback capabilities if issues arise.

## Environment Variables

### FACTBOOK_ENABLED
- **Default**: `true` (in demo mode)
- **Description**: Controls whether the factbook system is enabled
- **Values**: `true` | `false`

### FALLBACK_PIPELINE_ENABLED
- **Default**: `false`
- **Description**: Forces use of legacy memory system even if factbook is enabled
- **Values**: `true` | `false`

### ADMIN_API_KEY
- **Required**: Yes (for kill switch endpoint)
- **Description**: API key for accessing the kill switch endpoint
- **Example**: `your_admin_api_key_here`

## Runtime Kill Switch

The kill switch allows immediate switching between factbook and legacy memory systems without restarting the server.

### Endpoint: `/api/admin/kill-switch`

#### Authentication
All requests require the `Authorization: Bearer <ADMIN_API_KEY>` header.

#### GET - Check Status
```bash
curl -H "Authorization: Bearer your_admin_api_key" \
     http://localhost:3000/api/admin/kill-switch
```

#### POST - Execute Actions
```bash
# Disable factbook system
curl -X POST \
     -H "Authorization: Bearer your_admin_api_key" \
     -H "Content-Type: application/json" \
     -d '{"action": "disable_factbook", "reason": "Performance issues detected"}' \
     http://localhost:3000/api/admin/kill-switch

# Force fallback to legacy system
curl -X POST \
     -H "Authorization: Bearer your_admin_api_key" \
     -H "Content-Type: application/json" \
     -d '{"action": "force_fallback", "reason": "Factbook data corruption"}' \
     http://localhost:3000/api/admin/kill-switch

# Emergency disable (both flags)
curl -X POST \
     -H "Authorization: Bearer your_admin_api_key" \
     -H "Content-Type: application/json" \
     -d '{"action": "emergency_disable", "reason": "Critical issue - immediate rollback"}' \
     http://localhost:3000/api/admin/kill-switch

# Clear kill switch
curl -X POST \
     -H "Authorization: Bearer your_admin_api_key" \
     -H "Content-Type: application/json" \
     -d '{"action": "clear"}' \
     http://localhost:3000/api/admin/kill-switch
```

### Available Actions

| Action | Description | Effect |
|--------|-------------|--------|
| `disable_factbook` | Disables factbook system | Routes to legacy memory system |
| `force_fallback` | Forces fallback pipeline | Uses legacy system regardless of factbook status |
| `emergency_disable` | Both disable + fallback | Immediate complete rollback |
| `clear` | Clears kill switch | Returns to environment variable settings |

## Testing Script

Use the provided test script to verify kill switch functionality:

```bash
# Check current status
node scripts/test-kill-switch.mjs status

# Disable factbook
node scripts/test-kill-switch.mjs disable_factbook "Testing rollback procedure"

# Emergency disable
node scripts/test-kill-switch.mjs emergency_disable "Critical issue detected"

# Clear kill switch
node scripts/test-kill-switch.mjs clear
```

## Integration with Chat Route

The `/api/chat` route automatically checks feature flags at the start of each request:

1. **Feature Flag Check**: Logs current state and checks if factbook should be used
2. **Legacy Redirect**: If factbook is disabled, redirects to `/api/demo-chat` (legacy system)
3. **Fallback Handling**: If legacy system fails, continues with current system
4. **Debug Mode**: Includes feature flag status in debug responses

## Monitoring and Logging

All feature flag changes and kill switch activations are logged with structured data:

```javascript
// Kill switch activation
console.log('feature_flag_kill_switch_activated', {
  factbook_disabled: true,
  force_fallback: false,
  reason: 'Performance issues detected',
  timestamp: 1234567890
});

// Route-level feature flag checks
console.log('feature_flag_redirect_to_legacy', {
  trace_id: 'abc123',
  avatar_slug: 'jonathan_braden',
  message_preview: 'Tell me about...',
  reason: 'factbook_disabled_or_fallback_enabled'
});
```

## Safety Features

1. **Graceful Degradation**: If legacy system fails, continues with current system
2. **Immediate Effect**: Kill switch changes take effect on next request
3. **Audit Trail**: All changes are logged with timestamps and reasons
4. **Authentication**: Kill switch endpoint requires admin API key
5. **Status Visibility**: Current state always available via GET endpoint

## Rollback Procedures

### Immediate Rollback (Emergency)
```bash
curl -X POST \
     -H "Authorization: Bearer $ADMIN_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"action": "emergency_disable", "reason": "Critical issue - immediate rollback"}' \
     http://localhost:3000/api/admin/kill-switch
```

### Gradual Rollback
1. First disable factbook: `disable_factbook`
2. Monitor for issues
3. If needed, force fallback: `force_fallback`

### Recovery
```bash
# Clear kill switch to return to normal operation
curl -X POST \
     -H "Authorization: Bearer $ADMIN_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"action": "clear"}' \
     http://localhost:3000/api/admin/kill-switch
```

## Best Practices

1. **Always include reason**: Provide clear reasons for kill switch activations
2. **Monitor logs**: Watch for feature flag state changes and redirections
3. **Test regularly**: Use the test script to verify kill switch functionality
4. **Document incidents**: Keep track of when and why kill switches were used
5. **Gradual rollout**: Start with `disable_factbook`, escalate to `emergency_disable` if needed