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

import { describe, expect, it } from 'vitest'
import { RuleTester } from 'oxlint/plugins-dev'
import { webviewInjectionSerializer } from '../rules/webview-injection-serializer.js'
import { mentionsTypeReference } from '../rules/type-reference.js'
import { id, type Node } from './helpers.js'

RuleTester.describe = describe
RuleTester.it = it

const RULE = 'pera/webview-injection-serializer'

const tester = new RuleTester({
    languageOptions: {
        sourceType: 'module',
        parserOptions: { lang: 'tsx' },
    },
})

const unserialized = { messageId: 'unserialized' }
const cast = { messageId: 'cast' }
const outsideCode = { messageId: 'outsideCode' }

tester.run(RULE, webviewInjectionSerializer, {
    valid: [
        'webview.injectJavaScript(webViewScript`window.postMessage(${response});`)',
        'webview?.injectJavaScript(webViewScript`window.postMessage(${response});`)',
        'webviewRef.current?.injectJavaScript(webViewScript`true;`)',
        'injectJavaScript(joinWebViewScripts(a, b))',
        "webview.injectJavaScript('true;')",
        'webview.injectJavaScript(`true;`)',
        "const SCRIPT = 'true;'\nwebview.injectJavaScript(SCRIPT)",
        "export const SCRIPT = 'true;'\nwebview.injectJavaScript(SCRIPT)",
        'webview.injectJavaScript(flag ? webViewScript`a;` : joinWebViewScripts(b))',
        "<WebView injectedJavaScript='true;' />",
        '<WebView injectedJavaScript={undefined} />',
        '<WebView injectedJavaScript={webViewScript`true;`} />',
        '<WebView injectedJavaScript={joinWebViewScripts(a, b)} />',
        '<WebView injectedJavaScriptBeforeContentLoaded={cond ? joinWebViewScripts(a, webViewScript`true;`) : undefined} />',
        "const BUNDLE = 'true;'\nconst el = <WebView injectedJavaScript={BUNDLE} />",
        'webview.reload(script)',
        'webview.injectJavaScriptLater(script)',
        'webview[injectJavaScript](script)',
        '<WebView source={script} />',
        '<WebView injectedJavaScriptForMainFrameOnly={flag} />',
        'const x = value as string',
        'webview.injectJavaScript(webViewScript`run(${x}, ${y});`)',
        'webview.injectJavaScript(webViewScript`say("hello"); run(${x});`)',
        'const BUNDLE = webViewScript`true;`\nconst el = <WebView injectedJavaScript={BUNDLE} />',
        "const A = 'a;'\nconst B = flag ? A : joinWebViewScripts(A)\nwebview.injectJavaScript(B)",
        'tag`run("${x}")`',
        "function f() { const script = 'true;'\nwebview.injectJavaScript(script) }",
        'function f() { const s = webViewScript`run(${x});`\nwebview.injectJavaScript(s) }',
        "import { useMemo } from 'react'\nfunction C() { const js = useMemo(() => joinWebViewScripts(a, b), [a, b])\nreturn <WebView injectedJavaScript={js} /> }",
        "import React from 'react'\nfunction C() { const js = React.useMemo(() => flag ? webViewScript`a;` : undefined, [flag])\nreturn <WebView injectedJavaScriptBeforeContentLoaded={js} /> }",
        'webview.injectJavaScript(webViewScript`say("a"); run(${x}, \'b\'); // done`)',
        'webview.injectJavaScript(webViewScript`/* note */ run(${x})`)',
        'webview.injectJavaScript(webViewScript`// note\nrun(${x})`)',
        'webview.injectJavaScript(webViewScript`var re = /["\']/; run(${x});`)',
        'webview.injectJavaScript(webViewScript`var a = b / 2; run(${x}); var c = d / 3;`)',
        'webview.injectJavaScript(webViewScript`var s = \\`a\\${ f(${x}) }b\\`;`)',
    ],
    invalid: [
        {
            code: 'function f(x) { const message = `window.postMessage(${x});`\nwebview.injectJavaScript(message) }',
            errors: [unserialized],
        },
        {
            code: "let script = 'true;'\nwebview.injectJavaScript(script)",
            errors: [unserialized],
        },
        {
            code: 'webview.injectJavaScript(`window.location.assign(${url});`)',
            errors: [unserialized],
        },
        {
            code: "webview.injectJavaScript('window.location.assign(' + url + ')')",
            errors: [unserialized],
        },
        {
            code: 'webview?.injectJavaScript(buildScript(url))',
            errors: [unserialized],
        },
        {
            code: 'webview.injectJavaScript(other`true;`)',
            errors: [unserialized],
        },
        {
            code: 'webview.injectJavaScript(scripts.webViewScript`true;`)',
            errors: [unserialized],
        },
        {
            code: 'webview.injectJavaScript(joinScripts(a, b))',
            errors: [unserialized],
        },
        {
            code: 'webview.injectJavaScript(flag ? webViewScript`a;` : script)',
            errors: [unserialized],
        },
        {
            code: 'webview.injectJavaScript()',
            errors: [unserialized],
        },
        {
            code: 'injectJavaScript(script)',
            errors: [unserialized],
        },
        {
            code: '<WebView injectedJavaScript />',
            errors: [unserialized],
        },
        {
            code: '<WebView injectedJavaScript={script} />',
            errors: [unserialized],
        },
        {
            code: '<WebView injectedJavaScriptBeforeContentLoaded={a + b} />',
            errors: [unserialized],
        },
        {
            code: '<WebView injectedJavaScriptBeforeContentLoaded={enabled ? build() : undefined} />',
            errors: [unserialized],
        },
        {
            code: "webview['injectJavaScript'](script)",
            errors: [unserialized],
        },
        {
            code: "const CONFIG_JS = `key = '${process.env.X}'`\nconst el = <WebView injectedJavaScript={CONFIG_JS} />",
            errors: [unserialized],
        },
        {
            code: 'const A = B\nconst B = A\nwebview.injectJavaScript(A)',
            errors: [unserialized],
        },
        {
            code: 'const A = build()\nwebview.injectJavaScript(A)',
            errors: [unserialized],
        },
        {
            code: 'webview.injectJavaScript(webViewScript`run("${x}")`)',
            errors: [outsideCode],
        },
        {
            code: "webview.injectJavaScript(webViewScript`run('${x}')`)",
            errors: [outsideCode],
        },
        {
            code: 'webview.injectJavaScript(webViewScript`run(\\`${x}\\`)`)',
            errors: [outsideCode],
        },
        {
            code: 'const s = webViewScript`a = "x ${y}" + "${z}";`',
            errors: [outsideCode, outsideCode],
        },
        {
            code: 'webViewScript`log("value: ${v} end")`',
            errors: [outsideCode],
        },
        {
            code: 'webViewScript`/* ${v} */`',
            errors: [outsideCode],
        },
        {
            code: 'webViewScript`run(); // ${v}\nrun()`',
            errors: [outsideCode],
        },
        {
            code: "webViewScript`log('value: ${v} end')`",
            errors: [outsideCode],
        },
        {
            code: 'webViewScript`log(\\`value: ${v} end\\`)`',
            errors: [outsideCode],
        },
        {
            code: 'webViewScript`log("a \\\\" ${v}")`',
            errors: [outsideCode],
        },
        {
            code: 'webViewScript`var re = /${v}/;`',
            errors: [outsideCode],
        },
        {
            code: "const SCRIPT = 'true;'\nfunction f(SCRIPT) { webview.injectJavaScript(SCRIPT) }",
            errors: [unserialized],
        },
        {
            code: "const SCRIPT = 'true;'\nfunction f() { let SCRIPT = 'true;'\nwebview.injectJavaScript(SCRIPT) }",
            errors: [unserialized],
        },
        {
            code: 'const { SCRIPT } = scripts\nwebview.injectJavaScript(SCRIPT)',
            errors: [unserialized],
        },
        {
            code: 'function C() { const js = useMemo(() => webViewScript`a;`, [])\nreturn <WebView injectedJavaScript={js} /> }',
            errors: [unserialized],
        },
        {
            code: "import { useMemo } from 'react'\nfunction C() { const js = useMemo(() => build(), [])\nreturn <WebView injectedJavaScript={js} /> }",
            errors: [unserialized],
        },
        {
            code: 'const x = value as WebViewScript',
            errors: [cast],
        },
        {
            code: 'const x = value as WebViewScript | undefined',
            errors: [cast],
        },
        {
            code: 'const x = value as unknown as WebViewScript',
            errors: [cast],
        },
    ],
})

new RuleTester({
    languageOptions: {
        sourceType: 'module',
        parserOptions: { lang: 'ts' },
    },
}).run(RULE, webviewInjectionSerializer, {
    valid: ['const x = <WebViewScripts>value'],
    invalid: [{ code: 'const x = <WebViewScript>value', errors: [cast] }],
})

describe('mentionsTypeReference', () => {
    const reference = (name: string): Node => ({
        type: 'TSTypeReference',
        typeName: id(name),
    })

    it('finds a reference nested in a union and a qualified name', () => {
        expect(
            mentionsTypeReference(
                { type: 'TSUnionType', types: [reference('WebViewScript')] },
                'WebViewScript',
            ),
        ).toBe(true)
        expect(
            mentionsTypeReference(
                {
                    type: 'TSTypeReference',
                    typeName: {
                        type: 'TSQualifiedName',
                        left: id('webview'),
                        right: id('WebViewScript'),
                    },
                },
                'WebViewScript',
            ),
        ).toBe(true)
    })

    it('ignores other references and the parent link', () => {
        const node = reference('string')
        node.parent = reference('WebViewScript')
        expect(mentionsTypeReference(node, 'WebViewScript')).toBe(false)
    })
})
