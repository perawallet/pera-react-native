/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import { withoutTests } from '../shared/scope.js'

type AllowedImport = {
    file: string
    specifier: string
    reason: string
}

// Matched by path suffix, so an entry pins one file and one specifier. Every
// entry is a native module with no platform-service equivalent.
const ALLOWED: readonly AllowedImport[] = [
    {
        file: 'packages/kms/src/crypto/pq/falconModule.native.ts',
        specifier: '@joe-p/react-native-falcon',
        reason: 'The on-device Falcon-1024 provider is this Nitro module; the .native twin keeps it off web.',
    },
    {
        file: 'packages/kms/src/crypto/pq/falconModule.ts',
        specifier: '@joe-p/react-native-falcon',
        reason: 'Off-device twin of falconModule.native.ts; the lazy require never runs off-device.',
    },
    {
        file: 'packages/passkeys/src/bootstrap/bootstrapPasskeyAutofill.ts',
        specifier: '@algorandfoundation/react-native-keystore',
        reason: "Reads the native autofill module's keystore envelope, which has no provider API.",
    },
    {
        file: 'packages/passkeys/src/native/readFlaggedPasskeyCredentials.ts',
        specifier: '@algorandfoundation/react-native-keystore',
        reason: "Reads the native autofill module's keystore envelope, which has no provider API.",
    },
    {
        file: 'packages/migrate/src/migrate/passkeys/writeNativePasskeyEntry.ts',
        specifier: '@algorandfoundation/react-native-keystore',
        reason: "Writes into the native autofill module's keystore envelope, which has no provider API.",
    },
]

const packageNameOf = (specifier: string): string => {
    const parts = specifier.split('/')
    return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

const isNativeName = (name: string): boolean =>
    name === 'react-native' ||
    name.startsWith('react-native-') ||
    name === 'expo' ||
    name.startsWith('expo-')

// Bare react-native/expo packages, anything under the @react-native, @react-native-community
// style or @expo scopes, and a scoped package named react-native-* or expo-*.
const isReactNativeSpecifier = (specifier: string): boolean => {
    if (specifier.startsWith('.')) return false
    const pkg = packageNameOf(specifier)
    if (!pkg.startsWith('@')) return isNativeName(pkg)
    const [scope, name = ''] = pkg.split('/')
    return (
        scope === '@react-native' ||
        scope.startsWith('@react-native-') ||
        scope === '@expo' ||
        isNativeName(name)
    )
}

export default defineRule({
    id: 'pera/no-react-native-imports-in-packages',
    severity: 'error',
    card: {
        message: 'packages/* must reach the platform through getProvider()',
        remediation:
            'Use the platform service that covers it on getProvider() (deviceInfo.getDevicePlatform() for Platform.OS, appLifecycle for AppState, keystoreSubtle for quick-crypto), or add one to PlatformServices in extensions/platform with an implementation in platform-react-native and platform-chrome. A native module with no possible service equivalent goes on the ALLOWED list in this rule with a one-line reason. Type-only imports count too.',
        examples: {
            bad: "import { Platform } from 'react-native'",
            good: "import { getProvider } from '@perawallet/wallet-extension-provider'\nconst isIOS = getProvider().deviceInfo.getDevicePlatform() === 'ios'",
        },
    },
    gates: withoutTests({
        pathMatches: ['**/packages/*/src/**'],
    }),
    // Every form that creates the dependency: static, `export … from`, a
    // deferred `import()` and a CommonJS `require`.
    query: `
        (import_statement (string (string_fragment) @src) @str)
        (export_statement (string (string_fragment) @src) @str)
        (call_expression
          function: (import)
          arguments: (arguments (string (string_fragment) @src) @str))
        (call_expression
          function: (identifier) @fn
          arguments: (arguments (string (string_fragment) @src) @str))
    `,
    check(ctx, m) {
        const src = m.src
        const str = m.str
        if (src === undefined || str === undefined) return
        if (m.fn !== undefined && ctx.text(m.fn) !== 'require') return

        const specifier = ctx.text(src)
        if (specifier === undefined || !isReactNativeSpecifier(specifier)) {
            return
        }

        const pkg = packageNameOf(specifier)
        const isAllowed = ALLOWED.some(
            entry =>
                ctx.filePath.endsWith(entry.file) && entry.specifier === pkg,
        )
        if (isAllowed) return

        ctx.report(
            str,
            `${specifier} is a React Native dependency; reach the platform through getProvider()`,
        )
    },
})
