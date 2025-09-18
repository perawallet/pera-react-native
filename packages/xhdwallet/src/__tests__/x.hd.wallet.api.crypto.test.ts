// NOTE - these tests do not currently run or pass using vite.  More investigation is needed!

import {
	describe,
	test,
	expect,
	afterEach,
	beforeEach,
	beforeAll,
} from 'vitest'
import type { CryptoKX, KeyPair } from 'libsodium-wrappers-sumo'
import * as bip39 from 'bip39'
import { randomBytes } from 'crypto'
import {
	XHDWalletAPI,
	ERROR_TAGS_FOUND,
	type SignMetadata,
	harden,
	KeyContexts,
	BIP32DerivationTypes,
	Encodings,
} from '../x.hd.wallet.api.crypto'
import * as msgpack from 'algo-msgpack-with-bigint'
import {
	deriveChildNodePrivate,
	deriveChildNodePublic,
	fromSeed,
} from '../bip32-ed25519-impl'
import { sha512_256 } from 'js-sha512'
import base32 from 'hi-base32'
import { type JSONSchemaType } from 'ajv'
import { readFileSync } from 'fs'
import path from 'node:path'
import nacl from 'tweetnacl'

//@ts-expect-error, no types found
import * as otherLibBip32Ed25519 from 'bip32-ed25519'
import { fileURLToPath } from 'node:url'
import loadLibSodium from '../sumo'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function encodeAddress(publicKey: Buffer): string {
	const keyHash: string = sha512_256.create().update(publicKey).hex()

	// last 4 bytes of the hash
	const checksum: string = keyHash.slice(-8)

	return base32
		.encode(ConcatArrays(publicKey, Buffer.from(checksum, 'hex')))
		.slice(0, 58)
}

function ConcatArrays(...arrs: ArrayLike<number>[]) {
	const size = arrs.reduce((sum, arr) => sum + arr.length, 0)
	const c = new Uint8Array(size)

	let offset = 0
	for (let i = 0; i < arrs.length; i++) {
		c.set(arrs[i], offset)
		offset += arrs[i].length
	}

	return c
}

