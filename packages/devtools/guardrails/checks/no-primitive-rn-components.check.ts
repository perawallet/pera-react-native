import ts from 'typescript'
import { getLineCol } from '../utils/ast.js'
import type { Check } from '../types.js'

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

const check: Check = {
    id: RULE_ID,
    description:
        'Disallow primitive react-native imports that have PW-prefixed equivalents. Require @components/core.',
    visitors: {
        [ts.SyntaxKind.ImportDeclaration]: (node, sf, emit) => {
            if (sf.fileName.includes(CORE_COMPONENTS_PATH)) return
            const decl = node as ts.ImportDeclaration
            const spec = decl.moduleSpecifier
            if (!ts.isStringLiteral(spec) || spec.text !== 'react-native') return
            const bindings = decl.importClause?.namedBindings
            if (!bindings || !ts.isNamedImports(bindings)) return
            for (const element of bindings.elements) {
                const imported = element.propertyName?.text ?? element.name.text
                const pwName = BANNED_RN_IMPORTS.get(imported)
                if (!pwName) continue
                const { line, column } = getLineCol(sf, element.getStart(sf))
                emit({
                    line,
                    column,
                    message: `Use ${pwName} from @components/core instead of ${imported} from 'react-native'`,
                    remediation: `Import { ${pwName} } from '@components/core' (see apps/mobile/src/components/core/index.ts).`,
                })
            }
        },
    },
}

export default check
