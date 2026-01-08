import {
    useAllAccounts,
    useArbitraryDataSigner,
} from '@perawallet/wallet-core-accounts'
import {
    ArbitraryDataSignRequest,
    useSigningRequest,
} from '@perawallet/wallet-core-blockchain'
import useToast from '@hooks/toast'
import { useLanguage } from '@hooks/language'
import { useCallback, useState } from 'react'

export const useArbitraryDataSigningView = (
    request: ArbitraryDataSignRequest,
) => {
    const { t } = useLanguage()
    const { removeSignRequest } = useSigningRequest()
    const { showToast } = useToast()
    const { signArbitraryData } = useArbitraryDataSigner()
    const allAccounts = useAllAccounts()
    const [isPending, setIsPending] = useState(false)

    const approveRequest = useCallback(async () => {
        if (request.transport === 'algod') {
            showToast({
                title: t('signing.arbitrary_data_view.error_title'),
                body: t('signing.arbitrary_data_view.algod_not_valid'),
                type: 'error',
            })
            removeSignRequest(request)
            return
        }

        setIsPending(true)
        const signedData = request.data.map(async data => {
            const account = allAccounts.find(
                account => account.address === data.signer,
            )

            if (!account) {
                removeSignRequest(request)
                throw new Error(
                    t('signing.arbitrary_data_view.account_not_found'),
                )
            }
            const signature = await signArbitraryData(account, data.data)
            if (!signature?.length) {
                removeSignRequest(request)
                throw new Error(
                    t('signing.arbitrary_data_view.signature_not_found'),
                )
            }

            return {
                signer: account.address,
                signature: signature[0],
            }
        })
        try {
            const signatures = await Promise.all(signedData)
            await request.approve?.(signatures)
        } catch (error) {
            await request.error?.(`${error}`)
        } finally {
            setIsPending(false)
            removeSignRequest(request)
        }
    }, [request, removeSignRequest, showToast, signArbitraryData, allAccounts])

    const rejectRequest = useCallback(() => {
        removeSignRequest(request)
        if (request.transport === 'callback') {
            request.reject?.()
        }
    }, [request, removeSignRequest])

    return {
        approveRequest,
        rejectRequest,
        isPending,
    }
}
