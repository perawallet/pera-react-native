// The broadcaster wraps sendRawTransaction; callers never name it.
export const label = 'submitRawSignedTransactionGroup'
export const viaBroadcaster = (submitSignedGroup: () => void) =>
    submitSignedGroup()
