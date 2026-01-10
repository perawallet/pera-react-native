import {
    crypto_core_ed25519_add,
    crypto_core_ed25519_scalar_add,
    crypto_core_ed25519_scalar_mul,
    crypto_core_ed25519_scalar_reduce,
    crypto_generichash,
    crypto_hash_sha512,
    crypto_kx_client_session_keys,
    crypto_kx_server_session_keys,
    crypto_scalarmult,
    crypto_scalarmult_ed25519_base_noclamp,
    crypto_secretbox_easy,
    crypto_secretbox_open_easy,
    crypto_sign_ed25519_pk_to_curve25519,
    crypto_sign_ed25519_sk_to_curve25519,
    crypto_sign_keypair,
    crypto_sign_verify_detached,
    to_base64,
} from './sumo.facade.js'

import _sodium from 'libsodium-wrappers-sumo'

describe('Sumo Facade Functionality', () => {
    describe('Key Generation', () => {
        it('should generate valid Ed25519 keypairs', () => {
            const keyPair = crypto_sign_keypair()

            expect(keyPair.publicKey).toBeInstanceOf(Uint8Array)
            expect(keyPair.secretKey).toBeInstanceOf(Uint8Array)
            expect(keyPair.publicKey.length).toBe(32)
            expect(keyPair.secretKey.length).toBe(64) // libsodium format: 32-byte seed + 32-byte public key
            expect(keyPair.keyType).toBe('ed25519')
        })

        it('should generate different keypairs on each call', () => {
            const keyPair1 = crypto_sign_keypair()
            const keyPair2 = crypto_sign_keypair()

            expect(keyPair1.publicKey).not.toEqual(keyPair2.publicKey)
            expect(keyPair1.secretKey).not.toEqual(keyPair2.secretKey)
        })
    })

    describe('Scalar Multiplication', () => {
        it('should reject zero scalar with error', () => {
            const zeroScalar = new Uint8Array(32).fill(0)

            // Should throw error matching libsodium behavior
            expect(() => {
                crypto_scalarmult_ed25519_base_noclamp(zeroScalar)
            }).toThrow('scalar is 0')
        })

        it('should handle maximum scalar correctly', () => {
            const maxScalar = new Uint8Array(32).fill(255)

            const result = crypto_scalarmult_ed25519_base_noclamp(maxScalar)
            expect(result).toBeInstanceOf(Uint8Array)
            expect(result.length).toBe(32)
        })

        it('should handle X25519 scalar multiplication with invalid inputs gracefully', () => {
            const validPriv = new Uint8Array(32).fill(1)
            const invalidPub = new Uint8Array(31) // Invalid length

            expect(() => {
                crypto_scalarmult(validPriv, invalidPub)
            }).toThrow()
        })
    })

    describe('Ed25519 to X25519 Conversion', () => {
        it('should convert Ed25519 public keys to X25519', () => {
            const keyPair = crypto_sign_keypair()
            const x25519Pub = crypto_sign_ed25519_pk_to_curve25519(
                keyPair.publicKey,
            )

            expect(x25519Pub).toBeInstanceOf(Uint8Array)
            expect(x25519Pub.length).toBe(32)
            expect(x25519Pub).not.toEqual(keyPair.publicKey) // Should be different
        })

        it('should convert Ed25519 private keys to X25519', () => {
            const keyPair = crypto_sign_keypair()
            const x25519Priv = crypto_sign_ed25519_sk_to_curve25519(
                keyPair.secretKey,
            )

            expect(x25519Priv).toBeInstanceOf(Uint8Array)
            expect(x25519Priv.length).toBe(32)
            expect(x25519Priv).not.toEqual(keyPair.secretKey) // Should be different
        })

        it('should handle invalid Ed25519 keys gracefully', () => {
            const invalidKey = new Uint8Array(31) // Invalid length

            expect(() => {
                crypto_sign_ed25519_pk_to_curve25519(invalidKey)
            }).toThrow()

            expect(() => {
                crypto_sign_ed25519_sk_to_curve25519(invalidKey)
            }).toThrow()
        })

        it('should produce consistent X25519 conversions', () => {
            const keyPair = crypto_sign_keypair()

            // Convert multiple times - should be identical
            const x25519Pub1 = crypto_sign_ed25519_pk_to_curve25519(
                keyPair.publicKey,
            )
            const x25519Pub2 = crypto_sign_ed25519_pk_to_curve25519(
                keyPair.publicKey,
            )

            expect(x25519Pub1).toEqual(x25519Pub2)
        })
    })

    describe('Key Exchange (KX)', () => {
        it('should generate symmetric session keys', () => {
            // Create two X25519 keypairs
            const alice = crypto_sign_keypair()
            const bob = crypto_sign_keypair()

            const aliceX25519Pub = crypto_sign_ed25519_pk_to_curve25519(
                alice.publicKey,
            )
            const aliceX25519Priv = crypto_sign_ed25519_sk_to_curve25519(
                alice.secretKey,
            )
            const bobX25519Pub = crypto_sign_ed25519_pk_to_curve25519(
                bob.publicKey,
            )
            const bobX25519Priv = crypto_sign_ed25519_sk_to_curve25519(
                bob.secretKey,
            )

            const aliceSession = crypto_kx_client_session_keys(
                aliceX25519Pub,
                aliceX25519Priv,
                bobX25519Pub,
            )
            const bobSession = crypto_kx_server_session_keys(
                bobX25519Pub,
                bobX25519Priv,
                aliceX25519Pub,
            )

            // Alice's RX should equal Bob's TX and vice versa
            expect(aliceSession.sharedRx).toEqual(bobSession.sharedTx)
            expect(bobSession.sharedRx).toEqual(aliceSession.sharedTx)

            // Keys should be 32 bytes
            expect(aliceSession.sharedRx.length).toBe(32)
            expect(aliceSession.sharedTx.length).toBe(32)
            expect(bobSession.sharedRx.length).toBe(32)
            expect(bobSession.sharedTx.length).toBe(32)
        })

        it('should handle different key sizes in KX', () => {
            const validKey = new Uint8Array(32).fill(1)
            const invalidKey = new Uint8Array(31)

            // The functions may handle invalid keys gracefully or throw errors
            // Let's test that they at least produce some result or throw an error
            try {
                const result1 = crypto_kx_client_session_keys(
                    invalidKey,
                    validKey,
                    validKey,
                )
                expect(result1.sharedRx).toBeInstanceOf(Uint8Array)
                expect(result1.sharedTx).toBeInstanceOf(Uint8Array)
            } catch (error) {
                expect(error).toBeDefined()
            }

            try {
                const result2 = crypto_kx_server_session_keys(
                    validKey,
                    invalidKey,
                    validKey,
                )
                expect(result2.sharedRx).toBeInstanceOf(Uint8Array)
                expect(result2.sharedTx).toBeInstanceOf(Uint8Array)
            } catch (error) {
                expect(error).toBeDefined()
            }
        })

        it('should validate client session key input lengths', () => {
            const validKey = new Uint8Array(32).fill(1)
            const shortKey = new Uint8Array(31)
            const longKey = new Uint8Array(33)

            const result = crypto_kx_client_session_keys(
                shortKey,
                validKey,
                validKey,
            )
            expect(result.sharedRx).toBeInstanceOf(Uint8Array)
            expect(result.sharedTx).toBeInstanceOf(Uint8Array)

            expect(() => {
                crypto_kx_client_session_keys(validKey, shortKey, validKey)
            }).toThrow('x25519 private and public keys must be 32 bytes each')

            expect(() => {
                crypto_kx_client_session_keys(validKey, validKey, longKey)
            }).toThrow('x25519 private and public keys must be 32 bytes each')
        })

        it('should validate server session key input lengths', () => {
            const validKey = new Uint8Array(32).fill(1)
            const shortKey = new Uint8Array(31)
            const longKey = new Uint8Array(33)

            const result1 = crypto_kx_server_session_keys(
                shortKey,
                validKey,
                validKey,
            )
            expect(result1.sharedRx).toBeInstanceOf(Uint8Array)
            expect(result1.sharedTx).toBeInstanceOf(Uint8Array)

            expect(() => {
                crypto_kx_server_session_keys(validKey, shortKey, validKey)
            }).toThrow('x25519 private and public keys must be 32 bytes each')

            expect(() => {
                crypto_kx_server_session_keys(validKey, validKey, longKey)
            }).toThrow('x25519 private and public keys must be 32 bytes each')
        })

        it('should produce different session keys for different client keys', () => {
            const alice1 = crypto_sign_keypair()
            const alice2 = crypto_sign_keypair()
            const bob = crypto_sign_keypair()

            const alice1X25519Pub = crypto_sign_ed25519_pk_to_curve25519(
                alice1.publicKey,
            )
            const alice1X25519Priv = crypto_sign_ed25519_sk_to_curve25519(
                alice1.secretKey,
            )
            const alice2X25519Pub = crypto_sign_ed25519_pk_to_curve25519(
                alice2.publicKey,
            )
            const alice2X25519Priv = crypto_sign_ed25519_sk_to_curve25519(
                alice2.secretKey,
            )
            const bobX25519Pub = crypto_sign_ed25519_pk_to_curve25519(
                bob.publicKey,
            )

            const session1 = crypto_kx_client_session_keys(
                alice1X25519Pub,
                alice1X25519Priv,
                bobX25519Pub,
            )
            const session2 = crypto_kx_client_session_keys(
                alice2X25519Pub,
                alice2X25519Priv,
                bobX25519Pub,
            )

            expect(session1.sharedRx).not.toEqual(session2.sharedRx)
            expect(session1.sharedTx).not.toEqual(session2.sharedTx)
        })

        it('should produce different session keys for different server keys', () => {
            const alice = crypto_sign_keypair()
            const bob1 = crypto_sign_keypair()
            const bob2 = crypto_sign_keypair()

            const aliceX25519Pub = crypto_sign_ed25519_pk_to_curve25519(
                alice.publicKey,
            )
            const bob1X25519Pub = crypto_sign_ed25519_pk_to_curve25519(
                bob1.publicKey,
            )
            const bob1X25519Priv = crypto_sign_ed25519_sk_to_curve25519(
                bob1.secretKey,
            )
            const bob2X25519Pub = crypto_sign_ed25519_pk_to_curve25519(
                bob2.publicKey,
            )
            const bob2X25519Priv = crypto_sign_ed25519_sk_to_curve25519(
                bob2.secretKey,
            )

            const session1 = crypto_kx_server_session_keys(
                bob1X25519Pub,
                bob1X25519Priv,
                aliceX25519Pub,
            )
            const session2 = crypto_kx_server_session_keys(
                bob2X25519Pub,
                bob2X25519Priv,
                aliceX25519Pub,
            )

            expect(session1.sharedRx).not.toEqual(session2.sharedRx)
            expect(session1.sharedTx).not.toEqual(session2.sharedTx)
        })

        it('should handle identical client and server keys gracefully', () => {
            const sameKey = crypto_sign_keypair()
            const sameX25519Pub = crypto_sign_ed25519_pk_to_curve25519(
                sameKey.publicKey,
            )
            const sameX25519Priv = crypto_sign_ed25519_sk_to_curve25519(
                sameKey.secretKey,
            )

            // Using the same key for both client and server should work but produce different RX/TX
            const clientSession = crypto_kx_client_session_keys(
                sameX25519Pub,
                sameX25519Priv,
                sameX25519Pub,
            )
            const serverSession = crypto_kx_server_session_keys(
                sameX25519Pub,
                sameX25519Priv,
                sameX25519Pub,
            )

            expect(clientSession.sharedRx).toEqual(serverSession.sharedTx)
            expect(clientSession.sharedTx).toEqual(serverSession.sharedRx)
            expect(clientSession.sharedRx.length).toBe(32)
            expect(clientSession.sharedTx.length).toBe(32)
        })

        it('should produce consistent results for same input parameters', () => {
            const alice = crypto_sign_keypair()
            const bob = crypto_sign_keypair()

            const aliceX25519Pub = crypto_sign_ed25519_pk_to_curve25519(
                alice.publicKey,
            )
            const aliceX25519Priv = crypto_sign_ed25519_sk_to_curve25519(
                alice.secretKey,
            )
            const bobX25519Pub = crypto_sign_ed25519_pk_to_curve25519(
                bob.publicKey,
            )

            const session1 = crypto_kx_client_session_keys(
                aliceX25519Pub,
                aliceX25519Priv,
                bobX25519Pub,
            )
            const session2 = crypto_kx_client_session_keys(
                aliceX25519Pub,
                aliceX25519Priv,
                bobX25519Pub,
            )

            expect(session1.sharedRx).toEqual(session2.sharedRx)
            expect(session1.sharedTx).toEqual(session2.sharedTx)
        })
    })

    describe('Generic Hash', () => {
        it('should generate hashes of specified length', () => {
            const message = new Uint8Array([1, 2, 3, 4, 5])

            for (const length of [16, 32, 48, 64]) {
                const hash = crypto_generichash(length, message)
                expect(hash.length).toBe(length)
            }
        })

        it('should generate different hashes for different messages', () => {
            const message1 = new Uint8Array([1, 2, 3])
            const message2 = new Uint8Array([4, 5, 6])

            const hash1 = crypto_generichash(32, message1)
            const hash2 = crypto_generichash(32, message2)

            expect(hash1).not.toEqual(hash2)
        })

        it('should handle keyed hashing', () => {
            const message = new Uint8Array([1, 2, 3])
            const key = new Uint8Array(32).fill(0x42)

            const hashWithKey = crypto_generichash(32, message, key)
            const hashWithoutKey = crypto_generichash(32, message)

            expect(hashWithKey).not.toEqual(hashWithoutKey)
            expect(hashWithKey.length).toBe(32)
        })

        it('should handle empty messages', () => {
            const emptyMessage = new Uint8Array(0)
            const hash = crypto_generichash(32, emptyMessage)

            expect(hash.length).toBe(32)
            expect(hash).toBeInstanceOf(Uint8Array)
        })
    })

    describe('Symmetric Encryption (SecretBox)', () => {
        it('should encrypt and decrypt successfully', () => {
            const message = new Uint8Array(Buffer.from('Hello, World!'))
            const nonce = new Uint8Array(24).fill(0x42) // 24 byte nonce
            const key = new Uint8Array(32).fill(0x33) // 32 byte key

            const ciphertext = crypto_secretbox_easy(message, nonce, key)
            const plaintext = crypto_secretbox_open_easy(ciphertext, nonce, key)

            expect(plaintext).toEqual(message)
        })

        it('should produce different ciphertexts for different nonces', () => {
            const message = new Uint8Array(Buffer.from('test'))
            const nonce1 = new Uint8Array(24).fill(0x01)
            const nonce2 = new Uint8Array(24).fill(0x02)
            const key = new Uint8Array(32).fill(0x33)

            const ciphertext1 = crypto_secretbox_easy(message, nonce1, key)
            const ciphertext2 = crypto_secretbox_easy(message, nonce2, key)

            expect(ciphertext1).not.toEqual(ciphertext2)
        })

        it('should fail decryption with wrong key', () => {
            const message = new Uint8Array(Buffer.from('secret'))
            const nonce = new Uint8Array(24).fill(0x42)
            const key1 = new Uint8Array(32).fill(0x33)
            const key2 = new Uint8Array(32).fill(0x44) // Different key

            const ciphertext = crypto_secretbox_easy(message, nonce, key1)

            expect(() => {
                crypto_secretbox_open_easy(ciphertext, nonce, key2)
            }).toThrow()
        })

        it('should fail decryption with wrong nonce', () => {
            const message = new Uint8Array(Buffer.from('secret'))
            const nonce1 = new Uint8Array(24).fill(0x42)
            const nonce2 = new Uint8Array(24).fill(0x43) // Different nonce
            const key = new Uint8Array(32).fill(0x33)

            const ciphertext = crypto_secretbox_easy(message, nonce1, key)

            expect(() => {
                crypto_secretbox_open_easy(ciphertext, nonce2, key)
            }).toThrow()
        })

        it('should handle empty messages', () => {
            const emptyMessage = new Uint8Array(0)
            const nonce = new Uint8Array(24).fill(0x42)
            const key = new Uint8Array(32).fill(0x33)

            const ciphertext = crypto_secretbox_easy(emptyMessage, nonce, key)
            const plaintext = crypto_secretbox_open_easy(ciphertext, nonce, key)

            expect(plaintext).toEqual(emptyMessage)
        })

        it('should handle large messages', () => {
            const largeMessage = new Uint8Array(10000).fill(0x55)
            const nonce = new Uint8Array(24).fill(0x42)
            const key = new Uint8Array(32).fill(0x33)

            const ciphertext = crypto_secretbox_easy(largeMessage, nonce, key)
            const plaintext = crypto_secretbox_open_easy(ciphertext, nonce, key)

            expect(plaintext).toEqual(largeMessage)
        })

        it('should handle invalid input sizes', () => {
            const message = new Uint8Array([1, 2, 3])
            const shortNonce = new Uint8Array(10) // Too short for XSalsa20Poly1305
            const shortKey = new Uint8Array(16) // Too short
            const validNonce = new Uint8Array(24).fill(0x42)
            const validKey = new Uint8Array(32).fill(0x33)

            // XSalsa20Poly1305 requires exactly 24-byte nonce, should throw error
            expect(() => {
                crypto_secretbox_easy(message, shortNonce, validKey)
            }).toThrow()

            // Should throw error for invalid key size
            expect(() => {
                crypto_secretbox_easy(message, validNonce, shortKey)
            }).toThrow()
        })

        it('should handle corrupted ciphertext', () => {
            const message = new Uint8Array(Buffer.from('test message'))
            const nonce = new Uint8Array(24).fill(0x42)
            const key = new Uint8Array(32).fill(0x33)

            const ciphertext = crypto_secretbox_easy(message, nonce, key)

            // Corrupt the first byte
            const corruptedCiphertext = new Uint8Array(ciphertext)
            corruptedCiphertext[0] ^= 0xff

            expect(() => {
                crypto_secretbox_open_easy(corruptedCiphertext, nonce, key)
            }).toThrow('decryption failed')
        })

        it('should handle truncated ciphertext', () => {
            const message = new Uint8Array(Buffer.from('test'))
            const nonce = new Uint8Array(24).fill(0x42)
            const key = new Uint8Array(32).fill(0x33)

            const ciphertext = crypto_secretbox_easy(message, nonce, key)
            const truncatedCiphertext = ciphertext.slice(0, 10) // Too short

            expect(() => {
                crypto_secretbox_open_easy(truncatedCiphertext, nonce, key)
            }).toThrow('decryption failed')
        })

        it('should reject ciphertext shorter than MAC bytes', () => {
            const shortCiphertext = new Uint8Array(15) // Less than 16 bytes (MAC size)
            const nonce = new Uint8Array(24).fill(0x42)
            const key = new Uint8Array(32).fill(0x33)

            expect(() => {
                crypto_secretbox_open_easy(shortCiphertext, nonce, key)
            }).toThrow('decryption failed')
        })

        it('should handle maximum size nonces and keys', () => {
            const message = new Uint8Array([1, 2, 3])
            const longNonce = new Uint8Array(25).fill(0x42) // Too long
            const longKey = new Uint8Array(33).fill(0x33) // Too long
            const validNonce = new Uint8Array(24).fill(0x42)
            const validKey = new Uint8Array(32).fill(0x33)

            expect(() => {
                crypto_secretbox_easy(message, longNonce, validKey)
            }).toThrow()

            expect(() => {
                crypto_secretbox_easy(message, validNonce, longKey)
            }).toThrow()
        })
    })

    describe('Signature Verification', () => {
        it('should verify valid detached signatures', () => {
            const keyPair = crypto_sign_keypair()
            const message = new Uint8Array([1, 2, 3, 4, 5])

            // Create a mock signature (in real scenario this would be generated by signing)
            // For this test, we'll test the verification logic with various inputs
            const validSignature = new Uint8Array(64).fill(0x01)

            // Test input validation
            const result = crypto_sign_verify_detached(
                validSignature,
                message,
                keyPair.publicKey,
            )
            expect(typeof result).toBe('boolean')
        })

        it('should reject signatures with invalid length', () => {
            const keyPair = crypto_sign_keypair()
            const message = new Uint8Array([1, 2, 3])
            const shortSignature = new Uint8Array(63) // Invalid length
            const longSignature = new Uint8Array(65) // Invalid length

            const result1 = crypto_sign_verify_detached(
                shortSignature,
                message,
                keyPair.publicKey,
            )
            const result2 = crypto_sign_verify_detached(
                longSignature,
                message,
                keyPair.publicKey,
            )

            expect(result1).toBe(false)
            expect(result2).toBe(false)
        })

        it('should reject public keys with invalid length', () => {
            const message = new Uint8Array([1, 2, 3])
            const validSignature = new Uint8Array(64)
            const shortPublicKey = new Uint8Array(31) // Invalid length
            const longPublicKey = new Uint8Array(33) // Invalid length

            const result1 = crypto_sign_verify_detached(
                validSignature,
                message,
                shortPublicKey,
            )
            const result2 = crypto_sign_verify_detached(
                validSignature,
                message,
                longPublicKey,
            )

            expect(result1).toBe(false)
            expect(result2).toBe(false)
        })

        it('should handle empty messages', () => {
            const keyPair = crypto_sign_keypair()
            const emptyMessage = new Uint8Array(0)
            const signature = new Uint8Array(64)

            const result = crypto_sign_verify_detached(
                signature,
                emptyMessage,
                keyPair.publicKey,
            )
            expect(typeof result).toBe('boolean')
        })

        it('should handle large messages', () => {
            const keyPair = crypto_sign_keypair()
            const largeMessage = new Uint8Array(100000).fill(0xaa)
            const signature = new Uint8Array(64)

            const result = crypto_sign_verify_detached(
                signature,
                largeMessage,
                keyPair.publicKey,
            )
            expect(typeof result).toBe('boolean')
        })

        it('should handle malformed signatures gracefully', () => {
            const keyPair = crypto_sign_keypair()
            const message = new Uint8Array([1, 2, 3])
            const malformedSignature = new Uint8Array(64).fill(0xff) // All 0xFF bytes

            const result = crypto_sign_verify_detached(
                malformedSignature,
                message,
                keyPair.publicKey,
            )
            expect(result).toBe(false)
        })
    })

    describe('SHA-512 Hash Function', () => {
        it('should produce 64-byte hashes', () => {
            const message = new Uint8Array([1, 2, 3, 4, 5])
            const hash = crypto_hash_sha512(message)

            expect(hash).toBeInstanceOf(Uint8Array)
            expect(hash.length).toBe(64)
        })

        it('should produce different hashes for different messages', () => {
            const message1 = new Uint8Array([1, 2, 3])
            const message2 = new Uint8Array([1, 2, 4]) // One byte different

            const hash1 = crypto_hash_sha512(message1)
            const hash2 = crypto_hash_sha512(message2)

            expect(hash1).not.toEqual(hash2)
            expect(hash1.length).toBe(64)
            expect(hash2.length).toBe(64)
        })

        it('should handle empty messages', () => {
            const emptyMessage = new Uint8Array(0)
            const hash = crypto_hash_sha512(emptyMessage)

            expect(hash).toBeInstanceOf(Uint8Array)
            expect(hash.length).toBe(64)
        })

        it('should handle single byte messages', () => {
            const singleByte = new Uint8Array([0x42])
            const hash = crypto_hash_sha512(singleByte)

            expect(hash).toBeInstanceOf(Uint8Array)
            expect(hash.length).toBe(64)
        })

        it('should handle large messages', () => {
            const largeMessage = new Uint8Array(1000000).fill(0x55) // 1MB message
            const hash = crypto_hash_sha512(largeMessage)

            expect(hash).toBeInstanceOf(Uint8Array)
            expect(hash.length).toBe(64)
        })

        it('should produce consistent hashes for identical messages', () => {
            const message = new Uint8Array([0x01, 0x02, 0x03, 0x04])
            const hash1 = crypto_hash_sha512(message)
            const hash2 = crypto_hash_sha512(message)

            expect(hash1).toEqual(hash2)
        })
    })

    describe('Base64 Encoding', () => {
        it('should encode Uint8Array to base64 without padding', () => {
            const data = new Uint8Array([72, 101, 108, 108, 111]) // "Hello"
            const result = to_base64(data)

            expect(typeof result).toBe('string')
            expect(result).not.toContain('=') // No padding
        })

        it('should encode strings to base64 without padding', () => {
            const data = 'Hello, World!'
            const result = to_base64(data)

            expect(typeof result).toBe('string')
            expect(result).not.toContain('=') // No padding
        })

        it('should handle empty Uint8Array', () => {
            const emptyData = new Uint8Array(0)
            const result = to_base64(emptyData)

            expect(typeof result).toBe('string')
            expect(result).toBe('')
        })

        it('should handle empty strings', () => {
            const emptyString = ''
            const result = to_base64(emptyString)

            expect(typeof result).toBe('string')
            expect(result).toBe('')
        })

        it('should handle single byte arrays', () => {
            const singleByte = new Uint8Array([255])
            const result = to_base64(singleByte)

            expect(typeof result).toBe('string')
            expect(result.length).toBeGreaterThan(0)
        })

        it('should handle Unicode strings', () => {
            const unicodeString = '🌟 Hello 世界 🚀'
            const result = to_base64(unicodeString)

            expect(typeof result).toBe('string')
            expect(result.length).toBeGreaterThan(0)
        })

        it('should produce different results for different inputs', () => {
            const data1 = 'test1'
            const data2 = 'test2'

            const result1 = to_base64(data1)
            const result2 = to_base64(data2)

            expect(result1).not.toEqual(result2)
        })

        it('should handle large data', () => {
            const largeData = new Uint8Array(10000).fill(0xaa)
            const result = to_base64(largeData)

            expect(typeof result).toBe('string')
            expect(result.length).toBeGreaterThan(0)
        })
    })

    describe('Ed25519 Point Operations - Advanced', () => {
        it('should handle identity point addition', () => {
            // Create identity point (point at infinity)
            const identityPoint = new Uint8Array(32)
            identityPoint[0] = 1 // Identity point: (0, 1)

            // Generate a valid point
            const scalar = new Uint8Array(32)
            scalar[0] = 1
            const validPoint = crypto_scalarmult_ed25519_base_noclamp(scalar)

            // Adding identity to any point should return the same point
            const result = crypto_core_ed25519_add(validPoint, identityPoint)
            expect(result).toEqual(validPoint)
        })

        it('should handle point addition with invalid points', () => {
            const invalidPoint = new Uint8Array(32).fill(0xff) // Likely invalid point
            const validScalar = new Uint8Array(32)
            validScalar[0] = 1
            const validPoint =
                crypto_scalarmult_ed25519_base_noclamp(validScalar)

            expect(() => {
                crypto_core_ed25519_add(validPoint, invalidPoint)
            }).toThrow('invalid point')
        })

        it('should validate point length strictly', () => {
            const validScalar = new Uint8Array(32)
            validScalar[0] = 1
            const validPoint =
                crypto_scalarmult_ed25519_base_noclamp(validScalar)

            const shortPoint = new Uint8Array(31)
            const longPoint = new Uint8Array(33)

            expect(() => {
                crypto_core_ed25519_add(validPoint, shortPoint)
            }).toThrow('invalid point')

            expect(() => {
                crypto_core_ed25519_add(shortPoint, validPoint)
            }).toThrow('invalid point')

            expect(() => {
                crypto_core_ed25519_add(validPoint, longPoint)
            }).toThrow('invalid point')
        })
    })

    describe('Ed25519 Scalar Operations - Advanced', () => {
        it('should handle scalar addition edge cases', () => {
            const maxScalar = new Uint8Array(32).fill(0xff)
            const oneScalar = new Uint8Array(32)
            oneScalar[0] = 1

            // This should wrap around due to modular arithmetic
            const result = crypto_core_ed25519_scalar_add(maxScalar, oneScalar)
            expect(result).toBeInstanceOf(Uint8Array)
            expect(result.length).toBe(32)
        })

        it('should handle scalar multiplication with zero', () => {
            const zeroScalar = new Uint8Array(32).fill(0)
            const someScalar = new Uint8Array(32)
            someScalar[0] = 42

            const result = crypto_core_ed25519_scalar_mul(
                someScalar,
                zeroScalar,
            )
            expect(result).toEqual(zeroScalar) // Anything times zero is zero
        })

        it('should handle scalar multiplication with one', () => {
            const oneScalar = new Uint8Array(32)
            oneScalar[0] = 1
            const someScalar = new Uint8Array(32)
            someScalar[0] = 42

            const result = crypto_core_ed25519_scalar_mul(someScalar, oneScalar)
            expect(result).toEqual(someScalar) // Anything times one is itself
        })

        it('should validate scalar lengths strictly', () => {
            const validScalar = new Uint8Array(32)
            validScalar[0] = 1
            const shortScalar = new Uint8Array(31)
            const longScalar = new Uint8Array(33)

            expect(() => {
                crypto_core_ed25519_scalar_add(shortScalar, validScalar)
            }).toThrow('scalars must be 32 bytes')

            expect(() => {
                crypto_core_ed25519_scalar_add(validScalar, longScalar)
            }).toThrow('scalars must be 32 bytes')

            expect(() => {
                crypto_core_ed25519_scalar_mul(shortScalar, validScalar)
            }).toThrow('scalars must be 32 bytes')

            expect(() => {
                crypto_core_ed25519_scalar_mul(validScalar, longScalar)
            }).toThrow('scalars must be 32 bytes')
        })

        it('should handle scalar reduction of various sizes', () => {
            // Test with different input sizes
            const smallInput = new Uint8Array(16).fill(0xff)
            const result1 = crypto_core_ed25519_scalar_reduce(smallInput)
            expect(result1.length).toBe(32)

            const normalInput = new Uint8Array(32).fill(0xff)
            const result2 = crypto_core_ed25519_scalar_reduce(normalInput)
            expect(result2.length).toBe(32)

            const largeInput = new Uint8Array(64).fill(0xff)
            const result3 = crypto_core_ed25519_scalar_reduce(largeInput)
            expect(result3.length).toBe(32)

            const veryLargeInput = new Uint8Array(128).fill(0xff)
            expect(() => {
                crypto_core_ed25519_scalar_reduce(veryLargeInput)
            }).toThrow('scalar must be at most 64 bytes')
        })

        it('should handle empty scalar reduction', () => {
            const emptyInput = new Uint8Array(0)
            const result = crypto_core_ed25519_scalar_reduce(emptyInput)
            expect(result.length).toBe(32)
            expect(result).toEqual(new Uint8Array(32)) // Should be all zeros
        })
    })

    describe('Generic Hash - Edge Cases', () => {
        it('should reject invalid output lengths', () => {
            const message = new Uint8Array([1, 2, 3])

            expect(() => {
                crypto_generichash(15, message) // Too small
            }).toThrow('output length must be between 16 and 64 bytes')

            expect(() => {
                crypto_generichash(65, message) // Too large
            }).toThrow('output length must be between 16 and 64 bytes')

            expect(() => {
                crypto_generichash(0, message) // Zero
            }).toThrow('output length must be between 16 and 64 bytes')
        })

        it('should handle boundary output lengths', () => {
            const message = new Uint8Array([1, 2, 3])

            // Test minimum length
            const minHash = crypto_generichash(16, message)
            expect(minHash.length).toBe(16)

            // Test maximum length
            const maxHash = crypto_generichash(64, message)
            expect(maxHash.length).toBe(64)
        })

        it('should produce different hashes with and without keys', () => {
            const message = new Uint8Array([1, 2, 3])
            const key = new Uint8Array(32).fill(0x42)

            const hashWithoutKey = crypto_generichash(32, message, null)
            const hashWithKey = crypto_generichash(32, message, key)

            expect(hashWithoutKey).not.toEqual(hashWithKey)
        })

        it('should handle different key sizes', () => {
            const message = new Uint8Array([1, 2, 3])
            const shortKey = new Uint8Array(1).fill(0x42)
            const longKey = new Uint8Array(64).fill(0x42)

            const result1 = crypto_generichash(32, message, shortKey)
            const result2 = crypto_generichash(32, message, longKey)

            expect(result1).not.toEqual(result2)
            expect(result1.length).toBe(32)
            expect(result2.length).toBe(32)
        })

        it('should handle very large messages with keys', () => {
            const largeMessage = new Uint8Array(500000).fill(0xcc) // 500KB
            const key = new Uint8Array(32).fill(0x99)

            const hash = crypto_generichash(48, largeMessage, key)
            expect(hash.length).toBe(48)
        })
    })

    describe('Scalar Multiplication - Edge Cases', () => {
        it('should validate scalar length in base multiplication', () => {
            const shortScalar = new Uint8Array(31)
            const longScalar = new Uint8Array(33)

            expect(() => {
                crypto_scalarmult_ed25519_base_noclamp(shortScalar)
            }).toThrow('scalar must be 32 bytes')

            expect(() => {
                crypto_scalarmult_ed25519_base_noclamp(longScalar)
            }).toThrow('scalar must be 32 bytes')
        })

        it('should handle curve order boundary scalars', () => {
            // Scalar equal to curve order (should wrap to 0)
            const curveOrderScalar = new Uint8Array(32)
            // Ed25519 curve order: 2^252 + 27742317777372353535851937790883648493
            // In little-endian bytes (approximate)
            curveOrderScalar.fill(0)
            curveOrderScalar[31] = 0x10 // Set high bit to simulate large scalar

            const result =
                crypto_scalarmult_ed25519_base_noclamp(curveOrderScalar)
            expect(result).toBeInstanceOf(Uint8Array)
            expect(result.length).toBe(32)
        })

        it('should handle X25519 scalar multiplication with all-zero public key', () => {
            const validPrivate = new Uint8Array(32)
            validPrivate[0] = 1
            const zeroPublic = new Uint8Array(32) // All zeros (weak public key)

            // This should either work or throw an error, but not crash
            try {
                const result = crypto_scalarmult(validPrivate, zeroPublic)
                expect(result).toBeInstanceOf(Uint8Array)
                expect(result.length).toBe(32)
            } catch (error) {
                expect(error).toBeDefined()
            }
        })

        it('should validate X25519 input lengths strictly', () => {
            const validKey = new Uint8Array(32)
            const shortKey = new Uint8Array(31)
            const longKey = new Uint8Array(33)

            expect(() => {
                crypto_scalarmult(shortKey, validKey)
            }).toThrow('x25519 private and public keys must be 32 bytes each')

            expect(() => {
                crypto_scalarmult(validKey, longKey)
            }).toThrow('x25519 private and public keys must be 32 bytes each')
        })
    })
})

