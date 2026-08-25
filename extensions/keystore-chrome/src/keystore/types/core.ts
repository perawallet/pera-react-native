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
// Ported from @algorandfoundation/keystore@1.0.0-canary.17 types/core.ts
// Portions Copyright Algorand Foundation, Apache-2.0
// oxlint-disable @typescript-eslint/no-explicit-any -- ported verbatim from @algorandfoundation/keystore@1.0.0-canary.17; upstream style preserved

/**
 * Core types and interfaces for the keystore.
 * These are the fundamental types used throughout the system.
 */

/**
 * Unique identifier for a key
 */
export type KeyId = string

/**
 * Type of key: RSA (asymmetric), ECC (elliptic curve), seed/HD-derived,
 * standalone Ed25519 keys, or arbitrary user-supplied secret keys.
 *
 * @remarks
 * `hd-seed` is preserved for backward compatibility but is **deprecated**.
 * New code should use `seed` instead.
 */
export type KeyType =
    | 'rsa'
    | 'ecc'
    | 'lattice'
    | 'seed'
    | /** @deprecated Use `seed` instead. */ 'hd-seed'
    | 'hd-root-key'
    | 'hd-derived-ed25519'
    | 'hd-derived-p256'
    | 'ed25519'
    | 'secret-key'
    | string

/**
 * How keys are encoded: raw bytes, PEM (text), DER (binary), JWK (JSON), OpenPGP
 */
export type KeyFormat = 'raw' | 'pem' | 'der' | 'jwk' | 'openpgp' | string

/**
 * Supported algorithms:
 * - `RS256`: RSA PKCS#1 v1.5 with SHA-256
 * - `P256`: ECDSA using P-256 and SHA-256
 * - `EdDSA`: EdDSA using Ed25519
 * - `raw`: raw bytes (e.g., storing seed material)
 */
export type Algorithm = 'RS256' | 'P256' | 'EdDSA' | 'raw' | string

/**
 * Base key interface containing common metadata.
 */
export interface Key {
    id: KeyId
    /**
     * Key type.
     */
    type: KeyType
    /**
     * Key algorithm.
     */
    algorithm: Algorithm
    /**
     * Key usages.
     */
    keyUsages?: KeyUsage[]
    /** Public key bytes (if available) */
    publicKey?: Uint8Array
    /**
     * Key format, if applicable.
     */
    format?: KeyFormat
    /** Whether the key can be extracted from the key store */
    extractable: boolean
    /** Custom extension data for specific implementations */
    metadata?: Record<string, unknown>
    /** API version for compatibility tracking */
    version?: number
}

/**
 * Data for a key, including optional public key and metadata.
 */
export interface KeyData extends Key {
    /** Private key bytes (usually for import only, never exported for existing keys) */
    privateKey?: Uint8Array
}

/**
 * Represents a seed (BIP39-derived bytes) usable for deriving other keys
 * (e.g. HD root keys, Ed25519 keys).
 *
 * @example
 * ```typescript
 * const seed: Seed = await generateSeedData({ strength: 256 });
 * ```
 */
export interface Seed extends KeyData {
    type: 'seed'
    algorithm: 'raw'
}

/**
 * Represents a Hierarchical Deterministic (HD) seed.
 *
 * @deprecated Use {@link Seed} instead. The `hd-seed` shape is retained only
 * for backward compatibility and will be removed in a future major version.
 */
export interface SeedData extends KeyData {
    type: 'hd-seed' | 'seed'
    algorithm: 'raw'
}

/**
 * Represents an arbitrary user-provided secret key. The contents have no
 * intrinsic cryptographic purpose; they are stored as-is for the consumer
 * application to leverage as it sees fit.
 *
 * @example
 * ```typescript
 * const key: SecretKeyData = await generateSecretKey({ value: "hunter2" });
 * ```
 */
export interface SecretKeyData extends KeyData {
    type: 'secret-key'
    algorithm: 'raw'
}

/**
 * Represents a standalone Ed25519 keypair (not part of an HD tree).
 *
 * @remarks
 * `privateKey` holds the 32-byte Ed25519 seed; `publicKey` holds the
 * 32-byte Ed25519 public key.
 */
export interface Ed25519KeyData extends KeyData {
    type: 'ed25519'
    algorithm: 'EdDSA'
    metadata?: {
        /** Optional ID of the seed used to derive this key, if any. */
        parentKeyId?: string
        /** Whether the key was derived from a BIP39 mnemonic. */
        fromMnemonic?: boolean
        [key: string]: unknown
    }
}

