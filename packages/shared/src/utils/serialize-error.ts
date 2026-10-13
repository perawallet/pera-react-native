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

// A native stack is bulk: uncapped, it pushes the `code`/`cause` keys that
// diagnose a keystore failure out of Crashlytics' truncation window. The top of
// the stack is the diagnostic part, in either shape RN might hand us.
const MAX_NATIVE_STACK_FRAMES = 10
const MAX_NATIVE_STACK_CHARS = 2000

const capNativeStack = (nativeStack: unknown): unknown => {
    if (Array.isArray(nativeStack))
        return nativeStack.slice(0, MAX_NATIVE_STACK_FRAMES)
    if (typeof nativeStack === 'string')
        return nativeStack.slice(0, MAX_NATIVE_STACK_CHARS)
    return nativeStack
}

// Wrapped re-throws are normal in this codebase (useAlgo25.ts, useHDWallet.ts,
// useCreateAccount.ts), so the cause chain can be several Errors deep. The cap
// bounds recursion regardless of shape, including a mutual cycle (x.cause = y,
// y.cause = x) that a same-node self-reference check wouldn't catch; the
// separate `cause !== error` check only stops a self-referential Error from
// emitting a redundant copy of itself as its own cause.
const MAX_CAUSE_DEPTH = 3

export type SerializeErrorOptions = {
    /**
     * Every field copied off the error goes through this, named by its
     * property key, so no field can reach the output unscrubbed. Supplied by
     * the caller rather than imported, because the redaction walker is itself
     * a caller.
     */
    redactField: (key: string, value: unknown) => unknown
    /**
     * `diagnostic` is an allowlist: name, message, `code`, the cause chain, and
     * at the root only, the JS and native stacks. Arbitrary own properties
     * (ky's `request`/`options`, a leaked secret) never appear.
     *
     * `ownProperties` emits name, message and every own enumerable property.
     * No `stack` (it is non-enumerable), and a `cause` only when it was
     * assigned rather than passed to the constructor.
     */
    fields: 'diagnostic' | 'ownProperties'
}

const serializeDiagnostic = (
    error: Error,
    redactField: SerializeErrorOptions['redactField'],
    depth: number,
): Record<string, unknown> => {
    // React-native-keychain rejections put the only discriminating value on
    // `code` (E_CRYPTO_FAILED vs E_KEYSTORE_ACCESS_ERROR), and the keystore
    // package wraps engine failures in `cause`; without both, every Android
    // keystore failure looks identical.
    const code = (error as { code?: unknown }).code
    // RN's PromiseImpl/JavaTurboModule copies this onto the JS Error as an
    // array of frame maps (class/file/line/method), never a string.
    const nativeStack = (error as { nativeStackAndroid?: unknown })
        .nativeStackAndroid

    // Key order is load-bearing: JSON.stringify emits insertion order and
    // Crashlytics truncates the report, so the diagnostic keys precede the two
    // bulky stacks.
    return {
        name: redactField('name', error.name),
        message: redactField('message', error.message),
        ...(typeof code === 'string' || typeof code === 'number'
            ? { code: redactField('code', code) }
            : {}),
        ...(error.cause !== undefined &&
        error.cause !== error &&
        depth < MAX_CAUSE_DEPTH
            ? {
                  cause:
                      error.cause instanceof Error
                          ? serializeDiagnostic(
                                error.cause,
                                redactField,
                                depth + 1,
                            )
                          : redactField('cause', error.cause),
              }
            : {}),
        // Both stacks are root-only: a nested one crowds out the sibling
        // code/cause keys that diagnose this class of bug, for no diagnostic
        // gain of its own.
        ...(typeof error.stack === 'string' && depth === 0
            ? { stack: redactField('stack', error.stack) }
            : {}),
        ...(nativeStack !== undefined && depth === 0
            ? {
                  nativeStackAndroid: redactField(
                      'nativeStackAndroid',
                      capNativeStack(nativeStack),
                  ),
              }
            : {}),
    }
}

const serializeOwnProperties = (
    error: Error,
    redactField: SerializeErrorOptions['redactField'],
): Record<string, unknown> => {
    const out: Record<string, unknown> = {
        name: redactField('name', error.name),
        message: redactField('message', error.message),
    }
    for (const [key, value] of Object.entries(error)) {
        // Capped but never dropped: unlike `diagnostic`'s root-only gate, this
        // shape is only used for nested errors, where a gate would drop every
        // native stack it ever sees.
        out[key] = redactField(
            key,
            key === 'nativeStackAndroid' ? capNativeStack(value) : value,
        )
    }
    return out
}

/**
 * Turns an Error into a plain, JSON-safe object for a log line. Redaction is
 * delegated to `redactField`; this module only decides which fields exist.
 * Throwing accessors propagate, so the caller decides what an unreadable
 * error costs.
 */
export const serializeError = (
    error: Error,
    { redactField, fields }: SerializeErrorOptions,
): Record<string, unknown> =>
    fields === 'diagnostic'
        ? serializeDiagnostic(error, redactField, 0)
        : serializeOwnProperties(error, redactField)
