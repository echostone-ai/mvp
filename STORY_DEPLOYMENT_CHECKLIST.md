# Authentic Voice Stories - Deployment Checklist and Rollback Procedures

## Pre-Deployment Checklist

### 1. Code Quality and Testing
- [ ] All unit tests pass (`npm run test`)
- [ ] Integration tests pass (`npm run test:integration`)
- [ ] End-to-end tests pass (`npm run test:e2e`)
- [ ] Performance tests meet requirements (`npm run test:performance`)
- [ ] Mobile compatibility tests pass (`npm run test:mobile`)
- [ ] Code coverage > 80% for story-related modules
- [ ] TypeScript compilation successful with no errors
- [ ] ESLint passes with no errors or warnings
- [ ] Security scan passes (no high/critical vulnerabilities)

### 2. Database and Schema
- [ ] Database migration `025_create_user_stories_tables.sql` tested on staging
- [ ] Database indexes created and optimized
- [ ] Story storage constraints validated (5 stories per avatar)
- [ ] Analytics tables created and functional
- [ ] Database backup completed before deployment
- [ ] Migration rollback script prepared and tested

### 3. Feature Flags and Configuration
- [ ] `STORIES_ENABLED` feature flag configured (default: `false`)
- [ ] Per-avatar story settings functional
- [ ] Feature flag rollback tested
- [ ] Environment variables configured:
  - [ ] `STORIES_ENABLED=false` (initial deployment)
  - [ ] `STORY_CDN_URL` configured
  - [ ] `STORY_UPLOAD_LIMIT_MB=10`
  - [ ] `STORY_MAX_DURATION_MS=300000`
  - [ ] `STORY_MIN_DURATION_MS=30000`

### 4. Performance Validation
- [ ] Trigger matching latency < 100ms p95 ✓
- [ ] Story loading time < 2s p95 ✓
- [ ] TTS baseline performance unchanged ✓
- [ ] Memory usage within mobile limits ✓
- [ ] CDN response times < 500ms globally
- [ ] Database query performance optimized

### 5. Security and Privacy
- [ ] File upload validation implemented
- [ ] Audio file virus scanning enabled
- [ ] MIME type validation functional
- [ ] User authorization checks in place
- [ ] Rate limiting configured
- [ ] CORS policies updated for story endpoints
- [ ] Data encryption at rest verified
- [ ] Privacy settings functional

### 6. Monitoring and Observability
- [ ] Story metrics dashboard deployed
- [ ] Performance monitoring alerts configured
- [ ] Error tracking for story operations
- [ ] CDN monitoring enabled
- [ ] Database performance monitoring
- [ ] User analytics tracking functional

### 7. Documentation and Training
- [ ] API documentation updated
- [ ] User guide for story creation completed
- [ ] Admin documentation for story management
- [ ] Troubleshooting guide prepared
- [ ] Support team trained on new features

## Deployment Steps

### Phase 1: Infrastructure Deployment (Feature Disabled)
1. **Deploy Database Changes**
   ```bash
   # Run migration on production database
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f supabase/migrations/025_create_user_stories_tables.sql
   
   # Verify migration success
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\d user_stories"
   ```

2. **Deploy Application Code**
   ```bash
   # Deploy with stories disabled
   export STORIES_ENABLED=false
   npm run build
   npm run deploy:production
   ```

3. **Verify Infrastructure**
   - [ ] Database tables created successfully
   - [ ] API endpoints respond (but return disabled status)
   - [ ] No impact on existing functionality
   - [ ] Monitoring dashboards show normal metrics

### Phase 2: Gradual Feature Enablement
1. **Enable for Internal Testing**
   ```bash
   # Enable for specific test avatars
   UPDATE avatars SET story_enabled = true WHERE id IN ('test-avatar-1', 'test-avatar-2');
   ```

2. **Monitor Initial Usage**
   - [ ] Story upload functionality works
   - [ ] Trigger matching performs within SLA
   - [ ] Audio playback functions correctly
   - [ ] No performance degradation observed

3. **Enable for Beta Users**
   ```bash
   # Enable for beta user group
   export STORIES_ENABLED=true
   # Update feature flag in admin panel
   ```

4. **Full Production Rollout**
   ```bash
   # Enable globally after successful beta
   UPDATE system_settings SET stories_enabled = true;
   ```

## Monitoring During Deployment

### Key Metrics to Watch
1. **Performance Metrics**
   - TTS start latency (should remain < 600ms p50)
   - Story trigger matching time (< 100ms p95)
   - Story loading time (< 2s p95)
   - Overall conversation response time

2. **Error Rates**
   - Story upload failures
   - Audio loading errors
   - Trigger matching failures
   - Database query errors

3. **Resource Usage**
   - Database CPU and memory
   - CDN bandwidth usage
   - Application server resources
   - Mobile client memory usage

4. **User Experience**
   - Story creation success rate
   - Story playback success rate
   - User engagement with stories
   - Support ticket volume

### Monitoring Commands
```bash
# Check story system health
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.echostone.com/admin/story-health

# Monitor performance metrics
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.echostone.com/admin/story-metrics

# Check database performance
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "
  SELECT 
    COUNT(*) as total_stories,
    AVG(duration_ms) as avg_duration,
    COUNT(*) FILTER (WHERE status = 'active') as active_stories
  FROM user_stories;
"
```

