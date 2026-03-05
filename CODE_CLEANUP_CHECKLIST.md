"""
🧹 CODE CLEANUP & MAINTAINABILITY CHECKLIST

Dokumen ini berisi best practices dan daftar periksa untuk membuat kode lebih 
mudah di-maintain, scalable, dan berkualitas tinggi.

═════════════════════════════════════════════════════════════════════════════
FRONTEND CODE QUALITY CHECKLIST
═════════════════════════════════════════════════════════════════════════════

[ ] ORGANIZATION
    [ ] Extract magic numbers/strings ke constants file
        - CURRENCIES = ['USD', 'EUR', ...]
        - DEFAULT_QUANTITY = 1
        - VALIDATION_RULES = {...}
    
    [ ] Create types/interfaces file
        - ItemDraft, ParticipantDraft, etc
        - BillFormState, CreateBillPayload
    
    [ ] Split large components (>300 lines)
        - Create separate step components
        - Use custom hooks untuk state management
        - Extract render logic ke functions
    
    [ ] Group related files
        - /constants - billConstants.ts
        - /types - bill.ts, payment.ts
        - /utils - billValidation.ts, billCalculations.ts
        - /hooks - useBillForm.ts, useBillCalculation.ts
        - /components - BillForm.tsx, BillReview.tsx

[ ] CODE STYLE & CONVENTIONS
    [ ] Add JSDoc comments untuk functions
        /**
         * Descripsi function
         * @param param1 - description
         * @returns return description
         */
    
    [ ] Add console.log cleanup
        - Remove debug logs sebelum push
        - Use conditional logging untuk development
    
    [ ] Consistent naming
        - camelCase untuk variables, functions
        - PascalCase untuk components, types
        - UPPER_CASE untuk constants
    
    [ ] Remove unused imports
        - Check dengan "Organize Imports" di VSCode
        - Use import analyzer tools
    
    [ ] Consistent formatting
        - Use Prettier untuk auto-format
        - Configure ESLint rules
        - Run before each commit

[ ] VALIDATION & ERROR HANDLING
    [ ] Centralize validation logic
        - ✓ Move ke billValidation.ts
        - Add specific error messages
        - Test edge cases
    
    [ ] Add proper error boundaries
        - Wrap screens dalam try-catch
        - Show user-friendly error messages
        - Log errors untuk debugging
    
    [ ] Input validation
        - Validate setiap user input
        - Show error messages near field
        - Disable submit jika invalid

[ ] PERFORMANCE
    [ ] Optimize re-renders
        - Use useCallback untuk functions
        - Use useMemo untuk expensive calculations
        - Profile dengan React DevTools
    
    [ ] Lazy load components
        - Split code dengan dynamic imports
        - Use React.lazy() untuk routes
    
    [ ] Remove memory leaks
        - Cleanup effects dengan dependency arrays
        - Clear timeouts/intervals
        - Unsubscribe dari listeners

[ ] STATE MANAGEMENT
    [ ] Use custom hooks untuk complex state
        - ✓ Created useBillForm.ts
        - Encapsulate related state
        - Provide clean API untuk components
    
    [ ] Avoid prop drilling
        - Use context untuk shared state
        - Consider state management library jika besar
    
    [ ] Keep state minimal
        - Only store necessary data
        - Compute derived values
        - Use local state untuk UI state

[ ] TESTING
    [ ] Add unit tests
        - billValidation.ts - test each validation
        - billCalculations.ts - test calculations
        - Component tests - test interactions
    
    [ ] Mock API calls
        - Use MSW untuk API mocking
        - Test error scenarios
        - Test loading states
    
    [ ] Test edge cases
        - Empty inputs
        - Very large numbers
        - Special characters
        - Multiple rapid clicks

═════════════════════════════════════════════════════════════════════════════
BACKEND CODE QUALITY CHECKLIST
═════════════════════════════════════════════════════════════════════════════

[ ] ORGANIZE FILE STRUCTURE
    [ ] Split server.py into modules
        - config.py - constants, settings
        - models.py - Pydantic models
        - middleware.py - middleware classes
        - dependencies.py - auth, helpers
        - routes/ - endpoint definitions
        - services/ - business logic
    
    [ ] Separate concerns
        - Routes = HTTP handling only
        - Services = Business logic
        - Models = Data validation
        - Config = Settings and constants

[ ] CODE STYLE & CONVENTIONS
    [ ] Add docstrings ke functions
        def get_user(user_id: str) -> Optional[dict]:
            \"\"\"
            Get user by ID.
            
            Args:
                user_id: The user's unique identifier
                
            Returns:
                User document or None if not found
            \"\"\"
    
    [ ] Type hints everywhere
        - Function arguments
        - Return types
        - Variable annotations (complex types)
    
    [ ] Consistent naming
        - snake_case untuk variables, functions
        - UPPER_CASE untuk constants
        - PascalCase untuk classes
    
    [ ] Remove unused imports
        - Use autoimport tools
        - Clean before commits
    
    [ ] Max line length = 100 characters
        - Better readability
        - Easier on small screens

[ ] CONFIGURATION MANAGEMENT
    [ ] Move hardcoded values to config.py
        - PLAN_LIMITS = {...}
        - RATE_LIMIT_CONFIG = {...}
        - PORT, HOST settings
        - Database name
    
    [ ] Use environment variables
        - Sensitive data (API keys, DB URL)
        - Per-environment settings
        - Load from .env file
    
    [ ] Separate dev/prod configs
        - Different logging levels
        - Different timeouts
        - Different rate limits

[ ] ERROR HANDLING
    [ ] Create custom exceptions
        class BillNotFoundError(Exception):
            pass
        
        class InsufficientPermissionError(Exception):
            pass
    
    [ ] Use proper HTTP status codes
        - 200 OK - success
        - 400 Bad Request - client error
        - 401 Unauthorized - auth failed
        - 403 Forbidden - no permission
        - 404 Not Found - resource missing
        - 500 Internal Server Error - server bug
    
    [ ] Add detailed error logging
        - Log input data
        - Log stack traces
        - Log decision points
        - Use correlation IDs untuk tracing

[ ] VALIDATION
    [ ] Validate all inputs
        - Use Pydantic models
        - Add field validators
        - Check length, type, range
    
    [ ] Sanitize user data
        - Strip whitespace
        - Prevent SQL injection (use parameterized)
        - Escape output
    
    [ ] Authorization checks
        - Verify user owns resource
        - Check plan limits
        - Validate permissions

[ ] DATABASE
    [ ] Use parameterized queries
        - Prevent SQL injection
        - Always use ORM/driver features
    
    [ ] Add database indexes
        - Index frequently queried fields
        - Index foreign keys
        - Test query performance
    
    [ ] Handle connection pooling
        - Reuse connections
        - Set timeouts
        - Handle reconnection
    
    [ ] Add database migrations
        - Version control schema
        - Track changes
        - Support rollbacks

[ ] LOGGING
    [ ] Structured logging
        - JSON format untuk parsing
        - Include context (user_id, bill_id, etc)
        - Include timestamps
    
    [ ] Appropriate log levels
        - DEBUG - detailed info
        - INFO - important events
        - WARNING - dangerous but recoverable
        - ERROR - something went wrong
        - CRITICAL - system is broken
    
    [ ] Don't log sensitive data
        - No passwords
        - No API keys
        - No full credit cards
        - Mask PII data

[ ] PERFORMANCE
    [ ] Database query optimization
        - Use indexes
        - Avoid N+1 queries
        - Use projections (select needed fields only)
        - Monitor slow queries
    
    [ ] Caching strategy
        - Cache expensive calculations
        - Cache exchange rates (not live)
        - Add cache invalidation
        - Set TTLs
    
    [ ] Rate limiting
        - Protect against abuse
        - Different limits per endpoint
        - Different limits per user tier

[ ] TESTING
    [ ] Unit tests
        - Test services independently
        - Test validation functions
        - Test calculations
    
    [ ] Integration tests
        - Test endpoints with mocked DB
        - Test error scenarios
        - Test authentication
    
    [ ] API documentation
        - Use OpenAPI/Swagger
        - Document all endpoints
        - Include examples
        - Document error codes

═════════════════════════════════════════════════════════════════════════════
GENERAL BEST PRACTICES
═════════════════════════════════════════════════════════════════════════════

CODE REVIEW CHECKLIST:

Before merging code, check:
□ Does it follow project conventions?
□ Are variables/functions named clearly?
□ Any magic numbers or hardcoded values?
□ Is there proper error handling?
□ Are there security issues?
□ Any memory leaks or performance issues?
□ Does it have tests?
□ Is documentation updated?
□ Does it have comments explaining WHY, not WHAT?

DOCUMENTATION

□ README - How to setup and run
□ Architecture docs - High-level design
□ API docs - Endpoint documentation
□ Database schema - Table structure
□ Deployment guide - How to deploy
□ Contributing guide - How to contribute

COMMIT BEST PRACTICES

Good commit message:
```
chore: extract constants to billConstants.ts

- Move CURRENCIES array
- Move VALIDATION_RULES object
- Move DEFAULT_* constants

Refactor #123
```

Bad commit message:
```
fix stuff
```

NAMING PATTERNS

Arrays/Collections:
items, participants, currencies, bills

Booleans:
isLoading, isValid, hasError, canProceed, userNameAdded

Objects:
user, bill, participant, item

Functions that return booleans:
validateTitle(), isUserNameInParticipants(), hasPermission()

Functions that do things:
addItem(), removeParticipant(), calculateTotal()

Constants:
DEFAULT_CURRENCY, MAX_ITEMS, PLAN_LIMITS

═════════════════════════════════════════════════════════════════════════════
QUICK WINS TO IMPLEMENT NOW
═════════════════════════════════════════════════════════════════════════════

Priority 1 (Do Today):
1. ✓ Create billConstants.ts - extract magic strings
2. ✓ Create bill.ts types - centralize interfaces
3. ✓ Create billValidation.ts - extract validation logic
4. ✓ Create billCalculations.ts - extract calculations
5. ✓ Create useBillForm hook - extract state logic

Priority 2 (This Week):
1. Create backend config.py - extract PLAN_LIMITS
2. Create backend models.py - extract Pydantic models
3. Add JSDoc comments to 80%+ of functions
4. Setup ESLint + Prettier for frontend
5. Setup Black + isort for backend

Priority 3 (This Month):
1. Split backend routes into separate files
2. Create services layer untuk business logic
3. Add unit tests (20% code coverage)
4. Add API documentation (Swagger/OpenAPI)
5. Create database migration system

═════════════════════════════════════════════════════════════════════════════
TOOLS TO USE
═════════════════════════════════════════════════════════════════════════════

Frontend:
- ESLint - linting (find bugs)
- Prettier - formatting (auto-fix style)
- TypeScript - type safety
- Jest - unit testing
- React Testing Library - component testing

Backend:
- Black - code formatter
- isort - import organizer
- pylint/flake8 - linting
- mypy - type checking
- pytest - unit testing
- Coverage.py - test coverage

═════════════════════════════════════════════════════════════════════════════

NEXT STEPS:

1. Review the files created:
   - frontend/constants/billConstants.ts
   - frontend/types/bill.ts
   - frontend/utils/billValidation.ts
   - frontend/utils/billCalculations.ts
   - frontend/hooks/useBillForm.ts

2. Read the refactoring guide:
   - REFACTORING_GUIDE.md (how to update create-bill.tsx)
   - BACKEND_REFACTORING_PLAN.md (backend structure)

3. Implement gradually:
   - Don't rush
   - Test as you go
   - Commit frequently
   - Get code review

4. Document as you go:
   - Add comments explaining decisions
   - Update README jika perlu
   - Keep changelog updated
"""
