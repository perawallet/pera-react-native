export enum TransactionFilter {
    AllTime = 'all_time',
    Today = 'today',
    Yesterday = 'yesterday',
    LastWeek = 'last_week',
    LastMonth = 'last_month',
    CustomRange = 'custom_range',
}

export type CustomDateRange = {
    from: Date
    to: Date
}