## Rollback Procedures

### Level 1: Feature Flag Rollback (Immediate - 30 seconds)
**When to use:** Performance issues, high error rates, user complaints

```bash
# Disable stories globally via feature flag
export STORIES_ENABLED=false

# Or via admin API
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"stories_enabled": false}' \
  https://api.echostone.com/admin/feature-flags
```

**Verification:**
- [ ] Story endpoints return "disabled" status
- [ ] No story processing occurs
- [ ] TTS performance returns to baseline
- [ ] No user-facing errors

### Level 2: Code Rollback (5-10 minutes)
**When to use:** Critical bugs, security issues, data corruption

```bash
# Rollback to previous deployment
git checkout $PREVIOUS_RELEASE_TAG
npm run build
npm run deploy:production

# Verify rollback
curl https://api.echostone.com/health
```

**Verification:**
- [ ] Application returns to previous version
- [ ] All story-related code disabled
- [ ] Database remains intact
- [ ] No data loss occurred

### Level 3: Database Rollback (15-30 minutes)
**When to use:** Database corruption, migration issues, data integrity problems

```bash
# Rollback database migration
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f rollback_025_user_stories.sql

# Restore from backup if necessary
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME $BACKUP_FILE
```

**Verification:**
- [ ] Database schema reverted
- [ ] No orphaned data
- [ ] Application functions normally
- [ ] Data integrity maintained

### Level 4: Full System Rollback (30-60 minutes)
**When to use:** Complete system failure, multiple component issues

```bash
# Complete rollback procedure
./scripts/full-rollback.sh $PREVIOUS_RELEASE_TAG

# Includes:
# - Code rollback
# - Database rollback
# - CDN cache purge
# - Configuration reset
```

## Post-Rollback Procedures

### Immediate Actions (0-15 minutes)
1. **Verify System Stability**
   - [ ] All core functionality working
   - [ ] Performance metrics normal
   - [ ] Error rates back to baseline
   - [ ] User experience unaffected

2. **Communication**
   - [ ] Notify stakeholders of rollback
   - [ ] Update status page if necessary
   - [ ] Inform support team
   - [ ] Document rollback reason

### Short-term Actions (15 minutes - 2 hours)
1. **Root Cause Analysis**
   - [ ] Identify rollback trigger
   - [ ] Analyze logs and metrics
   - [ ] Document findings
   - [ ] Create incident report

2. **Data Verification**
   - [ ] Verify no data loss
   - [ ] Check user account integrity
   - [ ] Validate avatar functionality
   - [ ] Confirm story data if preserved

### Long-term Actions (2+ hours)
1. **Issue Resolution**
   - [ ] Fix identified problems
   - [ ] Update tests to prevent regression
   - [ ] Improve monitoring/alerting
   - [ ] Plan re-deployment strategy

2. **Process Improvement**
   - [ ] Update deployment procedures
   - [ ] Enhance testing coverage
   - [ ] Improve rollback automation
   - [ ] Update documentation

## Emergency Contacts

### Technical Team
- **Primary On-Call Engineer:** [Contact Info]
- **Database Administrator:** [Contact Info]
- **DevOps Lead:** [Contact Info]
- **Security Team:** [Contact Info]

### Business Team
- **Product Manager:** [Contact Info]
- **Customer Success:** [Contact Info]
- **Executive Sponsor:** [Contact Info]

## Rollback Decision Matrix

| Issue Severity | Response Time | Rollback Level | Approval Required |
|---------------|---------------|----------------|-------------------|
| P0 - System Down | Immediate | Level 1-2 | On-call Engineer |
| P1 - Major Feature Broken | < 15 min | Level 1-2 | Engineering Lead |
| P2 - Performance Degradation | < 30 min | Level 1 | Product Manager |
| P3 - Minor Issues | < 2 hours | Level 1 | Product Manager |

## Success Criteria for Re-deployment

Before attempting re-deployment after rollback:

### Technical Requirements
- [ ] Root cause identified and fixed
- [ ] Additional tests added for failure scenario
- [ ] Code review completed for fixes
- [ ] Staging environment validates fix
- [ ] Performance tests pass with margin

### Process Requirements
- [ ] Incident post-mortem completed
- [ ] Deployment plan updated
- [ ] Monitoring enhanced
- [ ] Team alignment on go/no-go criteria

### Business Requirements
- [ ] Stakeholder approval for re-deployment
- [ ] Customer communication plan ready
- [ ] Support team prepared
- [ ] Rollback procedures validated

## Automated Rollback Triggers

The system includes automated rollback triggers for critical scenarios:

```javascript
// Example monitoring rules
const ROLLBACK_TRIGGERS = {
  tts_latency_p95: 1200, // ms - 33% degradation from baseline
  story_error_rate: 0.05, // 5% error rate
  database_cpu: 0.90, // 90% CPU usage
  memory_usage: 0.85, // 85% memory usage
  response_time_p95: 2000 // ms - overall response time
};
```

These triggers will automatically disable the stories feature flag if thresholds are exceeded for more than 5 minutes.