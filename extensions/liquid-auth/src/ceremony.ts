/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { logger } from '@perawallet/wallet-core-shared'
import { ed25519 } from '@noble/curves/ed25519'
import type {
    ChallengeSigner,
    FidoCeremonyInput,
    FidoCeremonyResult,
} from './types'

/**
 * Decodes an Algorand address (RFC-4648 base32, no padding) to its 32-byte
 * Ed25519 public key (the first 32 of the 36 decoded bytes; the last 4 are the
 * checksum). Returns null on malformed input. Diagnostic-only.
 */
const ALGO_BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const algorandAddressPublicKey = (address: string): Uint8Array | null => {
    let bits = 0
    let value = 0
    const out: number[] = []
    for (const ch of address) {
        const idx = ALGO_BASE32.indexOf(ch)
        if (idx === -1) return null
        value = (value << 5) | idx
        bits += 5
        if (bits >= 8) {
            bits -= 8
            out.push((value >>> bits) & 0xff)
        }
    }
    return out.length >= 32 ? new Uint8Array(out.slice(0, 32)) : null
}

/**
 * User-Agent sent on the ceremony requests. The Liquid Auth server picks its
 * expected WebAuthn origin from the UA: a bare native-Android UA makes it
 * expect an `android:apk-key-hash:<hash>` origin (derived from the server's own
 * assetlinks.json, which we can't satisfy on a third-party server), while a UA
 * carrying a browser token makes it expect the configured web origin
 * (`https://<host>`) — which our clientDataJSON.origin matches. A real
 * Android-Chrome UA keeps OS=Android honest while still routing to the web
 * origin branch (browser name is present, so it's not classified as native).
 */
const CEREMONY_USER_AGENT =
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'

/**
 * Logs the outcome of a ceremony fetch and THROWS on a non-2xx response,
 * surfacing the server's error body. The ceremony previously ignored `res.ok`
 * and proceeded after a failed POST (e.g. a 401 on /attestation/response),
 * which manifested downstream as a misleading 30s WebRTC transport timeout
 * instead of the real error. `set-cookie` is usually hidden by the RN fetch
 * headers implementation — its absence is itself diagnostic of the session
 * cookie not being carried between the request and response calls. */
const assertCeremonyOk = async (
    which: string,
    res: Response,
): Promise<void> => {
    logger.info(`[liquid-auth] ceremony: ${which} response`, {
        ok: res.ok,
        status: res.status,
        hasSetCookie: !!res.headers?.get?.('set-cookie'),
    })
    if (res.ok) return
    let body = ''
    try {
        body = await res.text()
    } catch {
        // body may be unreadable; the status alone is still useful.
    }
    logger.info(`[liquid-auth] ceremony: ${which} FAILED`, {
        status: res.status,
        body: body.slice(0, 500),
    })
    throw new Error(
        `Liquid Auth ${which} failed (${res.status})${
            body ? `: ${body.slice(0, 200)}` : ''
        }`,
    )
}

/** base64url <-> bytes helpers (no padding). */
const fromBase64Url = (value: string): Uint8Array => {
    const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
}

const toBase64Url = (bytes: Uint8Array): string => {
    let binary = ''
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return btoa(binary)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
}

type WebAuthnCredential = {
    id: string
    response: unknown
    clientExtensionResults: Record<string, unknown>
}

export type CeremonyDeps = {
    fetch: typeof fetch
    signChallenge: ChallengeSigner
    getCredential: (options: unknown) => Promise<WebAuthnCredential>
    createCredential: (options: unknown) => Promise<WebAuthnCredential>
    hasCredentialForHost: (origin: string) => Promise<string | null>
}

/**
 * Runs the Liquid Auth FIDO2 ceremony against the signaling server and binds
 * the passkey to the Algorand address. Assertion path when a credential
 * already exists for the host; attestation path otherwise. In both cases the
 * `liquid` client-extension carries an Ed25519 signature of the server
 * challenge made with the account key.
 *
 * NOTE: The exact REST endpoint paths and sequence must be confirmed against
 * the live Liquid Auth server during the Phase-0 device spike.
 */
export const runFidoCeremony = async (
    input: FidoCeremonyInput,
    deps: CeremonyDeps,
): Promise<FidoCeremonyResult> => {
    // The caller supplies a known credentialId (from its persisted sessions)
    // to reuse an existing passkey; `hasCredentialForHost` is the legacy
    // fallback. Either present => assert (reuse); neither => attest (register).
    const existing =
        input.credentialId ?? (await deps.hasCredentialForHost(input.origin))
    if (existing) {
        logger.info('[liquid-auth] ceremony: path', { path: 'assertion' })
        try {
            return await assertion(input, deps, existing)
        } catch (error) {
            // The stored credential is unusable — the passkey was deleted on
            // device, the server forgot it (DB reset), or the id no longer
            // resolves. Re-register a fresh credential instead of dead-ending
            // on "assertion failed"; the caller persists the new credentialId.
            logger.info(
                '[liquid-auth] ceremony: assertion failed — re-attesting',
                { message: (error as Error)?.message },
            )
        }
    }
    logger.info('[liquid-auth] ceremony: path', { path: 'attestation' })
    return attestation(input, deps)
}

