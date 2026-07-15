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

import { Decimal } from 'decimal.js'

import type { RampOrder } from '../../models'
import type { RampOrderApiResponse } from './schema'

// The order response carries mutually exclusive `xo` / `meld` payloads. XO
// orders return an on-chain pay-in address (rendered as a QR); Meld orders
// return a hosted `widgetUrl` opened in a webview.
export const transformRampOrder = (api: RampOrderApiResponse): RampOrder => {
    if (api.xo) {
        return {
            kind: 'xo',
            swapOrderId: api.swap_order_id,
            payInAddress: api.xo.pay_in_address,
            payInAddressTag: api.xo.provider_response.payInAddressTag,
            sourceAmount: new Decimal(api.xo.source_amount),
            toAddress: api.xo.provider_response.toAddress,
            status: api.xo.provider_response.status,
        }
    }

    if (api.meld) {
        return {
            kind: 'meld',
            swapOrderId: api.swap_order_id,
            widgetUrl: api.meld.provider_response.widgetUrl,
        }
    }

    throw new Error('Ramp order has neither xo nor meld payload')
}
