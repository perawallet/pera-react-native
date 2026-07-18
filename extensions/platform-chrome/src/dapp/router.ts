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

// Service-worker side of the dapp relay: authenticates the web origin off
// chrome.runtime.MessageSender (never a page-asserted field), consults the
// permission store, and answers discover/disable/already-approved-enable
// directly. A fresh enable opens the approval window via an injectable
// ApprovalOpener (implemented by the approval bridge in a later task) and
// parks the request until the window resolves it.
import {
    type SerializedCreateOptions,
    type SerializedGetOptions,
} from '@perawallet/wallet-core-passkeys/webauthn'
import {
    ARC0027_ERROR_CODES,
    type Arc0027RequestEnvelope,
    type Arc0027ResponseEnvelope,
} from './arc0027-types'
import {
    buildErrorResponse,
    buildResponse,
    isArc0027Request,
    parseReference,
} from './arc0027-codec'
import { type PasskeyDecision } from './approval-bridge'
import { type DappPermissionStore } from './permissions'
import { isDappRelayMessage, type DiscoverInfo } from './router-protocol'

export { DAPP_RELAY_SCOPE, isDappRelayMessage } from './router-protocol'
export type { DiscoverInfo } from './router-protocol'

export interface ApprovalOpener {
    openEnable(ctx: {
        requestId: string
        origin: string
        faviconUrl?: string
    }): Promise<{ approvedAddresses: string[] } | null>
    openSignTransactions(ctx: {
        requestId: string
        origin: string
        faviconUrl?: string
        txns: unknown[]
        approvedAddresses: string[]
    }): Promise<{ stxns: (string | null)[] } | null>
    openSignMessage(ctx: {
        requestId: string
        origin: string
        faviconUrl?: string
        message: Record<string, unknown>
        approvedAddresses: string[]
    }): Promise<{ signature: string } | null>
    openPasskeyCreate(ctx: {
        requestId: string
        origin: string
        rpId: string
        userName?: string
        options: SerializedCreateOptions
    }): Promise<PasskeyDecision>
    openPasskeyGet(ctx: {
        requestId: string
        origin: string
        rpId: string
        userName?: string
        options: SerializedGetOptions
    }): Promise<PasskeyDecision>
}

export interface RouterDeps {
    permissions: DappPermissionStore
    discoverInfo: () => Promise<DiscoverInfo>
    approvals: ApprovalOpener
}

const err = (
    request: Arc0027RequestEnvelope,
    code: number,
    message: string,
): Arc0027ResponseEnvelope => buildErrorResponse(request, { code, message })

// A shapeless/malformed `request` (missing/invalid id or reference) has no
// valid reference to parse, so it can't route through buildErrorResponse
// (which assumes isArc0027Request already passed and calls parseReference
// on request.reference — throwing synchronously if that's undefined). Build
// the terminal error envelope by hand instead. The page correlates by
// requestId, not reference, so a best-effort reference here is fine.
const malformedRequestError = (request: unknown): Arc0027ResponseEnvelope => {
    const requestId =
        typeof request === 'object' &&
        request !== null &&
        typeof (request as { id?: unknown }).id === 'string'
            ? (request as { id: string }).id
            : 'unknown'
    return {
        id: globalThis.crypto.randomUUID(),
        requestId,
        reference: 'arc0027:discover:response',
        error: {
            code: ARC0027_ERROR_CODES.InvalidInputError,
            message: 'Malformed ARC-0027 request',
        },
    }
}

export class DappRequestRouter {
    // De-dupes concurrent enable windows per (origin,requestId): a repeated
    // in-flight id returns the same promise instead of opening a 2nd window.
    private readonly inFlight = new Map<
        string,
        Promise<Arc0027ResponseEnvelope>
    >()

    constructor(
        private readonly deps: RouterDeps,
        // Optional (not defaulted) — tests never call listen(), so the
        // ambient `chrome` global is only touched when it's actually invoked.
        private readonly chromeLike?: typeof chrome,
    ) {}

    listen(): void {
        ;(this.chromeLike ?? chrome).runtime.onMessage.addListener(
            this.handleMessage,
        )
    }

    // Arrow property so `this` is bound when used as an onMessage listener.
    handleMessage = (
        message: unknown,
        sender: chrome.runtime.MessageSender | undefined,
        sendResponse: (response: Arc0027ResponseEnvelope) => void,
    ): boolean => {
        if (!isDappRelayMessage(message)) return false
        const { request } = message
        if (!isArc0027Request(request)) {
            sendResponse(malformedRequestError(request))
            return true
        }
        // Origin is browser-stamped on the sender — never a page-asserted field.
        const origin = sender?.origin
        if (!origin || origin === 'null' || !/^https?:\/\//.test(origin)) {
            sendResponse(
                err(
                    request,
                    ARC0027_ERROR_CODES.InvalidInputError,
                    'Untrusted origin',
                ),
            )
            return true
        }
        const faviconUrl = sender?.tab?.favIconUrl
        void this.route(request, origin, faviconUrl).then(sendResponse, e =>
            sendResponse(
                err(
                    request,
                    ARC0027_ERROR_CODES.UnknownError,
                    e instanceof Error ? e.message : 'Router error',
                ),
            ),
        )
        return true // async sendResponse
    }