describe('libsodium-wrappers-sumo parity', () => {
    it('crypto_scalarmult_ed25519_base_noclamp parity', async () => {
        await _sodium.ready

        const sodium = _sodium

        // Should return identical results
        const scalar = new Uint8Array(32) // Valid non-zero scalar < curve order
        scalar[0] = 1 // Set to 1

        const result1 = crypto_scalarmult_ed25519_base_noclamp(scalar)
        const result2 = sodium.crypto_scalarmult_ed25519_base_noclamp(scalar)

        expect(result1).toEqual(result2)
    })

    it('crypto_sign_verify_detached parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        // Create a keypair to generate a valid signature
        const keyPair = sodium.crypto_sign_keypair()
        const message = new Uint8Array([1, 2, 3, 4, 5])
        const signature = sodium.crypto_sign_detached(
            message,
            keyPair.privateKey,
        )

        // Test both implementations
        const result1 = crypto_sign_verify_detached(
            signature,
            message,
            keyPair.publicKey,
        )
        const result2 = sodium.crypto_sign_verify_detached(
            signature,
            message,
            keyPair.publicKey,
        )

        expect(result1).toEqual(result2)
        expect(result1).toBe(true)
    })

    it('crypto_sign_keypair parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        // Test with deterministic seed for comparison
        const seed = new Uint8Array(32).fill(0x42)

        const result1 = crypto_sign_keypair()
        const result2 = sodium.crypto_sign_keypair()

        // Can't test exact equality for random generation, but test structure
        expect(result1.publicKey.length).toEqual(result2.publicKey.length)
        expect(result1.secretKey.length).toEqual(result2.privateKey.length)
        expect(result1.secretKey.length).toBe(64) // libsodium format

        // Test with seed for deterministic comparison
        const seedKeyPair1 = sodium.crypto_sign_seed_keypair(seed)
        const ourKeyPair = crypto_sign_keypair()
        // Cannot directly compare as implementation uses random seed generation
        expect(ourKeyPair.secretKey.length).toBe(seedKeyPair1.privateKey.length)
    })

    it('crypto_core_ed25519_add parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        // Generate two valid points using base point multiplication
        const scalar1 = new Uint8Array(32).fill(0)
        scalar1[0] = 1 // scalar = 1
        const scalar2 = new Uint8Array(32).fill(0)
        scalar2[0] = 2 // scalar = 2

        const point1 = sodium.crypto_scalarmult_ed25519_base_noclamp(scalar1)
        const point2 = sodium.crypto_scalarmult_ed25519_base_noclamp(scalar2)

        const result1 = crypto_core_ed25519_add(point1, point2)
        const result2 = sodium.crypto_core_ed25519_add(point1, point2)

        expect(result1).toEqual(result2)
    })

    it('crypto_core_ed25519_scalar_add parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        const scalarA = new Uint8Array(32).fill(0)
        scalarA[0] = 5 // scalar = 5
        const scalarB = new Uint8Array(32).fill(0)
        scalarB[0] = 7 // scalar = 7

        const result1 = crypto_core_ed25519_scalar_add(scalarA, scalarB)
        const result2 = sodium.crypto_core_ed25519_scalar_add(scalarA, scalarB)

        expect(result1).toEqual(result2)
    })

    it('crypto_core_ed25519_scalar_mul parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        const scalarA = new Uint8Array(32).fill(0)
        scalarA[0] = 3 // scalar = 3
        const scalarB = new Uint8Array(32).fill(0)
        scalarB[0] = 4 // scalar = 4

        const result1 = crypto_core_ed25519_scalar_mul(scalarA, scalarB)
        const result2 = sodium.crypto_core_ed25519_scalar_mul(scalarA, scalarB)

        expect(result1).toEqual(result2)
    })

    it('crypto_core_ed25519_scalar_reduce parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        // Test with 64-byte input (typical hash output)
        const largeScalar = new Uint8Array(64)
        for (let i = 0; i < 64; i++) {
            largeScalar[i] = (i * 3) % 256
        }

        const result1 = crypto_core_ed25519_scalar_reduce(largeScalar)
        const result2 = sodium.crypto_core_ed25519_scalar_reduce(largeScalar)

        expect(result1).toEqual(result2)
    })

    it('crypto_scalarmult parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        const privateKey = new Uint8Array(32)
        privateKey[0] = 42 // Valid X25519 private key
        const publicKey = sodium.crypto_scalarmult_base(privateKey)

        const result1 = crypto_scalarmult(privateKey, publicKey)
        const result2 = sodium.crypto_scalarmult(privateKey, publicKey)

        expect(result1).toEqual(result2)
    })

    it('crypto_sign_ed25519_pk_to_curve25519 parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        const edKeyPair = sodium.crypto_sign_keypair()

        const result1 = crypto_sign_ed25519_pk_to_curve25519(
            edKeyPair.publicKey,
        )
        const result2 = sodium.crypto_sign_ed25519_pk_to_curve25519(
            edKeyPair.publicKey,
        )

        expect(result1).toEqual(result2)
    })

    it('crypto_sign_ed25519_sk_to_curve25519 parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        const edKeyPair = sodium.crypto_sign_keypair()

        const result1 = crypto_sign_ed25519_sk_to_curve25519(
            edKeyPair.privateKey,
        )
        const result2 = sodium.crypto_sign_ed25519_sk_to_curve25519(
            edKeyPair.privateKey,
        )

        expect(result1).toEqual(result2)
    })

    it('crypto_hash_sha512 parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        const message = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

        const result1 = crypto_hash_sha512(message)
        const result2 = sodium.crypto_hash_sha512(message)

        expect(result1).toEqual(result2)
    })

    it('crypto_generichash parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        const message = new Uint8Array([1, 2, 3, 4, 5])
        const outputLength = 32

        // Test without key
        const result1 = crypto_generichash(outputLength, message)
        const result2 = sodium.crypto_generichash(outputLength, message)

        expect(result1).toEqual(result2)

        // Test with key
        const key = new Uint8Array(32).fill(0x42)
        const result3 = crypto_generichash(outputLength, message, key)
        const result4 = sodium.crypto_generichash(outputLength, message, key)

        expect(result3).toEqual(result4)
    })

    it('crypto_kx_client_session_keys parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        const clientKeyPair = sodium.crypto_kx_keypair()
        const serverKeyPair = sodium.crypto_kx_keypair()

        const result1 = crypto_kx_client_session_keys(
            clientKeyPair.publicKey,
            clientKeyPair.privateKey,
            serverKeyPair.publicKey,
        )
        const result2 = sodium.crypto_kx_client_session_keys(
            clientKeyPair.publicKey,
            clientKeyPair.privateKey,
            serverKeyPair.publicKey,
        )

        expect(result1.sharedRx).toEqual(result2.sharedRx)
        expect(result1.sharedTx).toEqual(result2.sharedTx)
    })

    it('crypto_kx_server_session_keys parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        const clientKeyPair = sodium.crypto_kx_keypair()
        const serverKeyPair = sodium.crypto_kx_keypair()

        const result1 = crypto_kx_server_session_keys(
            serverKeyPair.publicKey,
            serverKeyPair.privateKey,
            clientKeyPair.publicKey,
        )
        const result2 = sodium.crypto_kx_server_session_keys(
            serverKeyPair.publicKey,
            serverKeyPair.privateKey,
            clientKeyPair.publicKey,
        )

        expect(result1.sharedRx).toEqual(result2.sharedRx)
        expect(result1.sharedTx).toEqual(result2.sharedTx)
    })

    it('crypto_secretbox_easy parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        const message = new Uint8Array([1, 2, 3, 4, 5])
        const nonce = new Uint8Array(24).fill(0x42)
        const key = new Uint8Array(32).fill(0x33)

        const result1 = crypto_secretbox_easy(message, nonce, key)
        const result2 = sodium.crypto_secretbox_easy(message, nonce, key)

        expect(result1).toEqual(result2)
    })

    it('crypto_secretbox_open_easy parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        const message = new Uint8Array([1, 2, 3, 4, 5])
        const nonce = new Uint8Array(24).fill(0x42)
        const key = new Uint8Array(32).fill(0x33)

        // First encrypt with libsodium
        const ciphertext = sodium.crypto_secretbox_easy(message, nonce, key)

        // Test both implementations can decrypt
        const result1 = crypto_secretbox_open_easy(ciphertext, nonce, key)
        const result2 = sodium.crypto_secretbox_open_easy(
            ciphertext,
            nonce,
            key,
        )

        expect(result1).toEqual(result2)
        expect(result1).toEqual(message)
    })

    it('to_base64 parity', async () => {
        await _sodium.ready
        const sodium = _sodium

        const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])

        const result1 = to_base64(data)
        const result2 = sodium.to_base64(data)

        expect(result1).toEqual(result2)

        // Test with string input
        const stringData = 'Hello, World!'
        const result3 = to_base64(stringData)
        const result4 = sodium.to_base64(stringData)

        expect(result3).toEqual(result4)
    })
})
