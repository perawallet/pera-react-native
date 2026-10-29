/*
 * Copyright (c) Pera Wallet. All rights reserved.
 */

import { defineRule } from 'lanekeep'
import type { Node, RuleContext } from 'lanekeep'
import { isRneuiMakeStyles } from '../shared/make-styles.js'
import { TEST_SUPPORT, withoutTests } from '../shared/scope.js'

// The names RN's `normalizeColor` accepts, minus `transparent`: it is the
// absence of a colour and has no token, like `0` in no-numeric-sizes.
const NAMED_COLORS: readonly string[] = [
    'aliceblue',
    'antiquewhite',
    'aqua',
    'aquamarine',
    'azure',
    'beige',
    'bisque',
    'black',
    'blanchedalmond',
    'blue',
    'blueviolet',
    'brown',
    'burlywood',
    'burntsienna',
    'cadetblue',
    'chartreuse',
    'chocolate',
    'coral',
    'cornflowerblue',
    'cornsilk',
    'crimson',
    'cyan',
    'darkblue',
    'darkcyan',
    'darkgoldenrod',
    'darkgray',
    'darkgreen',
    'darkgrey',
    'darkkhaki',
    'darkmagenta',
    'darkolivegreen',
    'darkorange',
    'darkorchid',
    'darkred',
    'darksalmon',
    'darkseagreen',
    'darkslateblue',
    'darkslategray',
    'darkslategrey',
    'darkturquoise',
    'darkviolet',
    'deeppink',
    'deepskyblue',
    'dimgray',
    'dimgrey',
    'dodgerblue',
    'firebrick',
    'floralwhite',
    'forestgreen',
    'fuchsia',
    'gainsboro',
    'ghostwhite',
    'gold',
    'goldenrod',
    'gray',
    'green',
    'greenyellow',
    'grey',
    'honeydew',
    'hotpink',
    'indianred',
    'indigo',
    'ivory',
    'khaki',
    'lavender',
    'lavenderblush',
    'lawngreen',
    'lemonchiffon',
    'lightblue',
    'lightcoral',
    'lightcyan',
    'lightgoldenrodyellow',
    'lightgray',
    'lightgreen',
    'lightgrey',
    'lightpink',
    'lightsalmon',
    'lightseagreen',
    'lightskyblue',
    'lightslategray',
    'lightslategrey',
    'lightsteelblue',
    'lightyellow',
    'lime',
    'limegreen',
    'linen',
    'magenta',
    'maroon',
    'mediumaquamarine',
    'mediumblue',
    'mediumorchid',
    'mediumpurple',
    'mediumseagreen',
    'mediumslateblue',
    'mediumspringgreen',
    'mediumturquoise',
    'mediumvioletred',
    'midnightblue',
    'mintcream',
    'mistyrose',
    'moccasin',
    'navajowhite',
    'navy',
    'oldlace',
    'olive',
    'olivedrab',
    'orange',
    'orangered',
    'orchid',
    'palegoldenrod',
    'palegreen',
    'paleturquoise',
    'palevioletred',
    'papayawhip',
    'peachpuff',
    'peru',
    'pink',
    'plum',
    'powderblue',
    'purple',
    'rebeccapurple',
    'red',
    'rosybrown',
    'royalblue',
    'saddlebrown',
    'salmon',
    'sandybrown',
    'seagreen',
    'seashell',
    'sienna',
    'silver',
    'skyblue',
    'slateblue',
    'slategray',
    'slategrey',
    'snow',
    'springgreen',
    'steelblue',
    'tan',
    'teal',
    'thistle',
    'tomato',
    'turquoise',
    'violet',
    'wheat',
    'white',
    'whitesmoke',
    'yellow',
    'yellowgreen',
]

