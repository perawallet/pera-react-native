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

import nacl from 'tweetnacl'
import { decodeFromBase64, logger } from '@perawallet/wallet-core-shared'
import { AUTODRAW_TEAL_TEMPLATE } from './autodraw-teal'

// SWAP POINT: integrity check on the vendored AutoDraw TEAL. A delegated LSig
// is a serious attack vector — a tampered program would authorize USDC draws on
// terms we don't intend — so before we ever compile + sign it, verify the
// template bytes carry a valid ed25519 signature from a Pera-controlled key
// whose PUBLIC key is pinned here (not in env/remote config, so an attacker who
// swaps the build env can't also swap the key). Because the check lives in the
// compile path, no other code path can compile a different program through it.
//
// PROVIDE BEFORE LAUNCH: once AB's AutoDraw contract is final, sign the exact
// UTF-8 bytes of AUTODRAW_TEAL_TEMPLATE with the pinned key and paste the base64
// public key + signature below. Until then both are empty and verification is
// DORMANT (skipped with a warning) — safe because these are committed constants
// (not per-build env that could be silently forgotten) and Auto funding is
// separately gated by the `enable_card_auto_funding` remote-config flag. A
// future hardening is to move `{ template, signature }` into remote config
// (keyed e.g. `baanx-logic-sig`) so the program can rotate without a release,
// still verified against this pinned public key.
export const AUTODRAW_TEAL_PUBLIC_KEY = ''
export const AUTODRAW_TEAL_SIGNATURE = ''

/** The signed AutoDraw TEAL template failed its pinned-key integrity check. */
export class AutoDrawTealUnverifiedError extends Error {
    constructor() {
        super('AutoDraw TEAL template failed signature verification')
        this.name = 'AutoDrawTealUnverifiedError'
    }
}

/**
 * Pure ed25519 verification of the AutoDraw template's signature against a
 * public key (both base64). Returns false when either input is empty or the
 * signature does not verify — never throws.
 */
export const isAutoDrawTealSignatureValid = (
    publicKeyBase64: string,
    signatureBase64: string,
): boolean => {
    if (!publicKeyBase64 || !signatureBase64) return false
    try {
        // `Uint8Array.from` normalizes each buffer to this realm's Uint8Array —
        // tweetnacl rejects cross-realm typed arrays via an `instanceof` check.
        return nacl.sign.detached.verify(
            Uint8Array.from(new TextEncoder().encode(AUTODRAW_TEAL_TEMPLATE)),
            Uint8Array.from(decodeFromBase64(signatureBase64)),
            Uint8Array.from(decodeFromBase64(publicKeyBase64)),
        )
    } catch {
        return false
    }
}

/**
 * Guards the compile path: throws {@link AutoDrawTealUnverifiedError} when the
 * pinned material is present but the vendored template doesn't match it. While
 * the material is empty (pre-launch placeholder), verification is dormant and
 * only logs — see the SWAP POINT note above.
 */
export const verifyAutoDrawTealTemplate = (): void => {
    if (!AUTODRAW_TEAL_PUBLIC_KEY || !AUTODRAW_TEAL_SIGNATURE) {
        logger.warn(
            'AutoDraw TEAL verification is dormant — no pinned signature yet',
        )
        return
    }
    if (
        !isAutoDrawTealSignatureValid(
            AUTODRAW_TEAL_PUBLIC_KEY,
            AUTODRAW_TEAL_SIGNATURE,
        )
    ) {
        throw new AutoDrawTealUnverifiedError()
    }
}