/**
 * Represents an HD root key derived from a seed.
 */
export interface XHDRootKey extends KeyData {
    type: 'hd-root-key'
    algorithm: 'raw'
    metadata?: {
        /** Optional identifier of the parent key/seed */
        parentId?: string
        /** Optional identifier of the root key/seed */
        rootKeyId?: string
    }
}

/**
 * Represents metadata for a key derived via XHD (Extended HD) derivation.
 *
 * @remarks
 * This is primarily used for Ed25519 keys in the Algorand ecosystem.
 */
export interface XHDDerivedKeyData extends KeyData {
    type: 'hd-derived-ed25519'
    algorithm: 'EdDSA'
    metadata: {
        /** Address Mapping */
        address: Record<string, unknown>
        /** The full derivation path (e.g., "m/44'/283'/0'/0/0") */
        path: string
        /** Account index */
        account: number
        /** Context index */
        context: number
        /** Address index */
        index: number
        /** Derivation index */
        derivation: number
        /** ID of the root key used for derivation */
        parentKeyId: string
    }
}

/**
 * Represents metadata for an HD-derived P256 key.
 */
export interface XHDDomainP256KeyData extends KeyData {
    type: 'hd-derived-p256'
    algorithm: 'P256'
    metadata: {
        /** The origin (RP ID) of the P256 key */
        origin: string
        /** The user handle associated with the P256 key */
        userHandle: string
        /** Optional usage counter */
        counter?: number
        /** ID of the root key used for derivation */
        parentKeyId: string
        /** Optional identifier for the passphrase used to protect this key */
        passphraseId?: string
    }
}

/**
 * Options for generating a new key.
 */
export interface GenerateOptions {
    /** Key type */
    type: KeyType
    /** Algorithm */
    algorithm: Algorithm
    /** Whether the key can be extracted from the key store */
    extractable: boolean
    /** Key usage */
    keyUsages: KeyUsage[]
    /** Key size in bits (e.g., 2048 for RSA) */
    keySize?: number
    /** Curve for ECC (e.g., 'P-256') */
    curve?: string
    /** Additional params */
    params?: Record<string, any>
}

/**
 * Options for exporting a key.
 */
export interface ExportOptions {
    /** Export format */
    format: KeyFormat
}

/**
 * Options for key operations.
 */
export interface KeyOptions {
    /** Custom ID */
    id?: string
    /** Name/label */
    name?: string
    /** Algorithm */
    algorithm?: Algorithm
    /** Passphrase for encryption */
    passphrase?: string
    /** Extra metadata */
    metadata?: Record<string, any>
}

/**
 * Options for deriving keys from seed.
 */
export interface DeriveOptions extends KeyOptions {
    /** Algorithm for the derived key */
    algorithm: Algorithm
    /** Curve for derived key (secp256k1, secp256r1, ed25519) */
    curve?: 'secp256k1' | 'secp256r1' | 'ed25519'
    /** Derivation mode */
    mode?: 'standard' | 'peikert' | 'slip10'
    /** For P256 domain-specific derivation (WebAuthn/domain-keys) */
    origin?: string
    /** For P256 domain-specific derivation (WebAuthn/domain-keys) */
    userHandle?: string
    /** Counter for multiple keys per domain (default: 0) */
    counter?: number
}

/**
 * Audit event for logging key operations.
 *
 * Use case: Track when keys were used for compliance reports.
 */
export interface AuditEvent {
    /** Event ID */
    id: string
    /** When it happened */
    timestamp: Date
    /** What operation (e.g., "sign") */
    operation: string
    /** Key involved */
    keyId?: KeyId
    /** Who did it */
    principal?: string
    /** Did it succeed? */
    success: boolean
    /** Extra details */
    details?: Record<string, any>
    /** Tamper-proof hash */
    hmac?: string
}

/**
 * Configuration for data encryption.
 */
export interface EncryptionConfig {
    /** Algorithm for encrypting data (e.g., 'aes-256-gcm') */
    algorithm?: 'aes-256-gcm' | 'chacha20-poly1305'
    /** How to derive keys from passphrases (e.g., 'pbkdf2') */
    keyDerivation?: 'pbkdf2' | 'argon2'
    /** Whether to require a passphrase for sensitive operations */
    requirePassphrase?: boolean
}
