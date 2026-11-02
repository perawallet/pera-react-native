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
import { contractCallNoticeOf } from '../contractCallNotice'

const NAMED = 'transactions.contract_call.unchecked_warning'
const UNNAMED = 'transactions.contract_call.unchecked_warning_no_source'

describe('contractCallNoticeOf', () => {
    it('names the origin the platform observed over Verify and the claimed url', () => {
        const notice = contractCallNoticeOf(
            {
                url: 'https://claimed.example',
                verification: {
                    status: 'valid',
                    verifiedOrigin: 'https://verify.example',
                },
            },
            'https://observed.example/swap',
        )

        expect(notice).toEqual({
            titleKey: NAMED,
            params: { domain: 'observed.example' },
        })
    })

    it('names the origin Verify attested over the claimed url', () => {
        const notice = contractCallNoticeOf({
            url: 'https://claimed.example',
            verification: {
                status: 'mismatch',
                verifiedOrigin: 'https://verify.example',
            },
        })

        expect(notice.params).toEqual({ domain: 'verify.example' })
    })

    it('keeps a port and drops the scheme and path of the observed origin', () => {
        const notice = contractCallNoticeOf(
            undefined,
            'https://app.uniswap.org:8443/swap?x=1',
        )

        expect(notice).toEqual({
            titleKey: NAMED,
            params: { domain: 'app.uniswap.org:8443' },
        })
    })

    it('never names the url the dApp claims for itself', () => {
        const notice = contractCallNoticeOf({
            url: 'https://app.uniswap.org',
            verification: { status: 'unknown' },
        })

        expect(notice).toEqual({ titleKey: UNNAMED })
    })

    it.each([
        ['no source', undefined, undefined],
        ['a source without a url', { name: 'Uniswap' }, undefined],
        ['an observed origin that does not parse', undefined, 'not a url'],
    ])(
        'asks the user to trust the sending app given %s',
        (_label, source, verifiedOrigin) => {
            expect(contractCallNoticeOf(source, verifiedOrigin)).toEqual({
                titleKey: UNNAMED,
            })
        },
    )
})
