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
// Ported from @algorandfoundation/keystore@1.0.0-canary.17 types/backend.ts
// Portions Copyright Algorand Foundation, Apache-2.0

import type {
    AuditEvent,
    DeriveOptions,
    ExportOptions,
    GenerateOptions,
    KeyData,
    KeyFormat,
    KeyId,
    KeyOptions,
} from './core'

/**
 * Main interface for keystore operations. This defines what a keystore backend must do.
 * Think of it as a "key manager" that can create, store, and use cryptographic keys.
 *
 * Use cases:
 * - Generate keys for signing arbitrary data.
 * - Import keys from external sources (e.g., other wallets).
 * - Derive new keys from a master seed for HD wallets.
 * - Sign data with private keys and verify signatures with public keys.
 *
 * @see {@link KeyStoreState} for the reactive state representation of the keystore.
 */
export interface KeyStoreAPI {
    /**
     * Creates a new key pair. This generates both a private key (secret) and public key (shareable).
     *
     * @param options - Generation parameters including {@link KeyType} and {@link Algorithm}.
     * @returns The unique {@link KeyId} of the generated key.
     */
    generate(options: GenerateOptions): Promise<KeyId>

    /**
     * Imports an existing key into the keystore.
     *
     * @param data - The raw key data to import.
     * @param format - The {@link KeyFormat} of the provided data.
     * @returns The unique {@link KeyId} assigned to the imported key.
     * @throws {InvalidKeyFormatError} If the format is invalid.
     * @throws {InvalidKeyDataError} If the key data is malformed.
     */
    import(
        data: Omit<KeyData, 'id'> | Uint8Array | string,
        format?: KeyFormat,
    ): Promise<KeyId>

    /**
     * Exports a key from the keystore (usually public key only, for security).
     *
     * @param id - The {@link KeyId} of the key to export.
     * @param options - Export options such as {@link KeyFormat}.
     * @returns The {@link KeyData} containing exported key material.
     */
    export(id: KeyId, options?: ExportOptions): Promise<KeyData>

    /**
     * Deletes a key from the keystore.
     *
     * @param id - The {@link KeyId} of the key to delete.
     * @throws {KeyNotFoundError} If the key is not found.
     */
    remove(id: KeyId): Promise<void>

    /**
     * Signs data with a private key.
     *
     * @param id - The {@link KeyId} to use for signing.
     * @param data - The data to sign.
     * @param algorithm - Optional override for the signing algorithm.
     * @returns The resulting signature.
     * @throws {KeyNotFoundError} If the key is not found.
     */
    sign(id: KeyId, data: Uint8Array, algorithm?: string): Promise<Uint8Array>

    /**
     * Verifies a signature against data using a public key.
     *
     * @param id - The {@link KeyId} to use for verification.
     * @param data - The original data that was signed.
     * @param signature - The signature to verify.
     * @param algorithm - Optional override for the verification algorithm.
     * @returns True if the signature is valid, false otherwise.
     */
    verify(
        id: KeyId,
        data: Uint8Array,
        signature: Uint8Array,
        algorithm?: string,
    ): Promise<boolean>

    /**
     * Encrypts data with a public key (asymmetric encryption).
     *
     * @param id - The {@link KeyId} to use for encryption.
     * @param data - The data to encrypt.
     * @param algorithm - Optional override for the encryption algorithm.
     * @returns The encrypted data.
     */
    encryptWithKey?(
        id: KeyId,
        data: Uint8Array,
        algorithm?: string,
    ): Promise<Uint8Array>

    /**
     * Decrypts data with a private key.
     *
     * @param id - The {@link KeyId} to use for decryption.
     * @param data - The data to decrypt.
     * @param algorithm - Optional override for the decryption algorithm.
     * @returns The decrypted data.
     */
    decryptWithKey?(
        id: KeyId,
        data: Uint8Array,
        algorithm?: string,
    ): Promise<Uint8Array>

    /**
     * Derives a shared secret for key agreement (e.g., ECDH).
     *
     * @param id - The local {@link KeyId} to use.
     * @param publicKey - The remote public key.
     * @param meFirst - Order of keys in derivation.
     * @param algorithm - Optional override for the derivation algorithm.
     * @returns The derived shared secret.
     */
    deriveSharedSecret?(
        id: KeyId,
        publicKey: Uint8Array,
        meFirst: boolean,
        algorithm?: string,
    ): Promise<Uint8Array>

    /**
     * Imports raw seed bytes for HD wallets.
     *
     * Accepts seed **bytes only**. A BIP39 mnemonic must be converted to seed
     * bytes at the call site (e.g. `bip39.mnemonicToSeed`) so the mnemonic
     * string never crosses into the keystore — an immutable JS string can't be
     * wiped and would linger in the heap until GC.
     *
     * @param seed - The raw seed bytes.
     * @param options - Optional configuration for the seed.
     * @returns The {@link KeyId} assigned to the seed.
     */
    importSeed?(seed: Uint8Array, options?: KeyOptions): Promise<KeyId>

    /**
     * Derives a new key from a seed using HD derivation path.
     *
     * @param seedId - The {@link KeyId} of the seed to derive from.
     * @param path - The derivation path (e.g., "m/44'/283'/0'/0/0").
     * @param options - Additional {@link DeriveOptions}.
     * @returns The {@link KeyId} of the derived key.
     */
    deriveFromSeed?(
        seedId: KeyId,
        path: string,
        options?: DeriveOptions,
    ): Promise<KeyId>

    /**
     * Encrypts arbitrary data using a passphrase.
     *
     * @param data - The data to encrypt.
     * @param passphrase - The passphrase to use for encryption.
     * @returns The encrypted data.
     */
    encryptData?(data: Uint8Array, passphrase?: string): Promise<Uint8Array>

    /**
     * Decrypts data using a passphrase.
     *
     * @param data - The data to decrypt.
     * @param passphrase - The passphrase used for encryption.
     * @returns The decrypted data.
     */
    decryptData?(data: Uint8Array, passphrase?: string): Promise<Uint8Array>

    /**
     * Logs an audit event.
     *
     * @param event - The {@link AuditEvent} to log.
     */
    logAuditEvent?(event: AuditEvent): Promise<void>

    /**
     * Gets audit logs.
     *
     * @param filter - Optional filters for the logs.
     * @returns An array of {@link AuditEvent} matches.
     */
    getAuditLogs?(filter?: {
        since?: Date
        operation?: string
    }): Promise<AuditEvent[]>

    /**
     * Signs multiple data items at once.
     *
     * @param ids - The {@link KeyId}s to use for each data item.
     * @param data - The data items to sign.
     * @returns An array of signatures.
     */
    batchSign?(ids: KeyId[], data: Uint8Array[]): Promise<Uint8Array[]>
}

// Note: XHDKeyStoreBackendOptions is defined in backend/xhd.ts
// to avoid duplicate exports
