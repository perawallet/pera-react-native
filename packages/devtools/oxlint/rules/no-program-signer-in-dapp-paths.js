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

/** Everything a dApp sign request flows through, relative to the repo root. */
export const DAPP_SIGNING_PATHS = [
    'packages/signing/src/pipeline',
    'packages/signing/src/machine',
    'packages/signing/src/hooks/useSignAndSubmitGroup.ts',
    'packages/signing/src/hooks/useSigningRequest.ts',
    'packages/signing/src/hooks/useSigningPipeline.ts',
]

// Word-bounded so cosignProgrammatic and friends stay legal. Raw text, as the
// spec this replaces scanned it: a comment naming the signer is flagged too.
const PROGRAM_SIGNER =
    /\b(?:useProgramSigner|signProgram|signDelegatedLsig|encodeDelegatedLsig|ProgramSigningUnsupportedError)\b/g

const lineColumn = (text, index) => {
    const before = text.slice(0, index)
    return {
        line: before.split('\n').length,
        column: index - (before.lastIndexOf('\n') + 1),
    }
}

export const noProgramSignerInDappPaths = {
    meta: {
        type: 'problem',
        docs: {
            description:
                'Keep the delegated LogicSig signer unreachable from dApp signing',
        },
        messages: {
            reachable:
                '{{name}} must not be reachable from dApp signing: dApp requests resolve signers only through getSigningStrategy.',
        },
        schema: [],
    },
    create(context) {
        return {
            Program() {
                const text = context.sourceCode.getText()
                for (const match of text.matchAll(PROGRAM_SIGNER)) {
                    context.report({
                        loc: {
                            start: lineColumn(text, match.index),
                            end: lineColumn(text, match.index + match[0].length),
                        },
                        messageId: 'reachable',
                        data: { name: match[0] },
                    })
                }
            },
        }
    },
}
