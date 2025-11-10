import { useAppStore } from '../../store'

export const useContacts = () => {
    const {
        contacts,
        saveContact,
        deleteContact,
        selectedContact,
        setSelectedContact,
    } = useAppStore()

    const findContacts = ({
        keyword,
        matchAddress = true,
        matchName = true,
        matchNFD = true,
    }: {
        keyword: string
        matchAddress?: boolean
        matchName?: boolean
        matchNFD?: boolean
    }) => {
        const lowerPartial = keyword.toLowerCase()
        const matches = contacts.filter(c => {
            return (
                (matchAddress &&
                    c.address.toLowerCase().includes(lowerPartial)) ||
                (matchName && c.name.toLowerCase().includes(lowerPartial)) ||
                (matchNFD && c.nfd?.toLowerCase().includes(lowerPartial))
            )
        })
        return matches
    }

    return {
        selectedContact,
        contacts,
        setSelectedContact,
        findContacts,
        saveContact,
        deleteContact,
    }
}
