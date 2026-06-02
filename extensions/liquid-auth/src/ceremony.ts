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

import { fromBase64Url, toBase64Url } from './encoding/base64'
import type {
    ChallengeSigner,
    FidoCeremonyInput,
    FidoCeremonyResult,
} from './types'

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
 * Throws on a non-2xx response, surfacing the server's error body. The
 * ceremony previously ignored `res.ok` and proceeded after a failed POST
 * (e.g. a 401 on /attestation/response), which manifested downstream as a
 * misleading 30s WebRTC transport timeout instead of the real error. */
const assertCeremonyOk = async (
    which: string,
    res: Response,
): Promise<void> => {
    if (res.ok) return
    let body = ''
    try {
        body = await res.text()
    } catch {
        // body may be unreadable; the status alone is still useful.
    }
    throw new Error(
        `Liquid Auth ${which} failed (${res.status})${
            body ? `: ${body.slice(0, 200)}` : ''
        }`,
    )
}

type WebAuthnCredential = {
    id: string
    response: unknown
    clientExtensionResults: Record<string, unknown>
}

/**
 * True when the error represents the user declining the WebAuthn/biometric
 * gate rather than a recoverable "stored credential unusable" failure. Matches
 * both the WebAuthn `NotAllowedError` (OS passkey UI cancel) and the in-app
 * mechanism's user-verification-failed error.
 */
const isUserCancellation = (error: unknown): boolean => {
    if (error instanceof Error) {
        if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
            return true
        }
        return /user verification failed|user cancel/i.test(error.message)
    }
    return false
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
        try {
            return await assertion(input, deps, existing)
        } catch (error) {
            // Only fall back to registering a fresh credential when the stored
            // one is genuinely unusable (deleted on device, forgotten by the
            // server after a DB reset, id no longer resolves). A user who
            // cancelled the biometric/UV prompt must NOT silently trigger a
            // second prompt + a brand-new attested credential — rethrow so the
            // caller surfaces the cancellation.
            if (isUserCancellation(error)) throw error
        }
    }
    return attestation(input, deps)
}

const buildLiquidExtension = async (
    input: FidoCeremonyInput,
    signChallenge: ChallengeSigner,
    challengeB64Url: string,
) => {
    const challenge = fromBase64Url(challengeB64Url)
    const signature = await signChallenge(input.keyId, challenge)
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
