import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { descendMakeStylesCall, getMakeStylesBinding } from '../utils/ast.js'

function makeSource(text: string): ts.SourceFile {
    return ts.createSourceFile(
        '/virtual/a.ts',
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
    )
}

describe('getMakeStylesBinding', () => {
    it('returns the local name for `import { makeStyles } from @rneui/themed`', () => {
        const sf = makeSource("import { makeStyles } from '@rneui/themed'\n")
        expect(getMakeStylesBinding(sf)).toBe('makeStyles')
    })

    it('returns the alias for `import { makeStyles as ms } from @rneui/themed`', () => {
        const sf = makeSource(
            "import { makeStyles as ms } from '@rneui/themed'\n",
        )
        expect(getMakeStylesBinding(sf)).toBe('ms')
    })

    it('returns null when not imported', () => {
        const sf = makeSource("import { View } from 'react-native'\n")
        expect(getMakeStylesBinding(sf)).toBeNull()
    })

    it('caches the result across calls on the same SourceFile', () => {
        const sf = makeSource("import { makeStyles } from '@rneui/themed'\n")
        expect(getMakeStylesBinding(sf)).toBe(getMakeStylesBinding(sf))
    })
})

describe('descendMakeStylesCall', () => {
    function findFirstCall(sf: ts.SourceFile): ts.CallExpression {
        let found: ts.CallExpression | null = null
        const visit = (node: ts.Node): void => {
            if (!found && ts.isCallExpression(node)) {
                found = node
                return
            }
            ts.forEachChild(node, visit)
        }
        visit(sf)
        if (!found) throw new Error('no CallExpression in fixture')
        return found
    }

    it('yields each top-level style-entry object literal (arrow, concise body)', () => {
        const sf = makeSource(
            "import { makeStyles } from '@rneui/themed'\n" +
                'export const useStyles = makeStyles(theme => ({ a: { p: 1 }, b: { m: 2 } }))\n',
        )
        const found: number[] = []
        descendMakeStylesCall(findFirstCall(sf), obj => {
            found.push(obj.properties.length)
        })
        expect(found).toEqual([1, 1])
    })

    it('yields each top-level style-entry object literal (arrow, block body with return)', () => {
        const sf = makeSource(
            "import { makeStyles } from '@rneui/themed'\n" +
                'export const useStyles = makeStyles(theme => { return { x: { p: 1 } } })\n',
        )
        const found: number[] = []
        descendMakeStylesCall(findFirstCall(sf), obj => {
            found.push(obj.properties.length)
        })
        expect(found).toEqual([1])
    })

    it('ignores non-object style entries', () => {
        const sf = makeSource(
            "import { makeStyles } from '@rneui/themed'\n" +
                'export const useStyles = makeStyles(theme => ({ a: getTypography(theme, "h1") }))\n',
        )
        const found: number[] = []
        descendMakeStylesCall(findFirstCall(sf), obj => {
            found.push(obj.properties.length)
        })
        expect(found).toEqual([])
    })
})
