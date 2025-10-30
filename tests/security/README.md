# Security Tests

## 📋 Overview

This directory contains security-focused tests for the Cliprace platform, including:
- Row Level Security (RLS) policy validation
- Bearer authentication enforcement
- Rate limiting enforcement
- Audit logging tests

## 🧪 Test Suites

### RLS Profiles Tests (`rls-profiles.test.ts`)

**Purpose**: Verify that RLS policies correctly enforce access control based on `auth.uid()`.

**Coverage**:
- ✅ Profile creation/update with correct user_id
- ✅ Prevention of cross-user profile manipulation
- ✅ Creator-specific profile policies
- ✅ Brand-specific profile policies
- ✅ Helper function validation (resolve_user_role, is_creator, is_brand)

**Requirements**:
- Live Supabase instance
- Environment variables set:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Run**:
```bash
npm run test tests/security/rls-profiles.test.ts
```

**Note**: Tests are skipped if environment variables are not set.

### CSRF Shim Tests (`csrf.spec.ts`)

**Purpose**: Ensure the legacy CSRF helpers behave as no-ops during the bearer-only transition.

**Coverage**:
- ✅ POST requests without CSRF header remain valid
- ✅ GET requests remain valid

**Run**:
```bash
npm run test tests/security/csrf.spec.ts
```

### Rate Limit Tests (`rate-limit.spec.ts`)

**Purpose**: Ensure rate limiting works correctly to prevent abuse.

**Coverage**:
- ✅ Allow requests within rate limit
- ✅ Block requests exceeding rate limit
- ✅ Rate limit reset after window expires
- ✅ Different endpoints with different limits
- ✅ Rate limit statistics tracking
- ✅ Concurrent requests handling
- ✅ Invalid endpoints handling
- ✅ Multiple cookies preservation (new)

**Run**:
```bash
npm run test tests/security/rate-limit.spec.ts
```

### Audit Logs Tests (`audit-logs.test.ts`)

**Purpose**: Verify that security-critical actions are properly logged.

**Run**:
```bash
npm run test tests/security/audit-logs.test.ts
```

## 🔍 RLS Compliance

See [RLS_COMPLIANCE_REPORT.md](./RLS_COMPLIANCE_REPORT.md) for a comprehensive analysis of:
- Active RLS policies
- Helper function implementations
- SignupWizard Step3 compliance
- Security guarantees
- Test coverage matrix

## 🚀 Running All Security Tests

```bash
# Run all security tests
npm run test tests/security/

# Run with coverage
npm run test -- --coverage tests/security/

# Run in watch mode during development
npm run test -- --watch tests/security/
```

## 🔧 Setup for RLS Tests

### 1. Local Supabase Instance

```bash
# Install Supabase CLI
npm install -g supabase

# Start local instance
supabase start

# Apply migrations
supabase db push
```

### 2. Environment Variables

Create a `.env.test` file:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. Run Tests

```bash
npm run test tests/security/rls-profiles.test.ts
```

## 📊 Test Results Interpretation

### ✅ Success Indicators

- All policies correctly enforce `auth.uid()`
- Cross-user operations are blocked
- Helper functions return correct values
- Role-based access control works

### ❌ Failure Scenarios

If tests fail, check:

1. **Migrations Applied**: Ensure all RLS migrations are applied
2. **Environment Variables**: Verify database connection
3. **User State**: Test users may exist from previous runs
4. **RLS Enabled**: Confirm RLS is enabled on tables

```sql
-- Check RLS status
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
AND tablename IN ('profiles', 'profiles_creator', 'profiles_brand');

-- Should show rowsecurity = true for all
```

## 🛡️ Security Best Practices

### When Writing New Tests

1. **Always test negative cases**: Verify that unauthorized operations fail
2. **Use real authentication**: Don't mock auth.uid() in RLS tests
3. **Clean up test data**: Remove test users in afterAll()
4. **Test edge cases**: Empty strings, nulls, special characters
5. **Document expectations**: Clear comments on what should/shouldn't work

### When Adding New Features

1. **Create RLS policies first**: Security before functionality
2. **Write security tests**: Validate policies before deployment
3. **Use auth.uid() consistently**: Never trust client-provided IDs
4. **Audit log critical actions**: Track who did what when
5. **Rate limit endpoints**: Prevent abuse

## 📚 Additional Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [Cliprace Security Implementation](../../SECURITY-IMPLEMENTATION.md)

## 🆘 Troubleshooting

### Tests Skip Due to Missing Environment

**Problem**: Tests are skipped with message "no database connection available"

**Solution**:
```bash
# Check environment variables
echo $SUPABASE_SERVICE_ROLE_KEY

# If empty, source your .env file
source .env.test

# Or export manually
export SUPABASE_SERVICE_ROLE_KEY=your_key_here
```

### RLS Policy Violations

**Problem**: Tests fail with "row-level security policy" errors

**Solution**:
1. Check that migrations are applied: `supabase db push`
2. Verify RLS is enabled: `SELECT * FROM pg_tables WHERE rowsecurity = true`
3. Review policy definitions in migration files
4. Ensure JWT tokens are valid and not expired

### Test User Conflicts

**Problem**: "User already exists" errors

**Solution**:
```bash
# Clean up test users before running
npm run test:cleanup

# Or manually via service role
DELETE FROM auth.users WHERE email LIKE 'test-%';
```

## 📝 Contributing

When adding security tests:

1. Follow existing test structure
2. Add documentation to this README
3. Update RLS_COMPLIANCE_REPORT.md if adding RLS policies
4. Ensure tests pass locally before committing
5. Consider adding tests to CI/CD pipeline

---

**Last Updated**: 2025-10-10  
**Maintainer**: Security Team  
**Contact**: security@cliprace.com

