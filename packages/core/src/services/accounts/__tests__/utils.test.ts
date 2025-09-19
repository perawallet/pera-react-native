import { describe, test, expect } from 'vitest'
import type { WalletAccount } from '../types'
import { getAccountDisplayName } from '../utils'

describe('services/accounts/utils - getAccountDisplayName', () => {
    test('returns account name when present', () => {
        const acc: WalletAccount = {
            id: '1',
            type: 'standard',
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
            name: 'Named',
        }
        expect(getAccountDisplayName(acc)).toEqual('Named')
    })

    test('returns "No Address Found" when address is missing or empty', () => {
        const acc: WalletAccount = { id: '2', type: 'standard', address: '' }
        expect(getAccountDisplayName(acc)).toEqual('No Address Found')
    })

    test('returns address unchanged when length <= 11', () => {
        const acc1: WalletAccount = {
            id: '3',
            type: 'standard',
            address: 'SHORT',
        }
        expect(getAccountDisplayName(acc1)).toEqual('SHORT')

        const acc2: WalletAccount = {
            id: '4',
            type: 'standard',
            address: 'ABCDEFGHIJK',
        }
        expect(getAccountDisplayName(acc2)).toEqual('ABCDEFGHIJK')
    })

    test('truncates long addresses to 5 prefix and suffix characters', () => {
        const acc1: WalletAccount = {
            id: '5',
            type: 'standard',
            address: 'ABCDEFGHIJKL',
        }
        expect(getAccountDisplayName(acc1)).toEqual('ABCDE...HIJKL')

        const acc2: WalletAccount = {
            id: '6',
            type: 'standard',
            address: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        }
        expect(getAccountDisplayName(acc2)).toEqual('ABCDE...VWXYZ')
    })
})