const buildLiquidExtension = async (
    input: FidoCeremonyInput,
    signChallenge: ChallengeSigner,
    challengeB64Url: string,
) => {
    const challenge = fromBase64Url(challengeB64Url)
    const signature = await signChallenge(input.keyId, challenge)
    // Diagnostic: does our own signature verify against the address the way the
    // server's `nacl.sign.detached.verify(challenge, sig, decodeAddress(addr))`
    // will? `false` => the keystore signature / address don't match (our bug);
    // `true` => the liquid signature is sound and a 401 is the WebAuthn origin
    // check instead.
    try {
        const pk = algorandAddressPublicKey(input.address)
        logger.info('[liquid-auth] liquid sig self-verify', {
            selfOk: pk ? ed25519.verify(signature, challenge, pk) : false,
            hasPubKey: !!pk,
            sigLen: signature.length,
            challengeLen: challenge.length,
        })
    } catch (error) {
        logger.info('[liquid-auth] liquid sig self-verify error', {
            message: (error as Error)?.message,
        })
    }
    return {
        requestId: input.requestId,
        origin: input.origin,
        type: 'algorand' as const,
        address: input.address,
        signature: toBase64Url(signature),
        device: input.deviceName,
    }
}

const assertion = async (
    input: FidoCeremonyInput,
    deps: CeremonyDeps,
    credentialId: string,
): Promise<FidoCeremonyResult> => {
    // Step 1: request challenge from server — response is { challenge: <b64url> }.
    const requestUrl = `${input.origin}/assertion/request/${credentialId}`
    logger.info('[liquid-auth] ceremony: POST assertion request', {
        url: requestUrl,
    })
    const optionsRes = await deps.fetch(requestUrl, {
        method: 'POST',
        credentials: 'include',
        headers: { 'user-agent': CEREMONY_USER_AGENT },
    })
    await assertCeremonyOk('assertion request', optionsRes)
    const options = (await optionsRes.json()) as { challenge: string }
    const credential = await deps.getCredential(options)
    const liquid = await buildLiquidExtension(
        input,
        deps.signChallenge,
        options.challenge,
    )
    credential.clientExtensionResults = {
        ...credential.clientExtensionResults,
        liquid,
    }
    // Step 2: post the signed credential back to the server.
    const responseUrl = `${input.origin}/assertion/response`
    logger.info('[liquid-auth] ceremony: POST assertion response', {
        url: responseUrl,
    })
    const res = await deps.fetch(responseUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'content-type': 'application/json',
            'user-agent': CEREMONY_USER_AGENT,
        },
        body: JSON.stringify(credential),
    })
    await assertCeremonyOk('assertion response', res)
    return { credentialId }
}

const attestation = async (
    input: FidoCeremonyInput,
    deps: CeremonyDeps,
): Promise<FidoCeremonyResult> => {
    const requestUrl = `${input.origin}/attestation/request`
    logger.info('[liquid-auth] ceremony: POST attestation request', {
        url: requestUrl,
    })
    const optionsRes = await deps.fetch(requestUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'content-type': 'application/json',
            'user-agent': CEREMONY_USER_AGENT,
        },
        body: JSON.stringify({
            username: input.address,
            authenticatorSelection: { userVerification: 'required' },
            extensions: { liquid: true },
        }),
    })
    await assertCeremonyOk('attestation request', optionsRes)
    const options = (await optionsRes.json()) as { challenge: string }
    const credential = await deps.createCredential(options)
    const liquid = await buildLiquidExtension(
        input,
        deps.signChallenge,
        options.challenge,
    )
    credential.clientExtensionResults = {
        ...credential.clientExtensionResults,
        liquid,
    }
    const responseUrl = `${input.origin}/attestation/response`
    logger.info('[liquid-auth] ceremony: POST attestation response', {
        url: responseUrl,
    })
    const res = await deps.fetch(responseUrl, {
        method: 'POST',
        credentials: 'include',
        headers: {
            'content-type': 'application/json',
            'user-agent': CEREMONY_USER_AGENT,
        },
        body: JSON.stringify(credential),
    })
    await assertCeremonyOk('attestation response', res)
    return { credentialId: credential.id }
}
