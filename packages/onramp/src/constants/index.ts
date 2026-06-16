/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

import { ALGO_ASSET_NAME } from '@perawallet/wallet-core-shared'

/** Destination token IDs supported by the onramp (ALGO and USDC on Algorand). */
export const ONRAMP_DESTINATION_TOKEN_IDS = [
    ALGO_ASSET_NAME,
    'USDC_ALGORAND',
] as const

export const ANDROID_EXCLUDED_PAYMENT_METHODS = ['APPLE_PAY'] as const

export const IOS_EXCLUDED_PAYMENT_METHODS = ['GOOGLE_PAY'] as const

/** Meld provider metadata — name and support link for each provider. */
export const MELD_PROVIDERS = {
    AKOYA: {
        name: 'Akoya',
        link: 'https://akoya.com/contact-us',
    },
    ALCHEMYPAY: {
        name: 'AlchemyPay',
        link: 'https://alchemypaysupport.zendesk.com/hc/en-us/requests/new',
    },
    AUTHORIZENET: {
        name: 'Authorize.net',
        link: 'https://support.authorize.net/',
    },
    BANXA: {
        name: 'Banxa',
        link: 'https://support.banxa.com/en/support/home',
    },
    BILIRA: {
        name: 'Bilira',
        link: 'https://support.bilira.co/en',
    },
    BINANCECONNECT: {
        name: 'Binance Connect',
        link: 'https://www.binance.com/chat',
    },
    BINANCEPAY: {
        name: 'Binance Pay',
        link: 'https://www.binance.com/en/support',
    },
    BLOCKCHAINDOTCOM: {
        name: 'Blockchain.com',
        link: 'https://support.blockchain.com/hc/en-us/requests/new',
    },
    BOOMFI: {
        name: 'Boomfi',
        link: 'https://help.boomfi.xyz/en/',
    },
    BRAINTREE: {
        name: 'Braintree',
        link: 'https://developer.paypal.com/braintree/help/',
    },
    BRALE: {
        name: 'Brale',
        link: 'https://brale.xyz/contact',
    },
    BTCDIRECT: {
        name: 'BTC Direct',
        link: 'https://support.btcdirect.eu/hc/en-gb/requests/new',
    },
    CHECKOUT: {
        name: 'Checkout.com',
        link: 'https://support.checkout.com/',
    },
    CIRCLE: {
        name: 'Circle',
        link: 'https://support.circle.com/hc/en-us',
    },
    COINBASEPAY: {
        name: 'Coinbase Pay',
        link: 'https://help.coinbase.com',
    },
    COINFLOW: {
        name: 'Coinflow',
        link: 'https://help.coinbase.com',
    },
    ELDORADO: {
        name: 'Eldorado',
        link: 'https://help.coinbase.com',
    },
    FINICITY: {
        name: 'Finicity',
        link: 'https://help.coinbase.com',
    },
    FONBNK: {
        name: 'Fonbnk',
        link: 'https://fonbnk.zendesk.com/hc/en-us/requests/new',
    },
    GUARDARIAN: {
        name: 'Guardian',
        link: 'https://help.coinbase.com',
    },
    HARBOUR: {
        name: 'Harbour',
        link: 'https://help.coinbase.com',
    },
    KOYWE: {
        name: 'Koywe',
        link: 'https://www.koywe.com/contacto/',
    },
    KRYPTONIM: {
        name: 'Kryptonim',
        link: 'https://www.kryptonim.com/help',
    },
    MERCURYO: {
        name: 'Mercuryo',
        link: 'https://help.mercuryo.io/hc/en-gb/categories/13980390022685-Customer-Support-Help-Centre',
    },
    MESH: {
        name: 'Mesh',
        link: 'mailto:support@meso.network',
    },
    MESO: {
        name: 'Meso',
        link: 'mailto:support@meso.network',
    },
    MOONPAY: {
        name: 'Moonpay',
        link: 'https://support.moonpay.com/en/',
    },
    MOOV: {
        name: 'Moov',
        link: 'https://www.nmi.com/contact/',
    },
    MX: {
        name: 'MX',
        link: 'https://www.nmi.com/contact/',
    },
    NMI: {
        name: 'NMI',
        link: 'https://www.nmi.com/contact/',
    },
    NOAH: {
        name: 'Noah',
        link: 'mailto:support@onmeta.in',
    },
    ONMETA: {
        name: 'Onmeta',
        link: 'mailto:support@onmeta.in',
    },
    ONRAMPMONEY: {
        name: 'Onramp Money',
        link: 'https://onrampmoney.freshdesk.com/support/tickets/new',
    },
    PAYBIS: {
        name: 'Paybis',
        link: 'https://support.paybis.com/hc/en-us/requests/new',
    },
    PAYPAL: {
        name: 'Paypal',
        link: 'https://www.paypal.com/us/smarthelp/contact-us',
    },
    PLAID: {
        name: 'Plaid',
        link: 'https://support.plaid.com',
    },
    RAMP: {
        name: 'Ramp',
        link: 'https://support.ramp.network/en/collections/6690-customer-support-help-center',
    },
    REVOLUT: {
        name: 'Revolut',
        link: 'https://www.revolut.com/help',
    },
    ROBINHOOD: {
        name: 'Robinhood',
        link: 'https://robinhood.com/us/en/support/articles/how-to-contact-support/',
    },
    SALTEDGE: {
        name: 'Saltedge',
        link: 'https://www.saltedge.com/support',
    },
    SALTEDGEPARTNERS: {
        name: 'Saltedge Partners',
        link: 'https://www.saltedge.com/partners/support',
    },
    SARDINE: {
        name: 'Sardine',
        link: 'https://crypto.sardine.ai/support',
    },
    SHIFT4: {
        name: 'Shift4',
        link: 'mailto:crypto@shift4.com',
    },
    SIMPLEX: {
        name: 'Simplex',
        link: 'https://support.simplex.com/hc/en-gb/requests/new',
    },
    SQUARE: {
        name: 'Square',
        link: 'https://squareup.com/help',
    },
    STRIPE: {
        name: 'Stripe',
        link: 'https://support.stripe.com/',
    },
    SWAPPED: {
        name: 'Swapped',
        link: 'https://swapped.com/support',
    },
    TOPPER: {
        name: 'Topper',
        link: 'https://support.topperpay.com/hc/en-us/requests/new',
    },
    TRANSAK: {
        name: 'Transak',
        link: 'https://support.transak.com/en/collections/3985810-customer-help-center',
    },
    TRANSFI: {
        name: 'Transfi',
        link: 'https://transfi-customersupport.freshdesk.com/support/tickets/new',
    },
    TREMENDOUS: {
        name: 'Tremendous',
        link: 'https://help.tremendous.com',
    },
    UNLIMIT: {
        name: 'Unlimit',
        link: 'https://www.crypto.unlimit.com/support/',
    },
    WYRE: {
        name: 'Wyre',
        link: 'https://docs.sendwyre.com/',
    },
    XANPOOL: {
        name: 'Xanpool',
        link: 'https://support.xanpool.com',
    },
    YELLOWCARD: {
        name: 'Yellowcard',
        link: 'https://help.yellowcard.io/',
    },
    YODLEE: {
        name: 'Yodlee',
        link: 'https://www.yodlee.com/company/contact',
    },
} as const
