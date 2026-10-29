/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { describe, expect, it } from 'vitest'
import { manifestNameOf, workspaceMemberOf } from '../shared/workspace.js'

describe('workspaceMemberOf', () => {
    it('finds the member directory and its root', () => {
        expect(
            workspaceMemberOf(
                'packages/passkeys/src/native/__tests__/x.spec.ts',
            ),
        ).toEqual({ dir: 'packages/passkeys', root: 'packages' })
        expect(workspaceMemberOf('apps/mobile/src/a.ts')?.root).toBe('apps')
    })

    it("resolves a scratch fixture's own member directory", () => {
        expect(
            workspaceMemberOf(
                'lanekeep/__tests__/scratch-ab/extensions/plug/src/a.ts',
            ),
        ).toEqual({
            dir: 'lanekeep/__tests__/scratch-ab/extensions/plug',
            root: 'extensions',
        })
    })

    it('returns undefined outside a member', () => {
        expect(workspaceMemberOf('lanekeep/rules/a.ts')).toBeUndefined()
        expect(workspaceMemberOf('packages/a.ts')).toBeUndefined()
    })
})

describe('manifestNameOf', () => {
    const reader = (files: Record<string, string>) => ({
        readFile: (path: string) => files[path],
    })

    it('returns the package name', () => {
        expect(
            manifestNameOf(
                reader({ 'packages/a/package.json': '{"name":"@x/a"}' }),
                'packages/a',
            ),
        ).toBe('@x/a')
    })

    it('returns undefined for a missing file, invalid JSON or a non-string name', () => {
        expect(manifestNameOf(reader({}), 'packages/a')).toBeUndefined()
        expect(
            manifestNameOf(
                reader({ 'packages/a/package.json': '{' }),
                'packages/a',
            ),
        ).toBeUndefined()
        expect(
            manifestNameOf(
                reader({ 'packages/a/package.json': '{"name": 3}' }),
                'packages/a',
            ),
        ).toBeUndefined()
    })
})
