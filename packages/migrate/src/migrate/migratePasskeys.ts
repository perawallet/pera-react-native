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

import { Platform } from 'react-native'
import { useAccountsStore } from '@perawallet/wallet-core-accounts'
import {
    entropyChildIdOf,
    entropyToMnemonic,
    withSecret,
    zeroBytes,
} from '@perawallet/wallet-core-kms'
import { bytesEqual, bytesToHex, logger } from '@perawallet/wallet-core-shared'
import { getKeystoreStore } from '@perawallet/wallet-extension-provider'
import type { LegacyPasskey } from '@perawallet/wallet-extension-platform'
import {
    credentialIdBytesToStandardBase64,
    decodeCredentialIdToBytes,
    type DerivedLegacyPasskeyCredential,
    deriveLegacyPasskeyCredentialFromMainKey,
    deriveMainKey,
    type PasskeyCredentialIdBasis,
} from './passkeys/deriveLegacyPasskeyCredential'
import {
    createNativePasskeyWriter,
    nativePasskeyEntryExists,
    type NativePasskeyWriter,
} from './passkeys/writeNativePasskeyEntry'

export type PasskeysMigrationResult = {
    imported: number
    skipped: number
}

type DerivationInputs = {
    origin: string
    userName: string
    /** Standard-base64 credentialId; the MMKV key the native provider looks up by. */
    credentialId: string
    legacyIdBytes: Uint8Array
}

type PasskeyDerivation = {
    passkey: LegacyPasskey
    inputs: DerivationInputs
    derived: DerivedLegacyPasskeyCredential
}

/**
 * Reconstructs the WebAuthn origin dp256 derived against, for legacy Android.
 * Android stores the relying party as a bare host (`webauthn.io`), but the
 * derivation — and the credentialId the RP trusts — used the full origin
 * (`https://webauthn.io`), confirmed on-device. WebAuthn origins are
 * always `https` (except localhost), so prepend the scheme when absent; leave an
 * already-qualified origin untouched. (Legacy iOS derives with the origin
 * verbatim — see {@link resolvePlatformConvention}.)
 */
const toWebAuthnOrigin = (siteUrl: string): string =>
    /^[a-z][a-z0-9+.-]*:\/\//i.test(siteUrl) ? siteUrl : `https://${siteUrl}`

/**
 * Per-platform legacy derivation convention. Migration always reads the
 * same-platform legacy DB (in-place upgrade), so `Platform.OS` selects it; a
 * wrong guess only causes a safe skip (credentialId is verified before write).
 */
type PlatformPasskeyConvention = {
    resolveOrigin: (siteUrl: string) => string
    credentialIdBasis: PasskeyCredentialIdBasis
}

const resolvePlatformConvention = (): PlatformPasskeyConvention =>
    Platform.OS === 'ios'
        ? { resolveOrigin: siteUrl => siteUrl, credentialIdBasis: 'raw-point' }
        : { resolveOrigin: toWebAuthnOrigin, credentialIdBasis: 'spki-der' }

/**
 * Validates a legacy row and resolves the inputs derivation needs. Returns
 * `null` for rows we can't migrate (missing fields, or an unreadable
 * credentialId — logged); the caller treats `null` as a skip.
 *
 * `userName` is the WebAuthn `user.name` — both legacy apps feed this exact
 * value into the derivation (confirmed on-device: not `user.id`).
 */
const resolveDerivationInputs = (
    passkey: LegacyPasskey,
    resolveOrigin: (siteUrl: string) => string,
): DerivationInputs | null => {
    const origin = passkey.siteUrl ? resolveOrigin(passkey.siteUrl) : ''
    const userName = passkey.userName
    if (!passkey.credentialId || !origin || !userName) return null

    const legacyIdBytes = decodeCredentialIdToBytes(passkey.credentialId)
    if (!legacyIdBytes) {
        logger.warn('[Migration] passkey skipped: unreadable id', {
            credentialId: passkey.credentialId,
        })
        return null
    }

    return {
        origin,
        userName,
        credentialId: credentialIdBytesToStandardBase64(legacyIdBytes),
        legacyIdBytes,
    }
}

