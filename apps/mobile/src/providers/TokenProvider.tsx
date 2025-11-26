import { useFcmToken } from "@perawallet/wallet-core-platform-integration"
import { PropsWithChildren, useEffect } from "react"

type TokenProviderProps = {
    token: string | null
} & PropsWithChildren

//This thing only exists to resolve a sequencing issue where we can't use the useFcmToken hook
//before the platform services are initialized (i.e. boostrapping is done)
export const TokenProvider = ({ children, token }: TokenProviderProps) => {
    const { setFcmToken } = useFcmToken()

    useEffect(() => {
        setFcmToken(token)
    }, [token])

    return (
        <>{children}</>
    )
}