describe('Contextual Derivation & Signing', () => {
	let cryptoService: XHDWalletAPI
	let bip39Mnemonic: string =
		'salon zoo engage submit smile frost later decide wing sight chaos renew lizard rely canal coral scene hobby scare step bus leaf tobacco slice'
	let rootKey: Uint8Array

	beforeAll(() => {
		rootKey = fromSeed(bip39.mnemonicToSeedSync(bip39Mnemonic, ''))
	})

	beforeEach(() => {
		cryptoService = new XHDWalletAPI()
	})

	afterEach(() => {})

	/**
	 * Testing against other known bip32-ed25519 lib that complies with the BIP32-Ed25519 specification
	 *
	 * @see BIP32-ed25519 Hierarchical Deterministic Keys over a Non-linear Keyspace (https://acrobat.adobe.com/id/urn:aaid:sc:EU:04fe29b0-ea1a-478b-a886-9bb558a5242a)
	 *
	 * We call the traditional derivation Khovratovich
	 */
	describe('\(JS Library) Reference Implementation alignment with known BIP32-Ed25519 JS LIB', () => {
		test("\(OK) BIP32-Ed25519 derive key m'/44'/283'/0'/0/0", async () => {
			const key: Uint8Array = await cryptoService.keyGen(
				rootKey,
				KeyContexts.Address,
				0,
				0,
				BIP32DerivationTypes.Khovratovich,
			)

			let derivedKey: Uint8Array = otherLibBip32Ed25519.derivePrivate(
				Buffer.from(rootKey),
				harden(44),
			)
			derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, harden(283))
			derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, harden(0))
			derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, 0)
			derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, 0)

			const scalar = derivedKey.subarray(0, 32) // scalar == pvtKey
			const { crypto_scalarmult_ed25519_base_noclamp } = await loadLibSodium()
			const derivedPub: Uint8Array = crypto_scalarmult_ed25519_base_noclamp(scalar) // calculate public key
			await expect(derivedPub).toEqual(key)
		})

		test("\(OK) BIP32-Ed25519 derive key m'/44'/283'/0'/0/1", async () => {
			const key: Uint8Array = await cryptoService.keyGen(
				rootKey,
				KeyContexts.Address,
				0,
				1,
				BIP32DerivationTypes.Khovratovich,
			)

			let derivedKey: Uint8Array = otherLibBip32Ed25519.derivePrivate(
				Buffer.from(rootKey),
				harden(44),
			)
			derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, harden(283))
			derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, harden(0))
			derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, 0)
			derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, 1)

			const scalar = derivedKey.subarray(0, 32) // scalar == pvtKey
			const { crypto_scalarmult_ed25519_base_noclamp } = await loadLibSodium()
			const derivedPub: Uint8Array = crypto_scalarmult_ed25519_base_noclamp(scalar) // calculate public key
			await expect(derivedPub).toEqual(key)
		})

		test("\(OK) BIP32-Ed25519 derive PUBLIC key m'/44'/283'/1'/0/1", async () => {
			const key: Uint8Array = await cryptoService.keyGen(
				rootKey,
				KeyContexts.Address,
				1,
				1,
				BIP32DerivationTypes.Khovratovich,
			)

			let derivedKey: Uint8Array = otherLibBip32Ed25519.derivePrivate(
				Buffer.from(rootKey),
				harden(44),
			)
			derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, harden(283))
			derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, harden(1))

			// ext private => ext public format!
			const nodeScalar: Uint8Array = derivedKey.subarray(0, 32)
			const { crypto_scalarmult_ed25519_base_noclamp } = await loadLibSodium()
			const nodePublic: Uint8Array =
				crypto_scalarmult_ed25519_base_noclamp(nodeScalar)
			const nodeCC: Uint8Array = derivedKey.subarray(64, 96)

			// [Public][ChainCode]
			const extPub: Buffer = Buffer.concat([nodePublic, nodeCC])

			derivedKey = otherLibBip32Ed25519.derivePublic(extPub, 0)
			derivedKey = otherLibBip32Ed25519.derivePublic(derivedKey, 1)

			const derivedPub = new Uint8Array(derivedKey.subarray(0, 32)) // public key from extended format
			await expect(derivedPub).toEqual(key)
		})

		test("\(OK) BIP32-Ed25519 derive PUBLIC key m'/44'/0'/1'/0/2", async () => {
			const key: Uint8Array = await cryptoService.keyGen(
				rootKey,
				KeyContexts.Identity,
				1,
				2,
				BIP32DerivationTypes.Khovratovich,
			)

			let derivedKey: Uint8Array = otherLibBip32Ed25519.derivePrivate(
				Buffer.from(rootKey),
				harden(44),
			)
			derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, harden(0))
			derivedKey = otherLibBip32Ed25519.derivePrivate(derivedKey, harden(1))

			// ext private => ext public format!
			const nodeScalar: Uint8Array = derivedKey.subarray(0, 32)
			const { crypto_scalarmult_ed25519_base_noclamp } = await loadLibSodium()
			const nodePublic: Uint8Array =
				crypto_scalarmult_ed25519_base_noclamp(nodeScalar)
			const nodeCC: Uint8Array = derivedKey.subarray(64, 96)

			// [Public][ChainCode]
			const extPub: Buffer = Buffer.concat([nodePublic, nodeCC])

			derivedKey = otherLibBip32Ed25519.derivePublic(extPub, 0)
			derivedKey = otherLibBip32Ed25519.derivePublic(derivedKey, 2)

			const derivedPub = new Uint8Array(derivedKey.subarray(0, 32)) // public key from extended format
			await expect(derivedPub).toEqual(key)
		})
	})

	test('\(OK) Root Key', async () => {
		await expect(rootKey.length).toBe(96)
		await expect(Buffer.from(rootKey)).toEqual(
			Buffer.from(
				'a8ba80028922d9fcfa055c78aede55b5c575bcd8d5a53168edf45f36d9ec8f4694592b4bc892907583e22669ecdf1b0409a9f3bd5549f2dd751b51360909cd05796b9206ec30e142e94b790a98805bf999042b55046963174ee6cee2d0375946',
				'hex',
			),
		)
	})

	describe('\(Derivations) Context', () => {
		describe('Addresses', () => {
			describe('Soft Derivations', () => {
				test("\(OK) Derive m'/44'/283'/0'/0/0 Algorand Address Key", async () => {
					const key: Uint8Array = await cryptoService.keyGen(
						rootKey,
						KeyContexts.Address,
						0,
						0,
					)
					await expect(key).toEqual(
						new Uint8Array(
							Buffer.from(
								'7bda7ac12627b2c259f1df6875d30c10b35f55b33ad2cc8ea2736eaa3ebcfab9',
								'hex',
							),
						),
					)
				})

				test("\(OK) Derive m'/44'/283'/0'/0/1 Algorand Address Key", async () => {
					const key: Uint8Array = await cryptoService.keyGen(
						rootKey,
						KeyContexts.Address,
						0,
						1,
					)
					await expect(key).toEqual(
						new Uint8Array(
							Buffer.from(
								'5bae8828f111064637ac5061bd63bc4fcfe4a833252305f25eeab9c64ecdf519',
								'hex',
							),
						),
					)
				})

				test("\(OK) Derive m'/44'/283'/0'/0/2 Algorand Address Key", async () => {
					const key: Uint8Array = await cryptoService.keyGen(
						rootKey,
						KeyContexts.Address,
						0,
						2,
					)
					await expect(key).toEqual(
						new Uint8Array(
							Buffer.from(
								'00a72635e97cba966529e9bfb4baf4a32d7b8cd2fcd8e2476ce5be1177848cb3',
								'hex',
							),
						),
					)
				})
			})

			describe('Hard Derivations', () => {
				test("\(OK) Derive m'/44'/283'/1'/0/0 Algorand Address Key", async () => {
					const key: Uint8Array = await cryptoService.keyGen(
						rootKey,
						KeyContexts.Address,
						1,
						0,
					)
					await expect(key).toEqual(
						new Uint8Array(
							Buffer.from(
								'358d8c4382992849a764438e02b1c45c2ca4e86bbcfe10fd5b963f3610012bc9',
								'hex',
							),
						),
					)
				})

				test("\(OK) Derive m'/44'/283'/2'/0/1 Algorand Address Key", async () => {
					const key: Uint8Array = await cryptoService.keyGen(
						rootKey,
						KeyContexts.Address,
						2,
						1,
					)
					await expect(key).toEqual(
						new Uint8Array(
							Buffer.from(
								'1f0f75fbbca12b22523973191061b2f96522740e139a3420c730717ac5b0dfc0',
								'hex',
							),
						),
					)
				})

				test("\(OK) Derive m'/44'/283'/3'/0/0 Algorand Address Key", async () => {
					const key: Uint8Array = await cryptoService.keyGen(
						rootKey,
						KeyContexts.Address,
						3,
						0,
					)
					await expect(key).toEqual(
						new Uint8Array(
							Buffer.from(
								'f035316f915b342ea5fe78dccb59d907b93805732219d436a1bd8488ff4e5b1b',
								'hex',
							),
						),
					)
				})
			})
		})

		describe('Identities', () => {
			describe('Soft Derivations', () => {
				test("\(OK) Derive m'/44'/0'/0'/0/0 Identity Key", async () => {
					const key: Uint8Array = await cryptoService.keyGen(
						rootKey,
						KeyContexts.Identity,
						0,
						0,
					)
					await expect(key).toEqual(
						new Uint8Array(
							Buffer.from(
								'ff8b1863ef5e40d0a48c245f26a6dbdf5da94dc75a1851f51d8a04e547bd5f5a',
								'hex',
							),
						),
					)
				})

				test("\(OK) Derive m'/44'/0'/0'/0/1 Identity Key", async () => {
					const key: Uint8Array = await cryptoService.keyGen(
						rootKey,
						KeyContexts.Identity,
						0,
						1,
					)
					await expect(key).toEqual(
						new Uint8Array(
							Buffer.from(
								'2b46c2af0890493e486049d456509a0199e565b41a5fb622f0ea4b9337bd2b97',
								'hex',
							),
						),
					)
				})

				test("\(OK) Derive m'/44'/0'/0'/0/2 Identity Key", async () => {
					const key: Uint8Array = await cryptoService.keyGen(
						rootKey,
						KeyContexts.Identity,
						0,
						2,
					)
					await expect(key).toEqual(
						new Uint8Array(
							Buffer.from(
								'2713f135f19ef3dcfca73cb536b1e077b1165cd0b7bedbef709447319ff0016d',
								'hex',
							),
						),
					)
				})
			})

			describe('Hard Derivations', () => {
				test("\(OK) Derive m'/44'/0'/1'/0/0 Identity Key", async () => {
					const key: Uint8Array = await cryptoService.keyGen(
						rootKey,
						KeyContexts.Identity,
						1,
						0,
					)
					await expect(key).toEqual(
						new Uint8Array(
							Buffer.from(
								'232847ae1bb95babcaa50c8033fab98f59e4b4ad1d89ac523a90c830e4ceee4a',
								'hex',
							),
						),
					)
				})

				test("\(OK) Derive m'/44'/0'/2'/0/1 Identity Key", async () => {
					const key: Uint8Array = await cryptoService.keyGen(
						rootKey,
						KeyContexts.Identity,
						2,
						1,
					)
					await expect(key).toEqual(
						new Uint8Array(
							Buffer.from(
								'8f68b6572860d84e8a41e38db1c8c692ded5eb291846f2e5bbfde774a9c6d16e',
								'hex',
							),
						),
					)
				})
			})
		})

		describe('Signing Typed Data', () => {
			test('\(OK) Sign authentication challenge of 32 bytes, encoded base64', async () => {
				const challenge: Uint8Array = new Uint8Array(randomBytes(32))

				// read auth schema file for authentication. 32 bytes challenge to sign
				const authSchema: JSONSchemaType<any> = JSON.parse(
					readFileSync(
						path.resolve(__dirname, '../../schemas/auth.request.json'),
						'utf8',
					),
				)
				const metadata: SignMetadata = {
					encoding: Encodings.BASE64,
					schema: authSchema,
				}
				const base64Challenge: string = Buffer.from(challenge).toString('base64')

				const encoded: Uint8Array = new Uint8Array(Buffer.from(base64Challenge))

				const signature: Uint8Array = await cryptoService.signData(
					rootKey,
					KeyContexts.Address,
					0,
					0,
					encoded,
					metadata,
				)
				await expect(signature).toHaveLength(64)

				const isValid: boolean = await cryptoService.verifyWithPublicKey(
					signature,
					encoded,
					await cryptoService.keyGen(rootKey, KeyContexts.Address, 0, 0),
				)
				await expect(isValid).toBe(true)
			})

			test('\(OK) Sign authentication challenge of 32 bytes, encoded msgpack', async () => {
				const challenge: Uint8Array = new Uint8Array(randomBytes(32))

				// read auth schema file for authentication. 32 bytes challenge to sign
				const authSchema: JSONSchemaType<any> = JSON.parse(
					readFileSync(
						path.resolve(__dirname, '../../schemas/auth.request.json'),
						'utf8',
					),
				)
				const metadata: SignMetadata = {
					encoding: Encodings.MSGPACK,
					schema: authSchema,
				}
				const encoded: Uint8Array = msgpack.encode(challenge)

				const signature: Uint8Array = await cryptoService.signData(
					rootKey,
					KeyContexts.Address,
					0,
					0,
					encoded,
					metadata,
				)
				await expect(signature).toHaveLength(64)

				const isValid: boolean = await cryptoService.verifyWithPublicKey(
					signature,
					encoded,
					await cryptoService.keyGen(rootKey, KeyContexts.Address, 0, 0),
				)
				await expect(isValid).toBe(true)
			})

			test('\(OK) Sign authentication challenge of 32 bytes, no encoding', async () => {
				const challenge: Uint8Array = new Uint8Array(randomBytes(32))

				// read auth schema file for authentication. 32 bytes challenge to sign
				const authSchema: JSONSchemaType<any> = JSON.parse(
					readFileSync(
						path.resolve(__dirname, '../../schemas/auth.request.json'),
						'utf8',
					),
				)
				const metadata: SignMetadata = {
					encoding: Encodings.NONE,
					schema: authSchema,
				}

				const signature: Uint8Array = await cryptoService.signData(
					rootKey,
					KeyContexts.Address,
					0,
					0,
					challenge,
					metadata,
				)
				await expect(signature).toHaveLength(64)

				const isValid: boolean = await cryptoService.verifyWithPublicKey(
					signature,
					challenge,
					await cryptoService.keyGen(rootKey, KeyContexts.Address, 0, 0),
				)
				await expect(isValid).toBe(true)
			})

			test('\(OK) Sign Arbitrary Message against Schema, encoded base64', async () => {
				const firstKey: Uint8Array = await cryptoService.keyGen(
					rootKey,
					KeyContexts.Address,
					0,
					0,
				)

				const message = {
					letter: 'Hello World',
				}

				const { to_base64 } = await loadLibSodium()
				const encoded: Buffer = Buffer.from(to_base64(JSON.stringify(message)))

				// Schema of what we are signing
				const jsonSchema = {
					type: 'object',
					properties: {
						letter: {
							type: 'string',
						},
					},
				}

				const metadata: SignMetadata = {
					encoding: Encodings.BASE64,
					schema: jsonSchema,
				}

				const signature: Uint8Array = await cryptoService.signData(
					rootKey,
					KeyContexts.Address,
					0,
					0,
					encoded,
					metadata,
				)
				await expect(signature).toHaveLength(64)

				const isValid: boolean = await cryptoService.verifyWithPublicKey(
					signature,
					encoded,
					firstKey,
				)
				await expect(isValid).toBe(true)
			})

			test('\(OK) Sign Arbitrary Message against Schema, encoded msgpack', async () => {
				const firstKey: Uint8Array = await cryptoService.keyGen(
					rootKey,
					KeyContexts.Address,
					0,
					0,
				)

				const message = {
					letter: 'Hello World',
				}

				const encoded: Buffer = Buffer.from(msgpack.encode(message))

				// Schema of what we are signing
				const jsonSchema = {
					type: 'object',
					properties: {
						letter: {
							type: 'string',
						},
					},
				}

				const metadata: SignMetadata = {
					encoding: Encodings.MSGPACK,
					schema: jsonSchema,
				}

				const signature: Uint8Array = await cryptoService.signData(
					rootKey,
					KeyContexts.Address,
					0,
					0,
					encoded,
					metadata,
				)
				await expect(signature).toHaveLength(64)

				const isValid: boolean = await cryptoService.verifyWithPublicKey(
					signature,
					encoded,
					firstKey,
				)
				await expect(isValid).toBe(true)
			})

			test('\(FAIL) Signing attempt fails because of invalid data against Schema, encoded base64', async () => {
				const message = {
					letter: 'Hello World',
				}

				const { to_base64 } = await loadLibSodium()
				const encoded: Buffer = Buffer.from(to_base64(JSON.stringify(message)))

				// Schema of what we are signing
				const jsonSchema = {
					type: 'string',
				}

				const metadata: SignMetadata = {
					encoding: Encodings.BASE64,
					schema: jsonSchema,
				}
				await expect(
					cryptoService.signData(
						rootKey,
						KeyContexts.Identity,
						0,
						0,
						encoded,
						metadata,
					),
				).rejects.toThrowError()
			})

			test('\(FAIL) Signing attempt fails because of invalid data against Schema, encoded msgpack', async () => {
				const message = {
					letter: 'Hello World',
				}

				const encoded: Buffer = Buffer.from(msgpack.encode(message))

				// Schema of what we are signing
				const jsonSchema = {
					type: 'string',
				}

				const metadata: SignMetadata = {
					encoding: Encodings.MSGPACK,
					schema: jsonSchema,
				}
				await expect(
					cryptoService.signData(
						rootKey,
						KeyContexts.Identity,
						0,
						0,
						encoded,
						metadata,
					),
				).rejects.toThrowError()
			})

			describe('Reject Regular Transaction Signing. IF TAG Prexies are present signing must fail', () => {
				test('\(FAIL) [TX] Tag', async () => {
					const transaction: Buffer = Buffer.concat([
						Buffer.from('TX'),
						msgpack.encode(randomBytes(64)),
					])
					const metadata: SignMetadata = { encoding: Encodings.MSGPACK, schema: {} }
					await expect(
						cryptoService.signData(
							rootKey,
							KeyContexts.Identity,
							0,
							0,
							transaction,
							metadata,
						),
					).rejects.toThrowError(ERROR_TAGS_FOUND)
				})

				test('\(FAIL) [MX] Tag', async () => {
					const transaction: Buffer = Buffer.concat([
						Buffer.from('MX'),
						msgpack.encode(randomBytes(64)),
					])
					const metadata: SignMetadata = { encoding: Encodings.MSGPACK, schema: {} }
					await expect(
						cryptoService.signData(
							rootKey,
							KeyContexts.Identity,
							0,
							0,
							transaction,
							metadata,
						),
					).rejects.toThrowError(ERROR_TAGS_FOUND)
				})

				test('\(FAIL) [Program] Tag', async () => {
					const transaction: Buffer = Buffer.concat([
						Buffer.from('Program'),
						msgpack.encode(randomBytes(64)),
					])
					const metadata: SignMetadata = { encoding: Encodings.MSGPACK, schema: {} }
					await expect(
						cryptoService.signData(
							rootKey,
							KeyContexts.Identity,
							0,
							0,
							transaction,
							metadata,
						),
					).rejects.toThrowError(ERROR_TAGS_FOUND)
				})

				test('\(FAIL) [progData] Tag', async () => {
					const transaction: Buffer = Buffer.concat([
						Buffer.from('ProgData'),
						msgpack.encode(randomBytes(64)),
					])
					const metadata: SignMetadata = { encoding: Encodings.MSGPACK, schema: {} }
					await expect(
						cryptoService.signData(
							rootKey,
							KeyContexts.Identity,
							0,
							0,
							transaction,
							metadata,
						),
					).rejects.toThrowError(ERROR_TAGS_FOUND)
				})
			})
		})

		describe('signing transactions', () => {
			test('\(OK) Sign Transaction', async () => {
				const key: Uint8Array = await cryptoService.keyGen(
					rootKey,
					KeyContexts.Address,
					0,
					0,
					BIP32DerivationTypes.Khovratovich,
				)
				// this transaction wes successfully submitted to the network https://testnet.explorer.perawallet.app/tx/UJG3NVCSCW5A63KPV35BPAABLXMXTTEM2CVUKNS4EML3H3EYGMCQ/
				const prefixEncodedTx = new Uint8Array(
					Buffer.from(
						'VFiJo2FtdM0D6KNmZWXNA+iiZnbOAkeSd6NnZW6sdGVzdG5ldC12MS4womdoxCBIY7UYpLPITsgQ8i1PEIHLD3HwWaesIN7GL39w5Qk6IqJsds4CR5Zfo3JjdsQgYv6DK3rRBUS+gzemcENeUGSuSmbne9eJCXZbRrV2pvOjc25kxCBi/oMretEFRL6DN6ZwQ15QZK5KZud714kJdltGtXam86R0eXBlo3BheQ==',
						'base64',
					),
				)
				const sig = await cryptoService.signAlgoTransaction(
					rootKey,
					KeyContexts.Address,
					0,
					0,
					prefixEncodedTx,
					BIP32DerivationTypes.Khovratovich,
				)
				await expect(encodeAddress(Buffer.from(key))).toEqual(
					'ML7IGK322ECUJPUDG6THAQ26KBSK4STG4555PCIJOZNUNNLWU3Z3ZFXITA',
				)
				await expect(nacl.sign.detached.verify(prefixEncodedTx, sig, key)).toBe(
					true,
				)
			})
		})

		describe('ECDH cases', () => {
			// Making sure Alice & Bob Have different root keys
			let aliceRootKey: Uint8Array
			let bobRootKey: Uint8Array
			beforeEach(() => {
				aliceRootKey = fromSeed(
					bip39.mnemonicToSeedSync(
						'exact remain north lesson program series excess lava material second riot error boss planet brick rotate scrap army riot banner adult fashion casino bamboo',
						'',
					),
				)
				bobRootKey = fromSeed(
					bip39.mnemonicToSeedSync(
						'identify length ranch make silver fog much puzzle borrow relax occur drum blue oval book pledge reunion coral grace lamp recall fever route carbon',
						'',
					),
				)
			})

			test('\(OK) ECDH', async () => {
				const aliceKey: Uint8Array = await cryptoService.keyGen(
					aliceRootKey,
					KeyContexts.Identity,
					0,
					0,
				)
				const bobKey: Uint8Array = await cryptoService.keyGen(
					bobRootKey,
					KeyContexts.Identity,
					0,
					0,
				)

				const aliceSharedSecret: Uint8Array = await cryptoService.ECDH(
					aliceRootKey,
					KeyContexts.Identity,
					0,
					0,
					bobKey,
					true,
				)
				const bobSharedSecret: Uint8Array = await cryptoService.ECDH(
					bobRootKey,
					KeyContexts.Identity,
					0,
					0,
					aliceKey,
					false,
				)
				await expect(aliceSharedSecret).toEqual(bobSharedSecret)

				const aliceSharedSecret2: Uint8Array = await cryptoService.ECDH(
					aliceRootKey,
					KeyContexts.Identity,
					0,
					0,
					bobKey,
					false,
				)
				const bobSharedSecret2: Uint8Array = await cryptoService.ECDH(
					bobRootKey,
					KeyContexts.Identity,
					0,
					0,
					aliceKey,
					true,
				)
				await expect(aliceSharedSecret2).toEqual(bobSharedSecret2)
				await expect(aliceSharedSecret2).not.toEqual(aliceSharedSecret)
			})

			test('\(OK) ECDH, Encrypt and Decrypt', async () => {
				const aliceKey: Uint8Array = await cryptoService.keyGen(
					aliceRootKey,
					KeyContexts.Identity,
					0,
					0,
				)
				const bobKey: Uint8Array = await cryptoService.keyGen(
					bobRootKey,
					KeyContexts.Identity,
					0,
					0,
				)

				const aliceSharedSecret: Uint8Array = await cryptoService.ECDH(
					aliceRootKey,
					KeyContexts.Identity,
					0,
					0,
					bobKey,
					true,
				)
				const bobSharedSecret: Uint8Array = await cryptoService.ECDH(
					bobRootKey,
					KeyContexts.Identity,
					0,
					0,
					aliceKey,
					false,
				)

				await expect(aliceSharedSecret).toEqual(bobSharedSecret)

				const message: Uint8Array = new Uint8Array(Buffer.from('Hello, World!'))
				const nonce: Uint8Array = new Uint8Array([
					16, 197, 142, 8, 174, 91, 118, 244, 202, 136, 43, 200, 97, 242, 104, 99,
					42, 154, 191, 32, 67, 30, 6, 123,
				])

				const { crypto_secretbox_easy, crypto_secretbox_open_easy } =
					await loadLibSodium()

				// encrypt
				const cipherText: Uint8Array = crypto_secretbox_easy(
					message,
					nonce,
					aliceSharedSecret,
				)

				// log cipherText uint8array
				console.log('cipherText', cipherText)

				await expect(cipherText).toEqual(
					new Uint8Array([
						20, 107, 126, 154, 152, 197, 252, 227, 148, 39, 245, 136, 233, 10, 199,
						20, 219, 3, 53, 2, 113, 6, 190, 21, 193, 119, 43, 44, 230,
					]),
				)
				// decrypt
				const plainText: Uint8Array = crypto_secretbox_open_easy(
					cipherText,
					nonce,
					bobSharedSecret,
				)
				await expect(plainText).toEqual(message)
			})

			test('Libsodium example ECDH', async () => {
				const {
					crypto_sign_keypair,
					crypto_sign_ed25519_sk_to_curve25519,
					crypto_sign_ed25519_pk_to_curve25519,
					crypto_scalarmult,
					crypto_kx_client_session_keys,
					crypto_kx_server_session_keys,
				} = await loadLibSodium()
				// keypair
				const alice: KeyPair = crypto_sign_keypair()

				const alicePvtKey: Uint8Array = alice.privateKey
				const alicePubKey: Uint8Array = alice.publicKey

				const aliceXPvt: Uint8Array =
					crypto_sign_ed25519_sk_to_curve25519(alicePvtKey)
				const aliceXPub: Uint8Array =
					crypto_sign_ed25519_pk_to_curve25519(alicePubKey)

				// bob
				const bob: KeyPair = crypto_sign_keypair()

				const bobPvtKey: Uint8Array = bob.privateKey
				const bobPubKey: Uint8Array = bob.publicKey

				const bobXPvt: Uint8Array = crypto_sign_ed25519_sk_to_curve25519(bobPvtKey)
				const bobXPub: Uint8Array = crypto_sign_ed25519_pk_to_curve25519(bobPubKey)

				// shared secret
				const aliceSecret: Uint8Array = crypto_scalarmult(aliceXPvt, bobXPub)
				const bobSecret: Uint8Array = crypto_scalarmult(bobXPvt, aliceXPub)
				await expect(aliceSecret).toEqual(bobSecret)

				const aliceSharedSecret: CryptoKX = crypto_kx_client_session_keys(
					aliceXPub,
					aliceXPvt,
					bobXPub,
				)
				const bobSharedSecret: CryptoKX = crypto_kx_server_session_keys(
					bobXPub,
					bobXPvt,
					aliceXPub,
				)

				// bilateral encryption channels
				await expect(aliceSharedSecret.sharedRx).toEqual(bobSharedSecret.sharedTx)
				await expect(bobSharedSecret.sharedTx).toEqual(aliceSharedSecret.sharedRx)
			})
		})
	})

	describe('\(deriveNodePrivate)', () => {
		test('\(FAIL) Should fail if during derivation scalar >= 2^255', async () => {
			// 44'/283'/0'/0
			const bip44Path = [harden(44), harden(283), harden(0), 0, 0]

			// Pick `g`, which is amount of bits zeroed from each derived node
			const g: number = 9

			// 44'
			let derivationNode: Uint8Array = await deriveChildNodePrivate(
				rootKey,
				bip44Path[0],
				g,
			)
			// 283'
			derivationNode = await deriveChildNodePrivate(
				derivationNode,
				bip44Path[1],
				g,
			)
			// 0'
			derivationNode = await deriveChildNodePrivate(
				derivationNode,
				bip44Path[2],
				g,
			)
			// 0
			derivationNode = await deriveChildNodePrivate(
				derivationNode,
				bip44Path[3],
				g,
			)
			// 0
			derivationNode = await deriveChildNodePrivate(
				derivationNode,
				bip44Path[4],
				g,
			)

			for (let i = 0; i < 19; i++) {
				derivationNode = await deriveChildNodePrivate(derivationNode, 0, g)
			}

			// for the seed in this test, we know where the scalar breaks (>= 2 ^ 255)
			// expect error at the 20th level for this known seed
			await expect(deriveChildNodePrivate(derivationNode, 0, g)).rejects.toThrow(
				'zL * 8 is larger than 2^255, which is not safe',
			)
		})
	})

	describe('\(deriveNodePublic', () => {
		test("\(OK) From m'/44'/283'/0'/0 root level (excluding address index) derive N keys with only public information", async () => {
			// wallet level m'/44'/283'/0'/0 root; node derivation before address_index
			const walletRoot: Uint8Array = await cryptoService.deriveKey(
				rootKey,
				[harden(44), harden(283), harden(0), 0],
				false,
				BIP32DerivationTypes.Peikert,
			)

			// should be able to derive all public keys from this root without knowing private information
			// since these are SOFTLY derived
			const numPublicKeysToDerive: number = 10
			for (let i = 0; i < numPublicKeysToDerive; i++) {
				// assuming in a third party that only has public information
				// I'm provided with the wallet level m'/44'/283'/0'/0 root [public, chaincode]
				// no private information is shared
				// i can SOFTLY derive N public keys / addresses from this root
				const derivedKey: Uint8Array = new Uint8Array(
					await deriveChildNodePublic(walletRoot, i, BIP32DerivationTypes.Peikert),
				) // g == 9

				// Deriving from my own wallet where i DO have private information
				const myKey: Uint8Array = await cryptoService.keyGen(
					rootKey,
					KeyContexts.Address,
					0,
					i,
					BIP32DerivationTypes.Peikert,
				)

				// they should match
				// derivedKey.subarray(0, 32) ==  public key (excluding chaincode)
				await expect(derivedKey.slice(0, 32)).toEqual(myKey)
			}
		})

		test("\(FAIL) From m'/44'/283'/0'/0' root level (excluding address index) should not be able to derive correct addresses from a hardened derivation", async () => {
			// wallet level m'/44'/283'/0'/0' root; node derivation before address_index
			const walletRoot: Uint8Array = await cryptoService.deriveKey(
				rootKey,
				[harden(44), harden(283), harden(0), harden(0)],
				false,
				BIP32DerivationTypes.Peikert,
			)

			const numPublicKeysToDerive: number = 10
			for (let i = 0; i < numPublicKeysToDerive; i++) {
				const derivedKey: Uint8Array = new Uint8Array(
					await deriveChildNodePublic(walletRoot, i, BIP32DerivationTypes.Peikert),
				) // g == 9

				// Deriving from my own wallet where i DO have private information
				const myKey: Uint8Array = await cryptoService.keyGen(
					rootKey,
					KeyContexts.Address,
					0,
					i,
					BIP32DerivationTypes.Peikert,
				)

				// they should NOT match  since the `change` level (as part of BIP44) was hardened
				// derivedKey.subarray(0, 32) ==  public key (excluding chaincode)
				await expect(derivedKey.slice(0, 32)).not.toEqual(myKey)
			}
		})
	})
})