type MigrationContext = {
    /** Whether the passkey's owning account migrated (is present in the store). */
    hasAccount: (address: string) => boolean
    /** Walk address → account → derived key → the HD seed that owns it. */
    resolveSeedKeyId: (address: string) => string | undefined
    /** Recover a seed's BIP39 mnemonic from its entropy `secret-key` child (found by metadata). */
    resolveMnemonic: (seedKeyId: string) => Promise<string | undefined>
    /** Derived main key per seed; PBKDF2 (210k) runs once and is reused. */
    getMainKey: (seedKeyId: string, mnemonic: string) => Promise<Uint8Array>
    /** Native passkey writer; the keystore master key is fetched once and reused. */
    writePasskey: NativePasskeyWriter
    /** Per-platform legacy derivation convention (origin shape + id basis). */
    convention: PlatformPasskeyConvention
    /** Zeroes the secret buffers held for the batch (per-seed main keys + master key). */
    dispose: () => Promise<void>
}

const createMigrationContext = (): MigrationContext => {
    const keyById = new Map(
        getKeystoreStore().state.keys.map(key => [key.id, key]),
    )
    const accountByAddress = new Map(
        useAccountsStore.getState().accounts.map(acc => [acc.address, acc]),
    )
    const mainKeyBySeed = new Map<string, Promise<Uint8Array>>()
    const writePasskey = createNativePasskeyWriter()

    return {
        hasAccount: address => accountByAddress.has(address),
        resolveSeedKeyId: address => {
            const keyPairId = accountByAddress.get(address)?.keyPairId
            if (!keyPairId) return undefined
            const parentKeyId = (
                keyById.get(keyPairId)?.metadata as
                    | Record<string, unknown>
                    | undefined
            )?.parentKeyId
            return typeof parentKeyId === 'string' ? parentKeyId : undefined
        },
        resolveMnemonic: async seedKeyId => {
            const entropyId = entropyChildIdOf(
                seedKeyId,
                getKeystoreStore().state.keys,
            )
            if (!entropyId) return undefined
            return (
                (await withSecret(entropyId, entropy =>
                    entropyToMnemonic(entropy),
                )) ?? undefined
            )
        },
        getMainKey: (seedKeyId, mnemonic) => {
            let pending = mainKeyBySeed.get(seedKeyId)
            if (!pending) {
                pending = deriveMainKey(mnemonic)
                mainKeyBySeed.set(seedKeyId, pending)
            }
            return pending
        },
        writePasskey,
        convention: resolvePlatformConvention(),
        dispose: async () => {
            const mainKeyWipes = Array.from(mainKeyBySeed.values(), pending =>
                pending.then(zeroBytes, () => {}),
            )
            await Promise.all([...mainKeyWipes, writePasskey.dispose()])
            mainKeyBySeed.clear()
        },
    }
}

const logDerivationMismatch = ({
    passkey,
    inputs,
    derived,
}: PasskeyDerivation): void => {
    logger.warn('[Migration] passkey skipped: derived credentialId mismatch', {
        credentialId: inputs.credentialId,
        address: passkey.address,
        legacyCredentialId: passkey.credentialId,
        legacyCredentialIdHex: bytesToHex(inputs.legacyIdBytes),
        derivedFromUserName: derived.credentialId,
        siteUrl: passkey.siteUrl,
        userName: inputs.userName,
        hasUserHandle: passkey.userHandle != null,
    })
}

const persistMigratedPasskey = async (
    { passkey, inputs, derived }: PasskeyDerivation,
    writePasskey: NativePasskeyWriter,
): Promise<void> => {
    // The WebAuthn `user.id` is what the RP gets back as the assertion
    // userHandle. It's required at registration, so a missing one means the
    // legacy row lost it — the credential is still written (it can sign in at
    // RPs that don't match on userHandle) but flagged.
    if (passkey.userHandle == null) {
        logger.warn(
            '[Migration] passkey has no WebAuthn user.id; assertion userHandle will be empty',
            { credentialId: inputs.credentialId, address: passkey.address },
        )
    }

    await writePasskey({
        credentialId: inputs.credentialId,
        origin: inputs.origin,
        userId: passkey.userHandle ?? '',
        userName: inputs.userName,
        displayName: passkey.userDisplayName ?? undefined,
        publicKeySpkiDer: derived.publicKeySpkiDer,
        privateKey: derived.privateKey,
        lastUsedAtMs: passkey.lastUsedAtMs,
    })
}

