import { getAccountType } from '../utils'
import {
    HDWalletDetails,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'

describe('webview/utils - getAccountType', () => {
    const baseAccount: WalletAccount = {
        type: 'standard',
        address: 'ADDR1',
        canSign: true,
    }

    it('returns HdKey if hdWalletDetails is present', () => {
        expect(
            getAccountType({
                ...baseAccount,
                hdWalletDetails: {} as HDWalletDetails,
            }),
        ).toBe('HdKey')
    })

    it('returns LedgerBle if it is a ledger account', () => {
        expect(
            getAccountType({
                ...baseAccount,
                type: 'hardware',
                hardwareDetails: { manufacturer: 'ledger' },
            }),
        ).toBe('LedgerBle')
    })

    it('returns RekeyedAuth if it is rekeyed and can sign', () => {
        expect(
            getAccountType({
                ...baseAccount,
                rekeyAddress: 'ADDR2',
                canSign: true,
            }),
        ).toBe('RekeyedAuth')
    })

    it('returns Rekeyed if it is rekeyed but cannot sign', () => {
        expect(
            getAccountType({
                ...baseAccount,
                rekeyAddress: 'ADDR2',
                canSign: false,
            }),
        ).toBe('Rekeyed')
    })

    it('returns Algo25 for standard accounts without HD details', () => {
        expect(getAccountType(baseAccount)).toBe('Algo25')
    })

    it('returns NoAuth for watch accounts', () => {
        expect(
            getAccountType({
                ...baseAccount,
                type: 'watch',
            }),
        ).toBe('NoAuth')
    })

    it('returns Multisig for multisig accounts', () => {
        expect(
            getAccountType({
                ...baseAccount,
                type: 'multisig',
            }),
        ).toBe('Multisig')
    })

    it('returns Unknown for unknown combinations', () => {
        // This is tricky because the utility covers most cases,
        // but if we pass something that doesn't match any branch:
        expect(
            getAccountType({
                ...baseAccount,
                type: 'hardware',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                hardwareDetails: { manufacturer: 'other' as any },
            }),
        ).toBe('Unknown')
    })
})
