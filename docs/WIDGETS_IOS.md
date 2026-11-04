# iOS widgets

What each Pera widget on iOS shows, which options it has, and what a tap does. How the widgets get
their data, refresh and stay private is in [WIDGETS.md](WIDGETS.md).

| Widget                          | Sizes                         | Options                                                |
| ------------------------------- | ----------------------------- | ------------------------------------------------------ |
| Portfolio                       | Small, Medium                 | Chart period, Show chart, Account                      |
| Portfolio & Transactions        | Small, Medium                 | Chart period, Show chart, Account                      |
| Portfolio & Transactions (tabs) | Small                         | Chart period, Show chart, Account                      |
| Transactions                    | Small, Medium                 | Account                                                |
| Price                           | Small, Medium                 | Asset, Currency, Chart period, Show asset per currency |
| NFTs                            | Small                         | NFT, Change every                                      |
| Receive QR                      | Small                         | Account                                                |
| Cloud Backup                    | Small                         | None                                                   |
| Passphrase Backup               | Small                         | None                                                   |
| Backups                         | Medium                        | None                                                   |
| Inbox                           | Small                         | None                                                   |
| Inbox List                      | Medium                        | None                                                   |
| Signatures                      | Small                         | None                                                   |
| Notifications                   | Medium                        | None                                                   |
| Inbox & Notifications           | Small, Medium                 | None                                                   |
| Scan with Pera (control)        | Control Center, Action button | None                                                   |

## Behaviour shared by every widget

- **Adding and editing.** Widgets are added from the home screen's widget gallery. A widget with
  options opens them on long-press → Edit Widget.
- **Look.** The app's theme (light, dark or system) and the app's language, not the phone's. A Pera
  logo badge sits in the top-right corner.
- **Network.** Off MainNet, a yellow bar along the top names the network (TestNet, for example).
- **Privacy mode.** When it is on in the app, balances show as `••••`, the NFT and Receive QR widgets
  show the Pera logo, and the transaction and inbox widgets show the Pera logo. Prices and backup
  status still show: they reveal no holdings.
- **Locked phone.** Balances, charts, transaction rows, NFT images and the Receive QR are hidden
  until the phone is unlocked (StandBy and the Mac desktop included). None of the widgets is offered
  on the lock screen.
- **Nothing to show.** With no accounts yet, or before the app has run once, a widget shows the Pera
  logo.
- **Freshness.** Portfolio, Transactions, Price and the inbox widgets fetch on their own every 30
  minutes, and 5 minutes after a failed fetch. "Updated" shows the time of the data shown. The
  other widgets change when the app does.

## Portfolio

The total value of the portfolio, or of one account.

![Portfolio, small](images/widgets-ios/portfolio-small.png) ![Portfolio, medium](images/widgets-ios/portfolio-medium.png)

**Shows**

- Title: "Portfolio Value", or the account's name when one account is picked.
- The ALGO amount, with "≈" and the value in the app's currency under it (not shown when the app's
  currency is ALGO).
- A line chart of the chosen period, green when the period ended up, red when down. Small: under the
  amounts. Medium: beside them.
- "Updated" and the time.

**Options**

![Portfolio options](images/widgets-ios/portfolio-options.png)