const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const FUNCTIONAL_COLOR = /^(?:rgba?|hsla?|hwb)\(/i
const COLOR_KEY = /^(?:color|\w*Color)$/
const COLOR_BINDING = /colou?r$/i

const FUNCTION_LIKE = new Set([
    'arrow_function',
    'function_expression',
    'function_declaration',
    'generator_function',
    'generator_function_declaration',
    'method_definition',
    'class_body',
])

const TRANSPARENT_WRAPPERS = new Set([
    'ternary_expression',
    'parenthesized_expression',
    'binary_expression',
    'as_expression',
    'satisfies_expression',
])

function isInsideMakeStyles(ctx: RuleContext, node: Node): boolean {
    return ctx.ancestors(node).some(ancestor => {
        if (ctx.kind(ancestor) !== 'call_expression') return false
        const callee = ctx.namedChildren(ancestor)[0]
        return (
            callee !== undefined &&
            ctx.kind(callee) === 'identifier' &&
            ctx.text(callee) === 'makeStyles' &&
            isRneuiMakeStyles(ctx, callee)
        )
    })
}

// A component declared as `export const X = () => ...` must not make its body
// a "constant", so a function boundary ends the walk.
function isModuleConstant(ctx: RuleContext, node: Node): boolean {
    for (const ancestor of ctx.ancestors(node)) {
        const kind = ctx.kind(ancestor)
        if (kind !== undefined && FUNCTION_LIKE.has(kind)) return false
        if (kind !== 'variable_declarator') continue

        const declaration = ctx.parent(ancestor)
        const container =
            declaration === undefined ? undefined : ctx.parent(declaration)
        if (container === undefined) return false
        const containerKind = ctx.kind(container)
        if (containerKind === 'program') return true
        if (containerKind !== 'export_statement') return false
        const outer = ctx.parent(container)
        return outer !== undefined && ctx.kind(outer) === 'program'
    }
    return false
}

// `primary: 'white'` in an icon map is a PWIcon variant, not a colour, so a
// named colour counts only where a colour is being assigned.
function fillsColorSlot(ctx: RuleContext, node: Node): boolean {
    for (const ancestor of ctx.ancestors(node)) {
        const kind = ctx.kind(ancestor)
        if (kind !== undefined && TRANSPARENT_WRAPPERS.has(kind)) continue

        if (kind === 'pair') {
            const key = ctx.namedChildren(ancestor)[0]
            const raw = key === undefined ? undefined : ctx.text(key)
            if (key === undefined || raw === undefined) return false
            const name = ctx.kind(key) === 'string' ? raw.slice(1, -1) : raw
            return COLOR_KEY.test(name)
        }
        if (kind === 'variable_declarator') {
            const binding = ctx.namedChildren(ancestor)[0]
            const name = binding === undefined ? undefined : ctx.text(binding)
            return name !== undefined && COLOR_BINDING.test(name)
        }
        return false
    }
    return false
}

const COLOR_START = '^.(#|[rR][gG][bB]|[hH][sS][lL]|[hH][wW][bB])'

export default defineRule({
    id: 'pera/no-color-literals-outside-theme',
    severity: 'error',
    card: {
        message: 'colour literal outside the theme',
        remediation:
            'Use a theme.colors token from apps/mobile/src/theme/tokens/. If none fits, add it to AppColors in tokens/types.ts and define it in both light.ts and dark.ts from a palette, accentPalette or tints entry in apps/mobile/src/theme/colors.ts. A value that never reaches RN styling, such as a server-render parameter, reads the palette directly.',
        examples: {
            bad: "closeButton: { backgroundColor: 'rgba(0, 0, 0, 0.35)' }",
            good: 'closeButton: { backgroundColor: theme.colors.bannerCloseButtonBg }',
        },
    },
    gates: withoutTests({
        pathMatches: ['**/apps/mobile/src/**'],
        pathNotMatches: ['**/apps/mobile/src/theme/**', ...TEST_SUPPORT],
    }),
    // A colour can sit at any depth (ternary arm, nested object, array,
    // template), so this matches literals and decides the context in `check`.
    query: [
        `((string) @value (#match? @value "${COLOR_START}"))`,
        `((template_string) @value (#match? @value "${COLOR_START}"))`,
        `((string) @named (#match? @named "^.(${NAMED_COLORS.join('|')}).$"))`,
    ].join('\n'),
    check(ctx, m) {
        const literal = m.value ?? m.named
        if (literal === undefined) return
        const text = ctx.text(literal)
        if (text === undefined) return
        const body = text.slice(1, -1).trim()

        const isColor =
            m.value !== undefined
                ? FUNCTIONAL_COLOR.test(body) || HEX_COLOR.test(body)
                : NAMED_COLORS.includes(body) && fillsColorSlot(ctx, literal)
        if (!isColor) return

        if (
            !isInsideMakeStyles(ctx, literal) &&
            !isModuleConstant(ctx, literal)
        )
            return

        ctx.report(
            literal,
            `colour literal ${text} outside the theme — use a theme.colors token`,
        )
    },
})
