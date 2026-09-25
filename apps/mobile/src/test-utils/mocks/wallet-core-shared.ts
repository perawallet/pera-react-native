/*
 Copyright 2022-2026 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { vi } from 'vitest'

// Mock @perawallet/wallet-core-shared
vi.mock('@perawallet/wallet-core-shared', async () => {
    // Real enum, not a hand-copied literal. It used to be duplicated here and in
    // two deeplink specs, and nothing failed if a copy fell behind — a missing
    // member just yields undefined, making TITLE_KEY_BY_CATEGORY[undefined]
    // produce t(undefined) silently. base.ts has no runtime imports, so pulling
    // it in by module path is side-effect free.
    const { ErrorCategory } = await vi.importActual<
        typeof import('@packages/shared/src/errors/base')
    >('@packages/shared/src/errors/base')

    // Same reasoning as ErrorCategory: bytes.ts has no runtime imports, so it is
    // side-effect free to pull in by path. These decode persisted byte fields —
    // a stub returning undefined would hide every note and group id under test.
    const { toBytes, decodeBytesToText } = await vi.importActual<
        typeof import('@packages/shared/src/utils/bytes')
    >('@packages/shared/src/utils/bytes')

    // urls.ts only imports plain constants, so the real origin checks are safe.
    const { originOf, isSameOrigin } = await vi.importActual<
        typeof import('@packages/shared/src/utils/urls')
    >('@packages/shared/src/utils/urls')

    // errors.ts imports only types, so the real one-line summary is safe to use.
    const { describeError } = await vi.importActual<
        typeof import('@packages/shared/src/utils/errors')
    >('@packages/shared/src/utils/errors')

    // Same reasoning again: expected.ts only imports the AppError type from
    // base.ts, so pulling in the real classifier is side-effect free. Its
    // `instanceof AppError` check targets the real class, not this mock's
    // hand-rolled one, but every caller here has already exhausted the
    // AppError/SubmissionError/NoConnectionError branches by the time it is
    // reached, so it only ever sees plain Errors.
    const { isExpectedError } = await vi.importActual<
        typeof import('@packages/shared/src/errors/expected')
    >('@packages/shared/src/errors/expected')

    // Real money math, not a stub: unit-conversion.ts imports only constants
    // and decimal-config. Blockchain re-exports these from shared, so a spec
    // that spreads the actual blockchain module resolves them through here.
    const unitConversion = await vi.importActual<
        typeof import('@packages/shared/src/utils/unit-conversion')
    >('@packages/shared/src/utils/unit-conversion')

    // Mirrors packages/shared/src/errors/base.ts: the metadata defaulting, the
    // third `originalError` argument, and the instance members consumers reach
    // for (`timestamp`, `toJSON`, `isMinor`, `shouldReport`). `name` comes from
    // `this.constructor.name` exactly as production does — subclass names are
    // load-bearing, both for the integration tests that assert on them and for
    // sanitizeErrorForWebview's relay allowlist.
    type AppErrorMetadata = {
        severity: string
        category: string
        messageKey?: string
        titleKey?: string
        params?: Record<string, unknown>
        recoverable: boolean
        retryable: boolean
    }

    class AppError extends Error {
        public readonly metadata: AppErrorMetadata
        public readonly originalError?: Error
        public readonly timestamp: Date

        constructor(
            message: string,
            metadata: Partial<AppErrorMetadata> = {},
            originalError?: Error,
        ) {
            super(message)
            this.name = this.constructor.name
            this.originalError = originalError
            this.timestamp = new Date()
            this.metadata = {
                severity: 'medium',
                category: 'unknown',
                recoverable: true,
                retryable: false,
                ...metadata,
            }
        }

        isMinor(): boolean {
            return this.metadata.severity === 'low'
        }

        // HIGH or CRITICAL only — deliberately NOT `!isMinor()`, which would
        // report every MEDIUM error.
        shouldReport(): boolean {
            return (
                this.metadata.severity === 'high' ||
                this.metadata.severity === 'critical'
            )
        }

        toJSON(): Record<string, unknown> {
            return {
                name: this.name,
                message: this.message,
                metadata: this.metadata,
                timestamp: this.timestamp,
                stack: this.stack,
                originalError: this.originalError?.message,
            }
        }
    }

    // Mirrors packages/shared/src/errors/network.ts — kept minimal but
    // faithful to the real `kind` taxonomy and key-mapping switch so tests
    // exercising PeraNetworkError get realistic behavior from the mock.
    // severity/retryable mirror SEVERITY_BY_KIND / RETRYABLE_BY_KIND in the
    // real module, so a test asserting retryability on a network error is
    // asserting against production behaviour rather than fiction.
    const RETRYABLE_BY_KIND: Record<string, boolean> = {
        offline: true,
        timeout: true,
        server: true,
        client: false,
        unknown: false,
    }
    const SEVERITY_BY_KIND: Record<string, string> = {
        offline: 'medium',
        timeout: 'medium',
        server: 'medium',
        client: 'low',
        unknown: 'medium',
    }

    class InputTooLargeError extends AppError {
        constructor(
            public readonly label: string,
            public readonly limit: number,
            public readonly actual: number,
        ) {
            super(`${label} exceeds maximum size (${actual} > ${limit})`, {
                severity: 'low',
                category: 'validation',
            })
            this.name = 'InputTooLargeError'
        }
    }

    class PeraNetworkError extends AppError {
        public readonly kind: string
        public readonly status?: number

        constructor(
            kind: string,
            {
                status,
                originalError,
            }: { status?: number; originalError?: Error } = {},
        ) {
            super(
                `[network:${kind}]`,
                {
                    severity: SEVERITY_BY_KIND[kind] ?? 'medium',
                    category: 'network',
                    retryable: RETRYABLE_BY_KIND[kind] ?? false,
                },
                originalError,
            )
            this.kind = kind
            this.status = status
        }
    }

    // Mirrors packages/shared/src/errors/network.ts's NoConnectionError.
    // Declared here (rather than only in the returned object below) so
    // getNetworkErrorMessageKeys can reference it.
    class NoConnectionError extends AppError {
        constructor() {
            super('No network connection found', {
                severity: 'high',
                category: 'network',
                retryable: true,
            })
        }
    }

    const isPeraNetworkError = (error: unknown): error is PeraNetworkError =>
        error instanceof PeraNetworkError

    // Mirrors packages/shared/src/errors/pera-service.ts. Thrown by the
    // request layer for a network with no Pera deployment (betanet, custom);
    // the crash-reporting sites in QueryProvider branch on the guard below.
    class PeraServiceUnavailableError extends AppError {
        public readonly network: string

        constructor(network: string) {
            super(`Pera services are not deployed for ${network}`, {
                severity: 'low',
                category: 'network',
                retryable: false,
                recoverable: false,
                messageKey: 'errors.pera_service.unavailable',
                params: { network },
            })
            this.network = network
        }
    }

    const isPeraServiceUnavailableError = (
        error: unknown,
    ): error is PeraServiceUnavailableError =>
        error instanceof PeraServiceUnavailableError

    // `ky` isn't a direct dependency of apps/mobile, so this mirrors ky's
    // isNetworkError predicate structurally (same name check used by
    // isTransientNetworkError above) instead of importing the real module.
    const isConnectivityError = (error: unknown): boolean => {
        if (isPeraNetworkError(error)) return error.kind === 'offline'
        if (error instanceof NoConnectionError) return true
        return (error as { name?: string } | null)?.name === 'NetworkError'
    }

    const keysFor = (base: string): { titleKey: string; bodyKey: string } => ({
        titleKey: `${base}.title`,
        bodyKey: `${base}.body`,
    })

    const getNetworkErrorMessageKeys = (
        error: unknown,
    ): { titleKey: string; bodyKey: string } => {
        if (error instanceof NoConnectionError) {
            return keysFor('errors.network.no_connection')
        }

        if (!isPeraNetworkError(error)) return keysFor('errors.general')

        switch (error.kind) {
            case 'offline': {
                return keysFor('errors.network.no_connection')
            }
            case 'timeout': {
                return keysFor('errors.network.timeout')
            }
            case 'server': {
                return keysFor('errors.api.server_error')
            }
            case 'client': {
                if (error.status === 404) return keysFor('errors.api.not_found')
                if (error.status === 401 || error.status === 403) {
                    return keysFor('errors.api.unauthorized')
                }
                return keysFor('errors.api.generic')
            }
            default: {
                return keysFor('errors.general')
            }
        }
    }

    return {
        ALGO_ASSET_ID: '0',
        ALGO_ASSET_NAME: 'ALGO',
        ALGO_DECIMALS: 6,
        ...unitConversion,
        isAlgoAssetId: (assetId: string | number | bigint) =>
            String(assetId) === '0',
        isAlgoAssetName: (value: string) => value === 'ALGO',
        displayCurrencyToAssetId: (code: string) =>
            code === 'ALGO' ? '0' : null,
        logger: {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        },
        // Real implementations — package schemas evaluate uint64IdSchema at
        // import time, so it must be a genuine zod schema.
        uint64IdSchema: (await import('zod')).z
            .union([
                (await import('zod')).z.number().int().nonnegative(),
                (await import('zod')).z.string().regex(/^\d+$/),
            ])
            .transform(String),
        uint64IdNumberSchema: (await import('zod')).z
            .number()
            .int()
            .nonnegative(),
        // Same reason — the card response schemas evaluate httpsUrlSchema at
        // import time. Taken from the module itself rather than hand-copied:
        // it imports only zod, so pulling it in by path is side-effect free.
        httpsUrlSchema: (
            await vi.importActual<
                typeof import('@packages/shared/src/api/schemas')
            >('@packages/shared/src/api/schemas')
        ).httpsUrlSchema,
        uint64IdToNumber: (id: string | number) => {
            if (typeof id === 'string' && id.trim() === '') {
                throw new RangeError(
                    'Cannot convert empty string to a uint64 id',
                )
            }
            const value = typeof id === 'number' ? id : Number(id)
            if (!Number.isSafeInteger(value) || value < 0) {
                throw new RangeError(
                    `Cannot represent uint64 id "${id}" exactly as a JS number`,
                )
            }
            return value
        },
        truncateAlgorandAddress: vi.fn(a => a),
        // Real checksum validation — contactSchema gates its address rule on
        // it, so a constant stub would make every form-validity assertion
        // meaningless.
        isValidAlgorandAddress: (
            await vi.importActual<
                typeof import('@packages/shared/src/utils/addresses')
            >('@packages/shared/src/utils/addresses')
        ).isValidAlgorandAddress,
        SHORT_ADDRESS_LENGTH: 11,
        LONG_ADDRESS_LENGTH: 20,
        dedupeSecondaryLabel: (primary: string, secondary?: string | null) =>
            secondary && secondary !== primary ? secondary : undefined,
        // Faithful to the real impl — useReturnToDapp builds browser-scheme
        // URLs from the stripped host+path, so an identity stub would leave
        // the https:// prefix embedded in the assertion targets.
        stripUrlScheme: vi.fn((url?: string) => {
            if (!url) return url
            const index = url.indexOf('//')
            return index >= 0 ? url.substring(index + 2) : url
        }),
        originOf,
        isSameOrigin,
        // Real implementations — serialized route params round-trip through
        // these, so a stub would silently corrupt every public key fixture.
        hexToBytes: (hex: string): Uint8Array => {
            const bytes = new Uint8Array(hex.length / 2)
            for (let i = 0; i < hex.length; i += 2) {
                bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
            }
            return bytes
        },
        bytesToHex: (bytes: Uint8Array): string =>
            Array.from(bytes)
                .map(b => b.toString(16).padStart(2, '0'))
                .join(''),
        toBytes,
        decodeBytesToText,
        // Must mirror the real constant (packages/shared/src/models/constants.ts).
        // The precision policy reads this, so a wrong value silently invalidates
        // every precision/formatting assertion.
        DEFAULT_PRECISION: 2,
        ZERO_DECIMAL: new (require('decimal.js').Decimal)(0),
        ALGO_EXPLORER_URL: 'https://explorer.perawallet.app',
        Networks: {
            mainnet: 'mainnet',
            testnet: 'testnet',
            betanet: 'betanet',
            custom: 'custom',
        },
        // Must mirror packages/shared/src/models/base-types.ts — period pills
        // render from this list, so a missing member silently drops a pill.
        HISTORY_PERIODS: ['one-day', 'one-week', 'one-month', 'one-year'],
        formatDatetime: vi.fn(d => String(d)),
        formatRelativeTime: vi.fn(d => String(d)),
        formatTimeRemaining: vi.fn(() => '52m'),
        formatCurrency: vi.fn(
            (value, _decimals, currency) => `${currency || '$'}${value}`,
        ),
        formatWithUnits: vi.fn(value => String(value)),
        formatNumber: vi.fn(value => String(value)),
        formatPercentage: vi.fn(
            (value: { toFixed: (p: number) => string }, precision = 2) =>
                `${value.toFixed(precision)}%`,
        ),
        // i18n/index.ts calls setActiveLocale at import time — any spec that
        // transitively imports it needs this mock to include the export.
        getActiveLocale: vi.fn(() => 'en'),
        setActiveLocale: vi.fn(),
        generateUniqueId: vi.fn(() => 'mock-uuid'),
        generateOrderedUniqueId: vi.fn(() => 'mock-time-uuid'),
        encodeToBase64: (bytes: Uint8Array) =>
            Buffer.from(bytes).toString('base64'),
        decodeFromBase64: (value: string) =>
            new Uint8Array(Buffer.from(value, 'base64')),
        // The mock replaces the module wholesale, so anything a package parser
        // reaches for has to be listed here or it reads as undefined and the
        // parser rejects valid input. bounds.ts pulls in strings.ts and its
        // decimal/locale/logging chain, which is why these are mirrored rather
        // than imported. They throw a plain Error: nothing outside bounds.ts's
        // own spec tests for InputTooLargeError, and both parsers catch every
        // throw.
        InputTooLargeError,
        assertMaxLength: (value: string, maxChars: number, label: string) => {
            if (value.length > maxChars) {
                throw new InputTooLargeError(label, maxChars, value.length)
            }
        },
        decodeBoundedBase64: (
            base64: string,
            maxBytes: number,
            label = 'base64 input',
        ) => {
            const bytes = new Uint8Array(Buffer.from(base64, 'base64'))
            if (bytes.length > maxBytes) {
                throw new InputTooLargeError(label, maxBytes, bytes.length)
            }
            return bytes
        },
        toError: vi.fn((e: unknown) =>
            e instanceof Error ? e : new Error(String(e)),
        ),
        describeError,
        isPromiseLike: (value: unknown) =>
            typeof value === 'object' &&
            value !== null &&
            'then' in value &&
            typeof value.then === 'function',
        // Mirrors the real semantics (packages/shared/src/utils/async.ts):
        // reject with rejectWith(operation, ms) after `ms`, clear the timer
        // when the promise settles. Ledger timeout tests drive this with
        // fake timers, so it must be a genuine implementation.
        withTimeout: <T>(
            promise: Promise<T>,
            ms: number,
            operation: string,
            rejectWith?: (operation: string, ms: number) => Error,
        ): Promise<T> => {
            let timerId: ReturnType<typeof setTimeout> | undefined
            return new Promise<T>((resolve, reject) => {
                timerId = setTimeout(() => {
                    reject(
                        rejectWith
                            ? rejectWith(operation, ms)
                            : new Error(`${operation} timed out after ${ms}ms`),
                    )
                }, ms)
                promise.then(resolve, reject)
            }).finally(() => {
                if (timerId !== undefined) clearTimeout(timerId)
            })
        },
        // Mirrors the real semantics (packages/shared/src/api/query-client.ts):
        // timeouts, network errors, and 5xx HTTPErrors are transient. ky's own
        // guards match on error name, so name checks are faithful here.
        isTransientNetworkError: (error: unknown): boolean => {
            const e = error as {
                name?: string
                response?: { status?: number }
            } | null
            if (!e) return false
            if (e.name === 'TimeoutError' || e.name === 'NetworkError')
                return true
            return e.name === 'HTTPError' && (e.response?.status ?? 0) >= 500
        },
        AppError,
        PeraNetworkError,
        isPeraNetworkError,
        PeraServiceUnavailableError,
        isPeraServiceUnavailableError,
        isConnectivityError,
        getNetworkErrorMessageKeys,
        messageKeysFor: keysFor,
        ErrorSeverity: {
            LOW: 'low',
            MEDIUM: 'medium',
            HIGH: 'high',
            CRITICAL: 'critical',
        },
        ErrorCategory,
        useClearAllData: vi.fn(() => vi.fn().mockResolvedValue(undefined)),
        registerStore: vi.fn(),
        clearAllStores: vi.fn(),
        resetStoreRegistry: vi.fn(),
        getStoreRegistry: vi.fn(() => []),
        registerAccountCleanup: vi.fn(),
        runAccountCleanups: vi.fn().mockResolvedValue(undefined),
        resetAccountCleanupRegistry: vi.fn(),
        getAccountCleanupRegistry: vi.fn(() => []),
        createPersistStorage: () => ({
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
        }),
        buildPrismUrl: vi.fn((url: string, width: number) =>
            url ? `${url}?width=${width}&quality=70` : undefined,
        ),
        getInitials: vi.fn((label: string, maxLetters: number = 2) => {
            const words = label.trim().split(/\s+/)
            if (words.length >= maxLetters) {
                return words
                    .slice(0, maxLetters)
                    .map((w: string) => w[0])
                    .join('')
                    .toUpperCase()
            }
            if (words.length === 1 && words[0].length > 0) {
                return words[0][0].toUpperCase()
            }
            return '?'
        }),
        useDebouncedValue: <T>(value: T) => value,
        // OFF-004 mutation policy. `mutationDefaults` is read at module-eval
        // time by QueryProvider, so it must be a real object (not a vi.fn).
        // Mirrors packages/shared/src/api/mutation-policy.ts.
        mutationDefaults: { throwOnError: false, networkMode: 'always' },
        assertOnline: vi.fn(),
        NoConnectionError,
        isExpectedError,
        setIntegrityTokenProvider: vi.fn(),
        readIntegrityToken: vi.fn(() => null),
    }
})