| Option       | Values                                                           | Default   |
| ------------ | ---------------------------------------------------------------- | --------- |
| Chart period | Default (the app's chart period), 1 day, 1 week, 1 month, 1 year | Default   |
| Show chart   | On, off                                                          | On        |
| Account      | Portfolio (every account), or one account                        | Portfolio |

An account that has been removed from the app falls back to Portfolio.

**Tap:** set to Portfolio, opens the app home with the account drawer open. Set to one account,
opens that account.

## Portfolio & Transactions

The Portfolio widget with a second page of recent transactions.

![Portfolio & Transactions, small, portfolio page](images/widgets-ios/portfolio-transactions-small-page1.png) ![Portfolio & Transactions, small, transactions page](images/widgets-ios/portfolio-transactions-small-page2.png) ![Portfolio & Transactions, medium](images/widgets-ios/portfolio-transactions-medium.png)

**Small:** one page at a time. A round button in the bottom-right corner switches between the
portfolio page and the transactions page (3 rows). The dots on the button show which page is on.

**Medium:** both side by side: portfolio on the left, the latest 3 transactions on the right. No
button.

**Options:** the same as Portfolio. The Account option also picks whose transactions are listed.

![Portfolio & Transactions options](images/widgets-ios/portfolio-transactions-options.png)

**Tap:** as Portfolio on the portfolio page. On the transactions page, set to Portfolio it opens the
app home with the account drawer open; set to one account, it opens that account's History tab.
In medium, each half opens its own destination.

**Buttons:** the page button switches page. The page is shared by every copy of this widget on the
home screen.

## Portfolio & Transactions (tabs)

The same two pages as Portfolio & Transactions, switched with a tab bar instead of a button. Small
only.

![Portfolio & Transactions (tabs), portfolio page](images/widgets-ios/portfolio-transactions-tabs-page1.png) ![Portfolio & Transactions (tabs), transactions page](images/widgets-ios/portfolio-transactions-tabs-page2.png)

**Shows:** the current page above a bar of two tabs, a chart icon (portfolio) and a list icon
(transactions). The selected tab is filled. The transactions page lists 2 rows.

**Options:** the same as Portfolio.

![Portfolio & Transactions (tabs) options](images/widgets-ios/portfolio-transactions-tabs-options.png)

**Tap:** as Portfolio & Transactions.

**Buttons:** each tab shows its page; tapping the selected tab does nothing. The page is shared by
every copy of this widget on the home screen.

## Transactions

The most recent transactions of every account, or of one.

![Transactions, small](images/widgets-ios/transactions-small.png) ![Transactions, medium](images/widgets-ios/transactions-medium.png)

**Shows**

- Title: "Last transactions", or the account's name.
- One row per transaction, newest first: Small shows 4, Medium shows 3.
- Each row has an icon for its type, and:
    - **Small:** the amount (or the type when nothing moved) over how long ago it happened.
    - **Medium:** the type over how long ago, with the amount on the right.
- Types: Send (amount with "−"), Receive (amount with "+", in green), Swap ("USDC → ALGO"), Opt-in,
  Opt-out, App Call, and Transaction for anything else.
- "No transactions available" when the account has none; "—" when they couldn't be loaded.

**Options**

![Transactions options](images/widgets-ios/transactions-options.png)

| Option  | Values                                    | Default   |
| ------- | ----------------------------------------- | --------- |
| Account | Portfolio (every account), or one account | Portfolio |

Portfolio reads the first five accounts.

**Tap:** set to Portfolio, opens the app home with the account drawer open. Set to one account,
opens that account's History tab.

## Price

A verified asset's price and how it moved.

![Price, small](images/widgets-ios/price-small.png)

![Price, medium](images/widgets-ios/price-medium.png)

<!-- screenshot: price-asset-small.png -->

**Shows**

- Title: "ALGO price", or the asset's unit name, with a green verified badge.
- For any asset but ALGO, its ID under the title, so a look-alike asset can't pass for it.
- The price, and the 24h change with ▲ (green) or ▼ (red).
- Small: the "1 USD = 10.71 ALGO" line when Show asset per currency is on, otherwise a chart.
  Medium: both, with the chart beside the figures.
- "Updated" and the time.

**Options**

![Price options](images/widgets-ios/price-options.png)

| Option                  | Values                                                                | Default |
| ----------------------- | --------------------------------------------------------------------- | ------- |
| Asset                   | ALGO, and the verified, non-collectible assets the accounts hold      | ALGO    |
| Currency                | Default (the app's currency), ALGO, and the currencies the app offers | Default |
| Chart period            | Default, 1 day, 1 week, 1 month, 1 year                               | 1 week  |
| Show asset per currency | On, off                                                               | On      |

ALGO priced in ALGO says nothing, so that pair uses the app's currency. An asset that loses its
verification shows no price.

**Tap:** opens the app.

## NFTs

One of the accounts' NFTs, full bleed.

![NFTs, small](images/widgets-ios/nfts-small.png)

**Shows:** the NFT's image filling the widget, with its name and collection along the bottom. No
NFTs (or none with an image): the Pera logo.

**Options**

![NFTs options](images/widgets-ios/nfts-options.png)

| Option       | Values                        | Default    |
| ------------ | ----------------------------- | ---------- |
| NFT          | Random NFT, or one NFT        | Random NFT |
| Change every | Never, 1 hour, 6 hours, 1 day | Never      |

A picked NFT that is no longer held falls back to Random NFT. With Change every set, the widget
moves to another NFT at each interval.

**Tap:** opens that NFT in the app. With no NFT showing, opens the app.

## Receive QR

An account's QR code, to be scanned by whoever is paying.

![Receive QR, small](images/widgets-ios/receive-small.png)

**Shows:** the QR code of the account's receive address on a white square, and the account's name
under it. In privacy mode, or with no account to show, the Pera logo.

**Options**

![Receive QR options](images/widgets-ios/receive-options.png)

| Option  | Values                       | Default           |
| ------- | ---------------------------- | ----------------- |
| Account | Any account that can receive | The first account |

A removed account falls back to the first one.

**Tap:** opens that account in the app.

## Cloud Backup

Whether the wallet is backed up to the cloud.

![Cloud Backup, small](images/widgets-ios/cloud-backup-small.png)

**Shows:** a cloud icon, the status and a second line:

| Status                   | Second line         |
| ------------------------ | ------------------- |
| Not backed up            | Tap to back up      |
| 2 accounts not in backup | Tap to back up      |
| Backup failed            | When it failed      |
| Backed up                | Last sync: the date |

**Tap:** opens the app's cloud backup flow. When cloud backup isn't available, opens the app.

## Passphrase Backup

Which accounts still need their recovery passphrase backed up.

![Passphrase Backup, small](images/widgets-ios/passphrase-backup-small.png)

**Shows:** a key icon and either "All backed up", or how many accounts still need a backup
("1 account needs a backup") with "Tap to back up".

**Tap:** opens the passphrase backup flow, at the account that needs it.

## Backups

Cloud Backup and Passphrase Backup side by side. Medium only.

![Backups, medium](images/widgets-ios/backups-medium.png)

**Tap:** each half opens its own flow, as the single widgets do.

## Inbox

How many requests are waiting.

![Inbox, small](images/widgets-ios/inbox-small.png)

**Shows:** the number waiting ("3 waiting") and, under it, a count per kind: signature requests,
incoming assets and shared-account invitations. With nothing waiting, a green check and "All caught
up".

**Tap:** opens the inbox.

## Inbox List

The newest inbox items. Medium only.

![Inbox List, medium](images/widgets-ios/inbox-list-medium.png)

**Shows:** up to 3 rows. Each has an icon and label for its kind (signature request, incoming
assets, invitation), with the account's name under it when the account is one of the user's; on the
right, how long ago it arrived, or for incoming assets how many are waiting. "All caught up" when empty.

**Tap:** each row opens its own item: a signature request opens that request, incoming assets open
that account's asset inbox, an invitation opens the inbox.

## Signatures

Shared-account transactions waiting for the user's signature. Small only.

![Signatures, small](images/widgets-ios/signatures-small.png)

**Shows:** the number to sign ("2 to sign"), or "All caught up".

**Tap:** with exactly one request, opens it. Otherwise, opens the inbox.

## Notifications

The latest Pera notifications. Medium only.

![Notifications, medium](images/widgets-ios/notifications-medium.png)

**Shows:** up to 3 notifications with how long ago each arrived. "No notifications yet" when empty.

**Tap:** opens the notifications screen.

## Inbox & Notifications

The inbox count and the latest notifications in one widget.

![Inbox & Notifications, small, inbox page](images/widgets-ios/inbox-notifications-small-page1.png) ![Inbox & Notifications, small, notifications page](images/widgets-ios/inbox-notifications-small-page2.png) ![Inbox & Notifications, medium](images/widgets-ios/inbox-notifications-medium.png)

**Small:** one page at a time, switched with a tab bar of two tabs, a tray (inbox) and a bell
(notifications). The notifications page lists 2.

**Medium:** both side by side: the inbox count on the left, notifications on the right. No tabs.

**Tap:** the inbox page or half opens the inbox; the notifications page or half opens notifications.

**Buttons:** each tab shows its page. The page is shared by every copy of this widget on the home
screen.

## Scan with Pera

A control, not a widget: added to Control Center or assigned to the Action button. iOS 18 and later.

![Scan with Pera in Control Center, bottom left, next to the system's code scanner](images/widgets-ios/scan-control-center.png)

**Shows:** the Pera petals inside QR brackets, labelled "Scan with Pera".

**Tap:** opens Pera's QR scanner. From a locked phone, iOS asks to unlock first; if the app lock is
on, the PIN comes before the scanner. The same action is on the app icon's long-press menu, as
"Scan QR Code".

![Scan QR Code in the app icon's long-press menu](images/widgets-ios/scan-quick-action.png)
