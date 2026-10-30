/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { compareVersions, parsePnpmLock } from '../shared/pnpm-lock.js'

const LOCK = [
    "lockfileVersion: '9.0'",
    '',
    'catalogs:',
    '  default:',
    "    '@scope/a':",
    '      specifier: ^1.0.0',
    '      version: 1.2.3',
    '    plain:',
    '      specifier: 2.0.0',
    '      version: 2.0.0',
    '  other:',
    '    skipped:',
    '      specifier: 9.0.0',
    '      version: 9.0.0',
    '',
    'importers:',
    '  .:',
    '    dependencies:',
    '      plain:',
    '        specifier: 2.0.0',
    '        version: 2.0.0',
    '',
    'snapshots:',
    '',
    "  '@scope/a@1.2.3(typescript@7.0.2)(zod@4.6.7)':",
    '    dependencies:',
    "      '@scope/b': 3.0.0(typescript@7.0.2)",
    '      plain: 2.0.0',
    '    transitivePeerDependencies:',
    "      - '@azure/cosmos'",
    '',
    "  '@scope/a@1.2.3(typescript@7.0.2)':",
    '    dependencies:',
    '      plain: 2.0.1',
    '',
    '  plain@2.0.0: {}',
    '',
    '  tail@1.0.0:',
    '    optionalDependencies:',
    '      ignored: 1.0.0',
    '',
].join('\n')

describe('parsePnpmLock', () => {
    const lock = parsePnpmLock(LOCK)

    it('reads the versions in catalogs.default and ignores other catalogs', () => {
        expect([...lock.catalog]).toEqual([
            ['@scope/a', '1.2.3'],
            ['plain', '2.0.0'],
        ])
    })

    it('keys snapshots by name@version with the peer suffix stripped, one map per peer variant', () => {
        const variants = lock.snapshots.get('@scope/a@1.2.3')

        expect(variants?.map(deps => [...deps])).toEqual([
            [
                ['@scope/b', '3.0.0'],
                ['plain', '2.0.0'],
            ],
            [['plain', '2.0.1']],
        ])
    })

    it('records the 1-based line of the first snapshot entry of each release', () => {
        expect([...lock.snapshotLines]).toEqual([
            ['@scope/a@1.2.3', 25],
            ['plain@2.0.0', 36],
            ['tail@1.0.0', 38],
        ])
    })

    it('parses a single-line empty snapshot and reads only dependencies', () => {
        expect(lock.snapshots.get('plain@2.0.0')?.map(d => d.size)).toEqual([0])
        expect(lock.snapshots.get('tail@1.0.0')?.map(d => d.size)).toEqual([0])
    })
})

describe('compareVersions', () => {
    it('orders numeric fields numerically', () => {
        expect(compareVersions('2.57.10', '2.57.9')).toBe(1)
        expect(compareVersions('2.57.7', '2.57.7')).toBe(0)
        expect(compareVersions('1.9.0', '2.0.0')).toBe(-1)
    })

    it('orders prerelease identifiers by semver precedence', () => {
        expect(compareVersions('1.0.0-canary.5', '1.0.0-canary.21')).toBe(-1)
        expect(compareVersions('1.0.0-canary.21', '1.0.0')).toBe(-1)
        expect(compareVersions('1.0.0-alpha', '1.0.0-alpha.1')).toBe(-1)
        expect(compareVersions('1.0.0-1', '1.0.0-alpha')).toBe(-1)
        expect(compareVersions('1.0.0-beta', '1.0.0-alpha')).toBe(1)
    })

    it('ignores build metadata', () => {
        expect(compareVersions('1.0.0+b', '1.0.0')).toBe(0)
    })

    it('returns undefined for anything that is not a plain version', () => {
        expect(compareVersions('link:../x', '1.0.0')).toBeUndefined()
        expect(compareVersions('1.0.0', '^1.0.0')).toBeUndefined()
    })
})
