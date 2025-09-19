const MAX_ADDRESS_DISPLAY = 11
const ADDRESS_DISPLAY_PREFIX_LENGTH = 5

export const truncateAlgorandAddress = (address: string) => {
    if (address.length <= MAX_ADDRESS_DISPLAY) return address
    return `${address.substring(0, ADDRESS_DISPLAY_PREFIX_LENGTH)}...${address.substring(address.length - ADDRESS_DISPLAY_PREFIX_LENGTH)}`
}