    private async route(
        request: Arc0027RequestEnvelope,
        origin: string,
        faviconUrl?: string,
    ): Promise<Arc0027ResponseEnvelope> {
        const method = parseReference(request.reference)!.method
        switch (method) {
            case 'discover': {
                return this.handleDiscover(request)
            }
            case 'enable': {
                return this.handleEnable(request, origin, faviconUrl)
            }
            case 'disable': {
                return this.handleDisable(request, origin)
            }
            case 'sign_transactions': {
                return this.handleSignTransactions(request, origin, faviconUrl)
            }
            case 'sign_message': {
                return this.handleSignMessage(request, origin, faviconUrl)
            }
            // post_transactions/sign_and_post_transactions are deferred.
            case 'post_transactions':
            case 'sign_and_post_transactions':
            default: {
                return err(
                    request,
                    ARC0027_ERROR_CODES.MethodNotSupportedError,
                    'Method not supported',
                )
            }
        }
    }

    private async handleDiscover(
        request: Arc0027RequestEnvelope,
    ): Promise<Arc0027ResponseEnvelope> {
        const info = await this.deps.discoverInfo()
        return buildResponse(request, {
            providerId: info.providerId,
            name: info.name,
            icon: info.iconUrl,
            networks: info.networks.map(n => ({
                genesisHash: n.genesisHash,
                genesisId: n.genesisId,
                methods: [
                    'enable',
                    'disable',
                    'sign_transactions',
                    'sign_message',
                ],
            })),
        })
    }

    private async enableResult(
        request: Arc0027RequestEnvelope,
        addresses: string[],
    ): Promise<Arc0027ResponseEnvelope> {
        const info = await this.deps.discoverInfo()
        const net = info.networks[0]
        return buildResponse(request, {
            providerId: info.providerId,
            genesisHash: net.genesisHash,
            genesisId: net.genesisId,
            accounts: addresses.map(address => ({ address })),
        })
    }

    private async handleEnable(
        request: Arc0027RequestEnvelope,
        origin: string,
        faviconUrl?: string,
    ): Promise<Arc0027ResponseEnvelope> {
        const already = await this.deps.permissions.approvedAddresses(origin)
        if (already.length > 0) return this.enableResult(request, already)

        const key = `${origin}::${request.id}`
        const existing = this.inFlight.get(key)
        if (existing) return existing

        const promise = (async () => {
            const decision = await this.deps.approvals.openEnable({
                requestId: request.id,
                origin,
                faviconUrl,
            })
            if (!decision) {
                return err(
                    request,
                    ARC0027_ERROR_CODES.MethodCanceledError,
                    'User canceled the connection request',
                )
            }
            await this.deps.permissions.grant(
                origin,
                decision.approvedAddresses,
            )
            return this.enableResult(request, decision.approvedAddresses)
        })().finally(() => this.inFlight.delete(key))

        this.inFlight.set(key, promise)
        return promise
    }

    private async handleDisable(
        request: Arc0027RequestEnvelope,
        origin: string,
    ): Promise<Arc0027ResponseEnvelope> {
        await this.deps.permissions.revoke(origin)
        return buildResponse(request, {
            providerId: (await this.deps.discoverInfo()).providerId,
        })
    }

    private async handleSignTransactions(
        request: Arc0027RequestEnvelope,
        origin: string,
        faviconUrl?: string,
    ): Promise<Arc0027ResponseEnvelope> {
        const approved = await this.deps.permissions.approvedAddresses(origin)
        if (approved.length === 0) {
            return err(
                request,
                ARC0027_ERROR_CODES.UnauthorizedSignerError,
                'Origin is not connected — call enable first',
            )
        }
        const txns = (request.params as { txns?: unknown } | undefined)?.txns
        if (!Array.isArray(txns) || txns.length === 0) {
            return err(
                request,
                ARC0027_ERROR_CODES.InvalidInputError,
                'Missing or empty txns',
            )
        }

        const key = `${origin}::${request.id}`
        const existing = this.inFlight.get(key)
        if (existing) return existing

        const promise = (async () => {
            const decision = await this.deps.approvals.openSignTransactions({
                requestId: request.id,
                origin,
                faviconUrl,
                txns,
                approvedAddresses: approved,
            })
            if (!decision) {
                return err(
                    request,
                    ARC0027_ERROR_CODES.MethodCanceledError,
                    'User canceled the signing request',
                )
            }
            const info = await this.deps.discoverInfo()
            return buildResponse(request, {
                providerId: info.providerId,
                stxns: decision.stxns,
            })
        })().finally(() => this.inFlight.delete(key))

        this.inFlight.set(key, promise)
        return promise
    }

    private async handleSignMessage(
        request: Arc0027RequestEnvelope,
        origin: string,
        faviconUrl?: string,
    ): Promise<Arc0027ResponseEnvelope> {
        const approved = await this.deps.permissions.approvedAddresses(origin)
        if (approved.length === 0) {
            return err(
                request,
                ARC0027_ERROR_CODES.UnauthorizedSignerError,
                'Origin is not connected — call enable first',
            )
        }
        if (typeof request.params !== 'object' || request.params === null) {
            return err(
                request,
                ARC0027_ERROR_CODES.InvalidInputError,
                'Missing message params',
            )
        }

        const key = `${origin}::${request.id}`
        const existing = this.inFlight.get(key)
        if (existing) return existing

        const promise = (async () => {
            const decision = await this.deps.approvals.openSignMessage({
                requestId: request.id,
                origin,
                faviconUrl,
                message: request.params as Record<string, unknown>,
                approvedAddresses: approved,
            })
            if (!decision) {
                return err(
                    request,
                    ARC0027_ERROR_CODES.MethodCanceledError,
                    'User canceled the signing request',
                )
            }
            const info = await this.deps.discoverInfo()
            return buildResponse(request, {
                providerId: info.providerId,
                signature: decision.signature,
            })
        })().finally(() => this.inFlight.delete(key))

        this.inFlight.set(key, promise)
        return promise
    }
}
