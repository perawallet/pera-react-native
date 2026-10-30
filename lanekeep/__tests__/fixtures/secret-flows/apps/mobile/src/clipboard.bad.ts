export const copyMnemonic = (account: Account) => {
    copyToClipboard(account.mnemonic)
}

export const copyKey = (account: Account, clipboard: Clipboard) => {
    clipboard.copyToClipboard(account.privateKey)
}

export const copyPhrase = async (id: string) => {
    const phrase = await resolveMnemonic(id)
    await Clipboard.setStringAsync(phrase)
}

export const copySeed = (phrase: string) => {
    const seed = seedFromMnemonic(phrase)
    Clipboard.setString(seed)
}

export const copyEntropy = (phrase: string) => {
    const entropy = mnemonicToEntropy(phrase)
    navigator.clipboard.writeText(entropy)
}

export const copyUri = (data: Data) => {
    copyToClipboard(data.uri)
}

export const copyViaRef = (ref: Ref, account: Account) => {
    ref.current.copyToClipboard(account.mnemonic)
}
