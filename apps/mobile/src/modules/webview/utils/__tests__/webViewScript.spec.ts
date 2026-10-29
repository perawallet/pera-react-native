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

import { describe, expect, it, vi } from 'vitest'
import { joinWebViewScripts, webViewScript } from '../webViewScript'

const evaluate = (script: string): unknown => new Function(script)()

const roundTrip = (value: unknown): unknown =>
    evaluate(`return ${webViewScript`${value}`}`)

describe('webViewScript', () => {
    it('escapes both quote kinds so neither appears bare in the payload', () => {
        const script = webViewScript`run(${`say "hi" and 'bye'`})`

        expect(script).toBe('run("say \\"hi\\" and \\u0027bye\\u0027")')
    })

    it('leaves no raw angle bracket, so a closing script tag never appears', () => {
        const script = webViewScript`run(${'</script><script>alert(1)</script>'})`

        expect(script).not.toMatch(/[<>]/)
        expect(script).not.toContain('</script>')
        expect(script).toContain('\\u003c/script\\u003e')
    })

    it('leaves no raw line terminator in the output', () => {
        const script = webViewScript`run(${'a\nb\rc\u2028d\u2029e'})`

        expect(script).not.toMatch(/[\n\r\u2028\u2029]/)
    })

    it('escapes ampersands, backticks and dollars', () => {
        const script = webViewScript`run(${'&`${x}'})`

        expect(script).not.toMatch(/[&`$]/)
    })

    it.each([
        ['a plain string', 'hello'],
        ['a hostile string', `</script>'"\`\${x}\n\r\u2028\u2029&<!--`],
        ['an object', { a: ["'", '"', '</script>'], b: { c: 1 } }],
        ['an array', [1, 'two', null, { three: '\n' }]],
        ['a number', 42],
        ['null', null],
        ['a boolean', true],
    ])('decodes %s back to the identical value', (_label, value) => {
        expect(roundTrip(value)).toStrictEqual(value)
    })

    it('keeps a quote-breakout payload as one string value', () => {
        const payload = '"); alert(1); //'
        const calls: unknown[] = []
        const script = webViewScript`record(${payload}); record('end');`

        new Function('record', script)((value: unknown) => calls.push(value))

        expect(calls).toStrictEqual([payload, 'end'])
    })

    it('keeps a double-quote concatenation payload inert when the hole sits in plain code', () => {
        const payload = '"+alert(1)+"'
        const alert = vi.fn()
        const logged: unknown[] = []
        const script = webViewScript`log("value: " + ${payload} + " end");`

        new Function('log', 'alert', script)(
            (value: unknown) => logged.push(value),
            alert,
        )

        expect(alert).not.toHaveBeenCalled()
        expect(logged).toStrictEqual([`value: ${payload} end`])
    })

    it('turns an interpolated undefined into the undefined literal', () => {
        const script = webViewScript`return [${undefined}]`

        expect(script).toBe('return [undefined]')
        expect(evaluate(script)).toStrictEqual([undefined])
    })

    it('throws when a static part has an invalid escape instead of dropping it', () => {
        expect(() => webViewScript`var re = /(a)\1/; ${1}`).toThrow(
            /invalid escape/,
        )
    })

    it('emits the static parts as cooked text', () => {
        const script = webViewScript`a\nb`

        expect(script).toBe('a\nb')
    })

    it('is byte-identical to the untagged literal when nothing is interpolated', () => {
        expect(webViewScript`window.x = 1;\ntrue;`).toBe('window.x = 1;\ntrue;')
    })
})

describe('joinWebViewScripts', () => {
    it('keeps order, skips undefined and joins with a newline', () => {
        const joined = joinWebViewScripts(
            webViewScript`a`,
            undefined,
            webViewScript`b`,
            webViewScript`c`,
        )

        expect(joined).toBe('a\nb\nc')
    })

    it('returns an empty script when every part is undefined', () => {
        expect(joinWebViewScripts(undefined)).toBe('')
    })
})
