export const copyAddress = (account: Account) => {
    copyToClipboard(account.address)
}

export const copyExport = async (exportUrl: string) => {
    await Clipboard.setStringAsync(exportUrl)
}
