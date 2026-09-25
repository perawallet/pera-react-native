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

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
    deserializeCreateOptions,
    deserializeGetOptions,
    serializeCredential,
    type RawAttestationResponse,
} from '@perawallet/wallet-core-passkeys/webauthn'
import {
    WEBAUTHN_CHANNEL_HANDSHAKE_EVENT,
    WEBAUTHN_CHANNEL_RELAY_READY_EVENT,
} from '../channel'

const toBuffer = (text: string): ArrayBuffer =>
    new TextEncoder().encode(text).buffer as ArrayBuffer

const CREATE_OPTIONS: CredentialCreationOptions = {
    publicKey: {
        rp: { name: 'Example' },
        user: {
            id: toBuffer('user-1'),
            name: 'alice',
            displayName: 'Alice',
        },
        challenge: toBuffer('challenge'),
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    },
}

const GET_OPTIONS: CredentialRequestOptions = {
    publicKey: {
        challenge: toBuffer('challenge'),
    },
}

// Installs a fresh module instance with a fake native CredentialsContainer
// stubbed onto `navigator` BEFORE import, so the module's top-level
// stash-before-wrap runs against the fake, not jsdom's (nonexistent) real
// CredentialsContainer. Returns the fake calls + the installed module.
const freshModule = async () => {
    const origCreate = vi.fn(async () => ({ id: 'native-create' }) as unknown)
    const origGet = vi.fn(async () => ({ id: 'native-get' }) as unknown)
    vi.stubGlobal('navigator', {
        credentials: { create: origCreate, get: origGet },
    })
    const mod = await import('../webauthn-main')
    return { mod, origCreate, origGet }
}

// Stubs a fake relay on the request channel: captures every dispatched
// request and lets the test script a canned response (or none, to simulate
// a dead SW / timeout).
const stubRelay = (
    mod: Awaited<ReturnType<typeof freshModule>>['mod'],
    respond: (request: unknown) => unknown | undefined,
) => {
    const seen: unknown[] = []
    const handler = (e: Event) => {
        const { id, request } = (e as CustomEvent).detail
        seen.push(request)
        const response = respond(request)
        if (response === undefined) return // simulate no response (dead SW)
        window.dispatchEvent(
            new CustomEvent(
                mod.installWebauthnInterception.__responseEventName,
                {
                    detail: { id, response },
                },
            ),
        )
    }
    window.addEventListener(
        mod.installWebauthnInterception.__requestEventName,
        handler,
    )
    return { seen }
}