type PasskeyMigrationOutcome = 'imported' | 'skipped'

/**
 * Validate → dedup → resolve seed → re-derive → verify credentialId → persist.
 * Persists only when re-derivation reproduces the RP's credentialId exactly, so
 * we never write an unsignable entry.
 */
const migrateSinglePasskey = async (
    passkey: LegacyPasskey,
    ctx: MigrationContext,
    writtenIds: Set<string>,
): Promise<PasskeyMigrationOutcome> => {
    const inputs = resolveDerivationInputs(
        passkey,
        ctx.convention.resolveOrigin,
    )
    if (!inputs) return 'skipped'

    // Idempotency + the existence check key off the legacy credentialId bytes
    // alone, so they don't require the expensive derivation.
    if (
        writtenIds.has(inputs.credentialId) ||
        nativePasskeyEntryExists(inputs.credentialId)
    ) {
        return 'skipped'
    }

    if (!ctx.hasAccount(passkey.address)) {
        logger.warn('[Migration] passkey skipped: account not migrated', {
            credentialId: inputs.credentialId,
            address: passkey.address,
        })
        return 'skipped'
    }

    const seedKeyId = ctx.resolveSeedKeyId(passkey.address)
    if (!seedKeyId) {
        logger.warn('[Migration] passkey skipped: unresolved HD seed', {
            credentialId: inputs.credentialId,
            address: passkey.address,
        })
        return 'skipped'
    }

    const mnemonic = await ctx.resolveMnemonic(seedKeyId)
    if (!mnemonic) {
        logger.warn('[Migration] passkey skipped: seed has no entropy', {
            credentialId: inputs.credentialId,
            address: passkey.address,
        })
        return 'skipped'
    }

    const derivedMainKey = await ctx.getMainKey(seedKeyId, mnemonic)
    const derived = await deriveLegacyPasskeyCredentialFromMainKey({
        derivedMainKey,
        origin: inputs.origin,
        userName: inputs.userName,
        credentialIdBasis: ctx.convention.credentialIdBasis,
    })
    try {
        const derivation: PasskeyDerivation = { passkey, inputs, derived }

        // The decisive correctness gate: only persist if our independent
        // re-derivation reproduces the relying party's credentialId exactly.
        if (!bytesEqual(derived.credentialIdBytes, inputs.legacyIdBytes)) {
            logDerivationMismatch(derivation)
            return 'skipped'
        }

        await persistMigratedPasskey(derivation, ctx.writePasskey)
        writtenIds.add(inputs.credentialId)
        return 'imported'
    } finally {
        zeroBytes(derived.privateKey)
    }
}

/**
 * Migrates legacy passkeys so they keep *signing in* after the move from the
 * native (iOS/Android) apps — without re-registering with each relying party.
 * A passkey is re-derived, not transferred; see {@link migrateSinglePasskey}
 * for the per-passkey flow and {@link ./passkeys/deriveLegacyPasskeyCredential}
 * for the crypto.
 *
 * Idempotent: a credential already present in the keystore is skipped without
 * re-deriving (PBKDF2 is expensive).
 */
export const migratePasskeys = async (
    passkeys: LegacyPasskey[],
): Promise<PasskeysMigrationResult> => {
    const result: PasskeysMigrationResult = { imported: 0, skipped: 0 }
    if (passkeys.length === 0) return result

    const ctx = createMigrationContext()
    const writtenIds = new Set<string>()

    try {
        for (const passkey of passkeys) {
            try {
                const outcome = await migrateSinglePasskey(
                    passkey,
                    ctx,
                    writtenIds,
                )
                result[outcome] += 1
            } catch (err) {
                logger.error('[Migration] passkey import failed', {
                    credentialId: passkey.credentialId,
                    error: err,
                })
                result.skipped += 1
            }
        }

        return result
    } finally {
        await ctx.dispose()
    }
}
