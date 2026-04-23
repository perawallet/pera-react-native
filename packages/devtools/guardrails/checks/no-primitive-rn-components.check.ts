import ts from 'typescript'
import { getLineCol } from '../utils/ast.js'
import type { Check, SourceMap, Violation } from '../types.js'

const RULE_ID = 'no-primitive-rn-components'

const CORE_COMPONENTS_PATH = '/apps/mobile/src/components/core/'

const BANNED_RN_IMPORTS = new Map<string, string>([
    ['Text', 'PWText'],
    ['View', 'PWView'],
    ['ScrollView', 'PWScrollView'],
    ['FlatList', 'PWFlatList'],
    ['TouchableOpacity', 'PWTouchableOpacity'],
    ['Image', 'PWImage'],
    ['Switch', 'PWSwitch'],
])

function isReactNativeImport(node: ts.Statement): node is ts.ImportDeclaration {
    if (!ts.isImportDeclaration(node)) return false
    const spec = node.moduleSpecifier
    if (!ts.isStringLiteral(spec)) return false
    return spec.text === 'react-native'
}

function collectFromSourceFile(sf: ts.SourceFile, out: Violation[]): void {
    if (sf.fileName.includes(CORE_COMPONENTS_PATH)) return

    for (const statement of sf.statements) {
        if (!isReactNativeImport(statement)) continue
        const bindings = statement.importClause?.namedBindings
        if (!bindings || !ts.isNamedImports(bindings)) continue
        for (const element of bindings.elements) {
            const imported = element.propertyName?.text ?? element.name.text
            const pwName = BANNED_RN_IMPORTS.get(imported)
            if (!pwName) continue
            const { line, column } = getLineCol(sf, element.getStart(sf))
            out.push({
                file: sf.fileName,
                line,
                column,
                ruleId: RULE_ID,
                message: `Use ${pwName} from @components/core instead of ${imported} from 'react-native'`,
                remediation: `Import { ${pwName} } from '@components/core' (see apps/mobile/src/components/core/index.ts).`,
            })
        }
    }
}

const check: Check = {
    id: RULE_ID,
    description:
        'Disallow importing primitive React Native components that have PW-prefixed equivalents. Require @components/core abstractions.',
    run(sources: SourceMap): Violation[] {
        const violations: Violation[] = []
        for (const sf of sources.values()) {
            collectFromSourceFile(sf, violations)
        }
        return violations
    },
}

export default check
