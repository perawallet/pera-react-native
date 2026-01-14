---
trigger: always_on
---

# TypeScript Patterns

## Type Definitions

```typescript
// Use type for unions and simple shapes
type AccountType = 'standard' | 'multisig' | 'ledger'
type LoadingState = 'idle' | 'loading' | 'success' | 'error'

// Use interface when extension is expected
interface WalletAccount {
    id: string
    address: string
    name: string
    type: AccountType
}

// Props should use type
type AccountCardProps = {
    account: WalletAccount
    isSelected?: boolean
    onPress?: () => void
}
```

## Avoid `any`

```typescript
// ❌ BAD
const data: any = fetchData()

// ✅ GOOD
const data: unknown = fetchData()
if (isValidData(data)) {
    // data is now typed
}

// ✅ BETTER: Define the type
interface ApiResponse {
    accounts: WalletAccount[]
}
const data: ApiResponse = await fetchData()
```

## Boolean Props

```typescript
// ✅ GOOD: Clear boolean naming
type Props = {
    isLoading: boolean
    isDisabled: boolean
    hasError: boolean
    canSubmit: boolean
    shouldAutoFocus: boolean
}

// ❌ BAD: Ambiguous
type Props = {
    loading: boolean
    disabled: boolean
    error: boolean
}
```

## Event Handlers

```typescript
// Props use "on" prefix
type Props = {
    onPress: () => void
    onSubmit: (data: FormData) => void
    onChange: (value: string) => void
}

// Internal handlers use "handle" prefix
const MyComponent = ({ onSubmit }: Props) => {
    const handleSubmit = () => {
        // Process and validate
        onSubmit(data)
    }
}
```
