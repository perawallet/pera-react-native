const MAX_ADDRESS_DISPLAY = 11

export const truncateAlgorandAddress = (
    address: string,
    maxLength: number = MAX_ADDRESS_DISPLAY,
) => {
    const prefixLength =
        maxLength % 2 === 0 ? maxLength / 2 : (maxLength - 1) / 2
    if (address.length <= maxLength) return address
    return `${address.substring(0, prefixLength)}...${address.substring(address.length - prefixLength)}`
}
