# Project Rules & Constraints

## What We ARE Doing

### ✅ **PHASE 1 – Environment & Tooling** (COMPLETE)
- ✅ ESLint & Prettier configuration
- ✅ Husky pre-commit hooks
- ✅ Vite build system
- ✅ Security vulnerability fixes

### ✅ **PHASE 3 – Robust State & Persistence Layer** (COMPLETE)
- ✅ Enhanced state management with action-based system
- ✅ Storage abstraction with localStorage + IndexedDB fallback
- ✅ State helpers and documentation

### ✅ **PHASE 4 – UI Architecture & Accessibility** (PARTIALLY COMPLETE)
- ✅ Component organization and modular structure
- ✅ Tailwind CSS with iOS-style design system
- ⚠️ Accessibility audit (optional - only if critical issues found)

### ✅ **PHASE 5 – Progressive-Web-App Hardening** (COMPLETE)
- ✅ Service Worker configuration
- ✅ Manifest and icons
- ✅ Build optimization

### ✅ **PHASE 7 – Documentation & Knowledge Sharing** (COMPLETE)
- ✅ README and coding guidelines
- ✅ Architecture documentation

## What We are NOT Doing

### ❌ **PHASE 2 – TypeScript Migration**
- **NO** TypeScript migration
- **NO** `tsconfig.json` creation
- **NO** `.ts` file conversions
- **NO** TypeScript dependencies

### ❌ **PHASE 6 – Testing Infrastructure**
- **NO** Jest/Vitest setup
- **NO** Unit test creation
- **NO** E2E testing with Playwright/Cypress
- **NO** Test scripts in CI

## Current Focus Areas

### 🔴 **CRITICAL PRIORITY** (COMPLETED)
1. ✅ Fix security vulnerabilities
2. ✅ Fix ESLint/Prettier issues
3. ✅ Re-enable lint in husky pre-commit hook

### 🟡 **HIGH PRIORITY** (Optional)
1. Accessibility audit (only if critical issues found)
2. Performance optimization (only if bundle size > 150KB)
3. Code quality improvements (unused variables, console statements)

### 🟢 **MEDIUM PRIORITY** (Optional)
1. Bundle size optimization
2. Enhanced CI/CD pipeline
3. Documentation updates

## Project Status

- **Overall Progress**: ~85% complete
- **Build Status**: ✅ Working
- **Code Quality**: ✅ Clean (all linting issues fixed)
- **Security**: ✅ Secure (vulnerabilities fixed)
- **Testing**: ❌ Not implemented (by design)
- **TypeScript**: ❌ Not implemented (by design)

## Decision Rationale

1. **No TypeScript**: The project is working well with vanilla JavaScript and the complexity of migration doesn't justify the benefits for this specific project.

2. **No Testing**: The project has been stable and the overhead of setting up testing infrastructure doesn't align with the project's current needs.

3. **Focus on Stability**: Priority is given to maintaining a working, secure, and well-formatted codebase over adding new technologies.

## Future Considerations

If the project requirements change significantly, these decisions can be revisited. For now, the focus remains on:
- Code quality and formatting
- Security and performance
- Documentation and maintainability 