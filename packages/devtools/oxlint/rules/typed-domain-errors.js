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

const isBareError = superClass =>
    superClass?.type === 'Identifier'
        ? superClass.name === 'Error'
        : superClass?.type === 'MemberExpression' &&
          !superClass.computed &&
          superClass.object.type === 'Identifier' &&
          superClass.object.name === 'globalThis' &&
          superClass.property.name === 'Error'

export const typedDomainErrors = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Domain errors extend AppError, not Error',
        },
        messages: {
            bareError:
                'Domain errors extend AppError from @perawallet/wallet-core-shared, or a domain base that does, so the app can classify them and map their copy. An error that must stay plain (a third-party implements contract, a package wallet-core-shared depends on) takes an oxlint-disable-next-line comment giving its reason.',
        },
        schema: [],
    },
    create(context) {
        const check = node => {
            if (isBareError(node.superClass)) {
                context.report({
                    node: node.superClass,
                    messageId: 'bareError',
                })
            }
        }
        return {
            ClassDeclaration: check,
            ClassExpression: check,
        }
    },
}
