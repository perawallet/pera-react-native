---
trigger: always_on
---

# Code Patterns Index

This is the index of code patterns for the Pera Wallet mobile app. Each pattern file focuses on a specific area.

## Pattern Files

| Pattern              | File                     | When to Use                                   |
| -------------------- | ------------------------ | --------------------------------------------- |
| Components & Styling | `component-patterns.md`  | Creating UI components, styles                |
| Hooks                | `hook-patterns.md`       | Query, Mutation, Store, component logic hooks |
| State Management     | `store-patterns.md`      | Zustand stores, state access                  |
| TypeScript           | `typescript-patterns.md` | Types, interfaces, naming                     |
| JSDoc                | `jsdoc-patterns.md`      | Documentation comments for public APIs        |
| Testing              | `testing-patterns.md`    | Writing tests                                 |
| Anti-Patterns        | `anti-patterns.md`       | What NOT to do                                |

## Quick Reference

### Import Order

```typescript
// 1. React/React Native
import React, { useState, useEffect, useCallback } from 'react'
import { View, ActivityIndicator } from 'react-native'

// 2. Third-party libraries
import { useQuery } from '@tanstack/react-query'
import { Text } from '@rneui/themed'

// 3. Internal packages (@perawallet/*)
import { useAllAccounts } from '@perawallet/wallet-core-accounts'
import { logger } from '@perawallet/wallet-core-shared'

// 4. App aliases (@components, @hooks, etc.)
import { PWButton } from '@components/core'
import { useToast } from '@hooks/toast'

// 5. Relative imports
import { useStyles } from './styles'
import type { MyComponentProps } from './types'
```
