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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getNetworkConfig, getAlgorandClient, appEnvironment } = vi.hoisted(
    () => ({
        getNetworkConfig: vi.fn(),
        getAlgorandClient: vi.fn(),
        appEnvironment: { value: 'development' as string },
    }),
)

vi.mock('@perawallet/wallet-core-config', async () => ({
    ...(await vi.importActual('@perawallet/wallet-core-config')),
    get config() {
        return { appEnvironment: appEnvironment.value }
    },
    getNetworkConfig,
}))
vi.mock('@perawallet/wallet-core-blockchain', () => ({ getAlgorandClient }))

import {
    renderAutoDrawTeal,
    resolveEscrowChainConfig,
    compileAutoDrawProgram,
    verifyAutoDrawProgram,
    AutoDrawProgramUnverifiedError,
} from '../lsig'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex } from '@perawallet/wallet-core-shared'

const pinFor = (program: Uint8Array) => bytesToHex(sha256(program))

const TESTNET_GENESIS = 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI='

describe('renderAutoDrawTeal', () => {
    it('substitutes every TMPL_ placeholder', () => {
        const teal = renderAutoDrawTeal({
            assetId: '10458941',
            killswitchAppId: '222',
            mainAppId: '111',
            genesisHashBase64: TESTNET_GENESIS,
        })

        expect(teal).not.toContain('TMPL_')
        // App ids land in the intcblock line. The asset is no longer pinned
        // into the template — delegation is per-asset via the Killswitch now.
        expect(teal).toContain('intcblock 1 6 222 111')
        // Genesis hash becomes a 0x + 64-hex bytecblock literal.
        expect(teal).toMatch(/bytecblock 0x[0-9a-f]{64}\n/)
    })
})

describe('resolveEscrowChainConfig', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        appEnvironment.value = 'development'
    })

    it('returns configured ids', () => {
        getNetworkConfig.mockReturnValue({
            cardW3CardAppId: '111',
            cardKillswitchAppId: '222',
            cardUsdcAssetId: '10458941',
            cardEscrowBaseUrl: 'https://escrow.test',
        })

        expect(resolveEscrowChainConfig('testnet')).toEqual({
            assetId: '10458941',
            killswitchAppId: '222',
            mainAppId: '111',
        })
    })

    it('falls back to "0" placeholders only on the dev-mock path (no base URL)', () => {
        getNetworkConfig.mockReturnValue({
            cardW3CardAppId: '',
            cardKillswitchAppId: '',
            cardUsdcAssetId: '',
            cardEscrowBaseUrl: '',
        })

        expect(resolveEscrowChainConfig('testnet')).toEqual({
            assetId: '0',
            killswitchAppId: '0',
            mainAppId: '0',
        })
    })

    it('throws when the escrow base URL is configured but ids are unset (any env)', () => {
        // A staging build pointed at the REAL AB service without app-id
        // secrets must fail loudly: a program rendered with app id 0 would
        // match app-CREATION txns — a dangerous delegation, not a harmless one.
        // The mutation's Auto try/catch turns this throw into an honest
        // degrade-to-Manual instead of a silent full-Auto success.
        getNetworkConfig.mockReturnValue({
            cardW3CardAppId: '',
            cardKillswitchAppId: '222',
            cardUsdcAssetId: '10458941',
            cardEscrowBaseUrl: 'https://escrow.test',
        })

        expect(() => resolveEscrowChainConfig('testnet')).toThrow()
    })

    it('throws in production when ids are unset', () => {
        appEnvironment.value = 'production'
        getNetworkConfig.mockReturnValue({
            cardW3CardAppId: '',
            cardKillswitchAppId: '',
            cardUsdcAssetId: '',
            cardEscrowBaseUrl: '',
        })

        expect(() => resolveEscrowChainConfig('mainnet')).toThrow()
    })
})