describe('webauthn-main provider', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.useRealTimers()
    })

    it('stashes the native create/get before wrapping, and a decline falls through to them with their own outcome', async () => {
        const { mod, origCreate } = await freshModule()
        stubRelay(mod, () => ({ decline: true }))

        const result = await navigator.credentials!.create!(CREATE_OPTIONS)

        expect(origCreate).toHaveBeenCalledTimes(1)
        expect(origCreate).toHaveBeenCalledWith(CREATE_OPTIONS)
        expect(result).toEqual({ id: 'native-create' })
        void mod
    })

    it('delegates get() to the original immediately for conditional mediation, without touching the relay channel', async () => {
        const { mod, origGet } = await freshModule()
        const { seen } = stubRelay(mod, () => ({ decline: true }))

        const options: CredentialRequestOptions = {
            ...GET_OPTIONS,
            mediation: 'conditional',
        }
        const result = await navigator.credentials!.get!(options)

        expect(seen).toEqual([])
        expect(origGet).toHaveBeenCalledTimes(1)
        expect(origGet).toHaveBeenCalledWith(options)
        expect(result).toEqual({ id: 'native-get' })
    })

    it('delegates get() to the original immediately when there is no publicKey option', async () => {
        const { mod, origGet } = await freshModule()
        const { seen } = stubRelay(mod, () => ({ decline: true }))

        const result = await navigator.credentials!.get!({})

        expect(seen).toEqual([])
        expect(origGet).toHaveBeenCalledTimes(1)
        expect(result).toEqual({ id: 'native-get' })
    })

    it('delegates create() to the original immediately when there is no publicKey option', async () => {
        const { mod, origCreate } = await freshModule()
        const { seen } = stubRelay(mod, () => ({ decline: true }))

        const result = await navigator.credentials!.create!({})

        expect(seen).toEqual([])
        expect(origCreate).toHaveBeenCalledTimes(1)
        expect(result).toEqual({ id: 'native-create' })
    })

    it('serializes a normal create() call and sends it to the relay with the real frame origin', async () => {
        const { mod, origCreate } = await freshModule()
        const { seen } = stubRelay(mod, () => ({ decline: true }))

        await navigator.credentials!.create!(CREATE_OPTIONS)

        expect(seen.length).toBe(1)
        const request = seen[0] as {
            kind: string
            origin: string
            options: { challenge: string; user: { name: string } }
        }
        expect(request.kind).toBe('create')
        expect(request.origin).toBe(location.origin)
        expect(request.options.user.name).toBe('alice')
        expect(typeof request.options.challenge).toBe('string')
        // The relay declined (canned response above), so the fall-through
        // path still reaches the stashed original afterward.
        expect(origCreate).toHaveBeenCalledTimes(1)
    })

    it('serializes a normal get() call and sends it to the relay', async () => {
        const { mod } = await freshModule()
        const { seen } = stubRelay(mod, () => ({ decline: true }))

        await navigator.credentials!.get!(GET_OPTIONS)

        expect(seen.length).toBe(1)
        expect((seen[0] as { kind: string }).kind).toBe('get')
    })

    // Wire-compatibility guard: webauthn-main.ts deliberately reimplements a
    // minimal base64url codec + serialize functions rather than importing
    // @perawallet/wallet-core-passkeys/webauthn at runtime (see the
    // BUNDLE-SIZE NOTE at the top of webauthn-main.ts). These two tests
    // round-trip its output through the REAL package's deserialize
    // functions (safe to import here — this is Node/vitest, not the shipped
    // browser bundle) to catch any future drift between the two codecs.
    it('serializes create() options that round-trip byte-for-byte through the real package codec', async () => {
        const { mod } = await freshModule()
        const { seen } = stubRelay(mod, () => ({ decline: true }))

        await navigator.credentials!.create!(CREATE_OPTIONS)

        const request = seen[0] as {
            options: Parameters<typeof deserializeCreateOptions>[0]
        }
        const roundTripped = deserializeCreateOptions(request.options)
        expect(
            new TextDecoder().decode(roundTripped.challenge as ArrayBuffer),
        ).toBe('challenge')
        expect(
            new TextDecoder().decode(roundTripped.user.id as ArrayBuffer),
        ).toBe('user-1')
        expect(roundTripped.user.name).toBe('alice')
    })

    it('serializes get() options that round-trip byte-for-byte through the real package codec', async () => {
        const { mod } = await freshModule()
        const { seen } = stubRelay(mod, () => ({ decline: true }))

        await navigator.credentials!.get!(GET_OPTIONS)

        const request = seen[0] as {
            options: Parameters<typeof deserializeGetOptions>[0]
        }
        const roundTripped = deserializeGetOptions(request.options)
        expect(
            new TextDecoder().decode(roundTripped.challenge as ArrayBuffer),
        ).toBe('challenge')
    })

    it('rejects with the matching native DOMException on an authenticator-level error, WITHOUT falling through to native', async () => {
        // A true authenticator error (e.g. InvalidStateError from
        // excludeCredentials matching a real Pera credential) must reject
        // with that exact error — falling through here would let the
        // platform authenticator mint a duplicate the RP tried to exclude.
        const { mod, origCreate } = await freshModule()
        stubRelay(mod, () => ({ error: 'InvalidStateError' }))

        await expect(
            navigator.credentials!.create!(CREATE_OPTIONS),
        ).rejects.toMatchObject({
            name: 'InvalidStateError',
        })
        expect(origCreate).not.toHaveBeenCalled()
    })

    it('rejects a get() with the matching native DOMException on an authenticator-level error too', async () => {
        const { mod, origGet } = await freshModule()
        stubRelay(mod, () => ({ error: 'NotAllowedError' }))

        await expect(
            navigator.credentials!.get!(GET_OPTIONS),
        ).rejects.toMatchObject({ name: 'NotAllowedError' })
        expect(origGet).not.toHaveBeenCalled()
    })

    it('falls through to the original — without throwing a Pera-internal error — when the page passes malformed options that throw during serialization', async () => {
        const { mod, origCreate } = await freshModule()
        const { seen } = stubRelay(mod, () => ({ decline: true }))

        // Missing `user` entirely: serializeCreateOptions's `options.user.id`
        // access throws a plain TypeError synchronously, before the relay is
        // ever reached — this must never surface as a rejection, it must
        // fall straight through to the stashed original with the SAME
        // (malformed) options, exactly as if this file didn't exist.
        const malformedOptions = {
            publicKey: {
                rp: { name: 'Example' },
                challenge: toBuffer('challenge'),
                pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
            },
        } as unknown as CredentialCreationOptions

        const result = await navigator.credentials!.create!(malformedOptions)

        expect(seen).toEqual([]) // never reached the relay at all
        expect(origCreate).toHaveBeenCalledTimes(1)
        expect(origCreate).toHaveBeenCalledWith(malformedOptions)
        expect(result).toEqual({ id: 'native-create' })
    })

    it('falls through to the original when the relay answers with a malformed "success" payload', async () => {
        const { mod, origCreate } = await freshModule()
        // A credential response missing its response fields entirely —
        // reconstructCredential must not throw a Pera-internal error at the
        // page; it should fall through to native instead.
        stubRelay(mod, () => ({
            credential: {
                id: 'x',
                rawId: 'x',
                type: 'public-key',
                response: {},
            },
        }))

        const result = await navigator.credentials!.create!(CREATE_OPTIONS)

        expect(origCreate).toHaveBeenCalledTimes(1)
        expect(result).toEqual({ id: 'native-create' })
    })

    // Fix 3 (production direction): the REAL scenario is the SW/authenticator
    // core (real package) encoding a credential via its `serializeCredential`,
    // and THIS file's local `reconstructCredential`/`b64urlToBytes` decoding
    // it — the reverse of the two round-trip tests above, which only checked
    // local-encode -> real-decode. Round-tripping through the real package's
    // encoder here catches drift in the DECODE direction too.
    it('decodes a credential produced by the real package codec (production direction)', async () => {
        const { mod, origCreate } = await freshModule()
        const rawAttestation: RawAttestationResponse = {
            clientDataJSON: new TextEncoder().encode('client-data'),
            attestationObject: new TextEncoder().encode('attestation'),
        }
        const realSerialized = serializeCredential({
            id: new TextEncoder().encode('cred-id'),
            type: 'public-key',
            response: rawAttestation,
        })
        stubRelay(mod, () => ({ credential: realSerialized }))

        const result = (await navigator.credentials!.create!(
            CREATE_OPTIONS,
        )) as PublicKeyCredential

        expect(origCreate).not.toHaveBeenCalled()
        expect(new TextDecoder().decode(result.rawId)).toBe('cred-id')
        const response = result.response as AuthenticatorAttestationResponse
        expect(new TextDecoder().decode(response.clientDataJSON)).toBe(
            'client-data',
        )
        expect(new TextDecoder().decode(response.attestationObject)).toBe(
            'attestation',
        )
    })

    it('falls through to the original on timeout, never leaving the page promise pending', async () => {
        vi.useFakeTimers()
        const { mod, origCreate } = await freshModule()
        // No relay response at all — simulates a torn-down SW.
        stubRelay(mod, () => undefined)

        const pending = navigator.credentials!.create!(CREATE_OPTIONS)
        await vi.advanceTimersByTimeAsync(120_000)
        const result = await pending

        expect(origCreate).toHaveBeenCalledTimes(1)
        expect(result).toEqual({ id: 'native-create' })
    })

    it('resolves a PublicKeyCredential-shaped object with ArrayBuffer fields restored on a credential response', async () => {
        const { mod, origCreate } = await freshModule()
        const b64url = (text: string): string =>
            Buffer.from(text).toString('base64url')

        stubRelay(mod, () => ({
            credential: {
                id: b64url('cred-id'),
                rawId: b64url('cred-id'),
                type: 'public-key',
                response: {
                    clientDataJSON: b64url('client-data'),
                    attestationObject: b64url('attestation'),
                },
            },
        }))

        const result = (await navigator.credentials!.create!(
            CREATE_OPTIONS,
        )) as PublicKeyCredential

        expect(origCreate).not.toHaveBeenCalled()
        expect(result.id).toBe(b64url('cred-id'))
        expect(result.type).toBe('public-key')
        expect(result.rawId).toBeInstanceOf(ArrayBuffer)
        expect(new TextDecoder().decode(result.rawId)).toBe('cred-id')
        const response = result.response as AuthenticatorAttestationResponse
        expect(response.clientDataJSON).toBeInstanceOf(ArrayBuffer)
        expect(new TextDecoder().decode(response.clientDataJSON)).toBe(
            'client-data',
        )
        expect(response.attestationObject).toBeInstanceOf(ArrayBuffer)
        expect(new TextDecoder().decode(response.attestationObject)).toBe(
            'attestation',
        )
    })

    it('resolves a PublicKeyCredential-shaped assertion object with ArrayBuffer fields restored on get()', async () => {
        const { mod } = await freshModule()
        const b64url = (text: string): string =>
            Buffer.from(text).toString('base64url')

        stubRelay(mod, () => ({
            credential: {
                id: b64url('cred-id'),
                rawId: b64url('cred-id'),
                type: 'public-key',
                response: {
                    clientDataJSON: b64url('client-data'),
                    authenticatorData: b64url('auth-data'),
                    signature: b64url('sig'),
                    userHandle: b64url('user-1'),
                },
            },
        }))

        const result = (await navigator.credentials!.get!(
            GET_OPTIONS,
        )) as PublicKeyCredential
        const response = result.response as AuthenticatorAssertionResponse

        expect(new TextDecoder().decode(response.authenticatorData)).toBe(
            'auth-data',
        )
        expect(new TextDecoder().decode(response.signature)).toBe('sig')
        expect(response.userHandle).toBeInstanceOf(ArrayBuffer)
        expect(new TextDecoder().decode(response.userHandle!)).toBe('user-1')
    })

    it('re-dispatches the handshake with the same channel names when the relay signals it is ready', async () => {
        const { mod } = await freshModule()

        // NOTE: earlier tests' freshModule() calls left their own
        // RELAY_READY listeners registered on this shared jsdom `window`
        // (vi.resetModules() only clears the module cache, not DOM
        // listeners), so this dispatch also re-fires their handshakes.
        // Assert this instance's names are among them rather than the only
        // entry — the point under test is this instance reacting at all.
        const handshakes: unknown[] = []
        window.addEventListener(WEBAUTHN_CHANNEL_HANDSHAKE_EVENT, e => {
            handshakes.push((e as CustomEvent).detail)
        })

        window.dispatchEvent(
            new CustomEvent(WEBAUTHN_CHANNEL_RELAY_READY_EVENT),
        )

        expect(handshakes).toContainEqual({
            requestEventName:
                mod.installWebauthnInterception.__requestEventName,
            responseEventName:
                mod.installWebauthnInterception.__responseEventName,
        })
    })
})
