import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import check from '../checks/no-unused-style-keys.check.js'
import { sharedWalk } from '../execute.js'
import type { SourceMap, Violation } from '../types.js'

function buildSources(files: Record<string, string>): SourceMap {
    const map: SourceMap = new Map()
    for (const [filePath, text] of Object.entries(files)) {
        const kind = filePath.endsWith('.tsx')
            ? ts.ScriptKind.TSX
            : ts.ScriptKind.TS
        map.set(
            filePath,
            ts.createSourceFile(
                filePath,
                text,
                ts.ScriptTarget.Latest,
                true,
                kind,
            ),
        )
    }
    return map
}

function run(sources: SourceMap): Violation[] {
    const violations: Violation[] = []
    sharedWalk(sources, [check], {}, violations)
    check.finalize?.({
        sources,
        emit: payload => violations.push({ ...payload, ruleId: check.id }),
    })
    return violations
}

describe('no-unused-style-keys check', () => {
    it('flags a style key never referenced by any consumer', () => {
        const sources = buildSources({
            '/virtual/styles.ts':
                "import { makeStyles } from '@rneui/themed'\n" +
                'export const useStyles = makeStyles(() => ({\n' +
                '    container: { flex: 1 },\n' +
                '    unused: { flex: 1 },\n' +
                '}))\n',
            '/virtual/Component.tsx':
                "import { useStyles } from './styles'\n" +
                'export const Component = () => {\n' +
                '    const styles = useStyles()\n' +
                '    return styles.container\n' +
                '}\n',
        })
        const violations = run(sources)
        expect(violations).toHaveLength(1)
        expect(violations[0].message).toContain('"unused"')
    })

    it('does not flag a key only referenced through a `.web` platform-variant style file', () => {
        // Metro/webpack resolve a plain `./styles` import to `styles.web.ts`
        // when bundling for web, transparently to the importer — so a
        // universal component that only imports `./styles` still "uses"
        // whatever keys the `.web` sibling declares under the same name.
        const sources = buildSources({
            '/virtual/styles.ts':
                "import { makeStyles } from '@rneui/themed'\n" +
                'export const useStyles = makeStyles(() => ({\n' +
                '    heroImage: { flex: 1 },\n' +
                '}))\n',
            '/virtual/styles.web.ts':
                "import { makeStyles } from '@rneui/themed'\n" +
                'export const useStyles = makeStyles(() => ({\n' +
                '    heroImage: { maxHeight: 120 },\n' +
                '}))\n',
            '/virtual/Component.tsx':
                "import { useStyles } from './styles'\n" +
                'export const Component = () => {\n' +
                '    const styles = useStyles()\n' +
                '    return styles.heroImage\n' +
                '}\n',
        })
        expect(run(sources)).toEqual([])
    })

    it('still flags a `.web` style key the universal consumer never references', () => {
        const sources = buildSources({
            '/virtual/styles.ts':
                "import { makeStyles } from '@rneui/themed'\n" +
                'export const useStyles = makeStyles(() => ({\n' +
                '    heroImage: { flex: 1 },\n' +
                '}))\n',
            '/virtual/styles.web.ts':
                "import { makeStyles } from '@rneui/themed'\n" +
                'export const useStyles = makeStyles(() => ({\n' +
                '    heroImage: { maxHeight: 120 },\n' +
                '    orphan: { flex: 1 },\n' +
                '}))\n',
            '/virtual/Component.tsx':
                "import { useStyles } from './styles'\n" +
                'export const Component = () => {\n' +
                '    const styles = useStyles()\n' +
                '    return styles.heroImage\n' +
                '}\n',
        })
        const violations = run(sources)
        expect(violations).toHaveLength(1)
        expect(violations[0].file).toBe('/virtual/styles.web.ts')
        expect(violations[0].message).toContain('"orphan"')
    })
})
