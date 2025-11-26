import { config } from "@perawallet/wallet-core-config"

export const infoLog = (message: string, ...args: any[]) => {
    console.log(message, ...args)
}

export const errorLog = (message: string, ...args: any[]) => {
    console.error(message, ...args)
}

export const debugLog = (message: string, ...args: any[]) => {
    if (config.debugEnabled) {
        console.log(message, ...args)
    }
}