describe('compileAutoDrawProgram', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        appEnvironment.value = 'development'
    })

    // algod is third-party; its compiled bytes are what gets signed,
    // so an unpinned/attacker program ('BoEB' = `int 1`, approve-anything) must
    // be rejected even though the substituted TEAL is compiled correctly.
    it('compiles the substituted template but rejects an unpinned/int-1 program', async () => {
        getNetworkConfig.mockReturnValue({
            genesisHash: TESTNET_GENESIS,
            cardW3CardAppId: '111',
            cardKillswitchAppId: '222',
            cardUsdcAssetId: '10458941',
        })
        const doFn = vi.fn().mockResolvedValue({ result: 'BoEB', hash: 'H' })
        const compile = vi.fn().mockReturnValue({ do: doFn })
        getAlgorandClient.mockReturnValue({ client: { algod: { compile } } })

        await expect(
            compileAutoDrawProgram({ network: 'testnet' }),
        ).rejects.toBeInstanceOf(AutoDrawProgramUnverifiedError)

        // Still compiled the substituted TEAL (no placeholders reach algod).
        expect(compile).toHaveBeenCalledTimes(1)
        expect(compile.mock.calls[0][0]).not.toContain('TMPL_')
    })

    // Runs in `development` (beforeEach) — proving the guard has no
    // production-only escape hatch.
    it('rejects in non-production too (no env bypass)', () => {
        const program = new Uint8Array([0x06, 0x81, 0x01])
        expect(() => verifyAutoDrawProgram(program, 'testnet')).toThrow(
            AutoDrawProgramUnverifiedError,
        )
    })
})

describe('verifyAutoDrawProgram', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        getNetworkConfig.mockReturnValue({ cardAutoDrawProgramHash: '' })
    })

    it('reads the pin from the network config when none is passed', () => {
        const program = new Uint8Array([1, 2, 3, 4])
        getNetworkConfig.mockReturnValue({
            cardAutoDrawProgramHash: pinFor(program),
        })

        expect(() => verifyAutoDrawProgram(program, 'testnet')).not.toThrow()
        expect(() =>
            verifyAutoDrawProgram(new Uint8Array([9, 9, 9]), 'testnet'),
        ).toThrow(AutoDrawProgramUnverifiedError)
    })

    it('accepts a program whose hash matches the pinned value', () => {
        const program = new Uint8Array([1, 2, 3, 4])
        const pins = { testnet: pinFor(program) }
        expect(() =>
            verifyAutoDrawProgram(program, 'testnet', pins),
        ).not.toThrow()
    })

    it('rejects a program whose hash differs from the pinned value', () => {
        const pins = { testnet: pinFor(new Uint8Array([1, 2, 3, 4])) }
        expect(() =>
            verifyAutoDrawProgram(new Uint8Array([9, 9, 9]), 'testnet', pins),
        ).toThrow(AutoDrawProgramUnverifiedError)
    })

    // The pin is copied in by hand from a build step, so tolerate the casing
    // and whitespace that survives a copy-paste rather than failing closed on it.
    it('accepts an upper-case, padded pin', () => {
        const program = new Uint8Array([1, 2, 3, 4])
        const pins = { testnet: `  ${pinFor(program).toUpperCase()}  ` }
        expect(() =>
            verifyAutoDrawProgram(program, 'testnet', pins),
        ).not.toThrow()
    })

    // The old pin was base64 of the program itself; a stale value must fail
    // rather than accidentally comparing equal to anything.
    it('rejects a legacy base64-program pin', () => {
        const program = new Uint8Array([1, 2, 3, 4])
        const pins = { testnet: 'AQIDBA==' }
        expect(() => verifyAutoDrawProgram(program, 'testnet', pins)).toThrow(
            AutoDrawProgramUnverifiedError,
        )
    })

    it('rejects when the network is unpinned (fail closed)', () => {
        expect(() =>
            verifyAutoDrawProgram(new Uint8Array([1, 2, 3, 4]), 'testnet', {}),
        ).toThrow(AutoDrawProgramUnverifiedError)
    })
})
