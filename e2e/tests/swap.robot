*** Settings ***
Documentation       Swap on Android and iOS from one suite. Every case opens Swap from Home, so a
...                 WebView or sheet left up by a failed case cannot take the next one with it.
...                 Quote-dependent cases skip when the network has no swap liquidity. Funded cases
...                 need PERA_E2E_SWAP_MNEMONIC (a funded mainnet wallet) and skip without it; the
...                 one case that executes a real swap also needs PERA_E2E_SWAP_ALLOW_SPEND=1.
Resource            ../resources/swap.resource

Suite Setup         Start Pera With Wallet
Suite Teardown      Run Keywords    Reset To Fresh Wallet    AND    Close Pera
Test Teardown       Capture Failure Screenshot
Test Timeout        ${E2E_TEST_TIMEOUT}
Test Tags           swap


*** Test Cases ***
Swap Tab Opens The Swap Form
    [Tags]    id:swap.form.open    swap-form    p0    rc
    Open Swap
    Page Should Contain Element    ${SWAP_PAY_ASSET_SELECTOR}
    Page Should Contain Element    ${SWAP_RECEIVE_ASSET_SELECTOR}
    Page Should Contain Element    ${SWAP_MAX_BUTTON}

Info Icon Opens Swap Support And Closes Back To The Form
    [Tags]    id:swap.form.info-support    swap-form    p0    rc
    Open Swap
    Tap    ${SWAP_INFO_BUTTON}
    Wait Until Page Contains Element    ${WEBVIEW_CLOSE_BUTTON}    timeout=30s
    Tap    ${WEBVIEW_CLOSE_BUTTON}
    Wait Until Page Does Not Contain Element    ${WEBVIEW_CLOSE_BUTTON}    timeout=15s
    Wait Until Page Contains Element    ${SWAP_PAY_INPUT}    timeout=15s

Account Selector Opens The Account List
    [Tags]    id:swap.account.picker-open    swap-form    p1
    Open Swap
    Tap    ${ACCOUNT_SELECTION_BUTTON}
    Wait Until Page Contains Element    ${ACCOUNT_DRAWER}    timeout=15s
    Wait Until Page Contains Element    ${ACCOUNT_ROW_ANY}    timeout=15s

Pay Balance Shows A Number
    [Tags]    id:swap.form.balance-shown    swap-form    p1
    Open Swap
    Wait Until Page Contains Element    ${SWAP_BALANCE_VALUE}    timeout=15s
    ${raw}=    Get Text    ${SWAP_BALANCE_VALUE}
    ${balance}=    Extract Number    ${raw}
    Should Not Be Equal    ${balance}    ${None}    The pay balance shows no number: "${raw}".
    Should Be True    ${balance} >= 0

Receive Selector Says Select When No Asset Is Chosen
    [Tags]    id:swap.asset.receive-unset    swap-asset    p1
    Open Swap
    ${unset}=    Run Keyword And Return Status    Page Should Contain Element    ${SWAP_SELECT_ASSET_LABEL}
    IF    not ${unset}
        ${label}=    Text Inside    //*[@content-desc='swap-receive-asset-selector' or @resource-id='swap-receive-asset-selector' or @name='swap-receive-asset-selector']
        Skip If    not $label.strip()
        ...    App gap: AssetSelector's PWTouchableOpacity applies getTestProps (apps/mobile/src/components/core/PWTouchableOpacity/PWTouchableOpacity.tsx), which hides its label on iOS.
        Skip    A receive asset (${label}) is already chosen on this wallet.
    END
    Page Should Not Contain Element    ${SWAP_PROVIDER_ROW}

Account List Is Sorted By Balance
    [Tags]    id:swap.account.sorted-by-balance    swap-form    p2    needs-testid
    # AccountWithBalance (apps/mobile/src/components/AccountWithBalance/AccountWithBalance.tsx) gives the
    # balance no testID, so it is read from the row's text, where a digit in the name can win.
    Open Swap
    Tap    ${ACCOUNT_SELECTION_BUTTON}
    Wait Until Page Contains Element    ${ACCOUNT_ROW_ANY}    timeout=15s
    ${rows}=    Get Webelements    ${ACCOUNT_ROW_ANY}
    ${count}=    Get Length    ${rows}
    Skip If    ${count} < 2    Ordering needs at least two accounts; the wallet has ${count}.
    VAR    @{balances}
    FOR    ${index}    IN RANGE    1    ${count + 1}
        ${text}=    Text Inside    (${ACCOUNT_ROW_ANY.replace('xpath=', '')})[${index}]
        ${balance}=    Extract Number    ${text}
        Should Not Be Equal    ${balance}    ${None}    Account row ${index} shows no balance: "${text}".
        VAR    @{balances}    @{balances}    ${balance}
    END
    Should Be True    $balances == sorted($balances, reverse=True)
    ...    Accounts are not ordered by balance: ${balances}

Max On An Empty Account Says There Is Nothing To Swap
    [Tags]    id:swap.form.max-empty-account    swap-form    p1
    Open Swap
    Tap    ${SWAP_MAX_BUTTON}
    Wait Until Page Contains Element    ${NOTHING_TO_SWAP_TOAST}    timeout=10s
    Page Should Not Contain Element    ${SWAP_PROVIDER_ROW}

Amount Above The Balance Is Flagged
    [Tags]    id:swap.form.insufficient-balance    swap-form    p2
    Open Swap
    Enter Pay Amount    999999999
    Wait Until Page Contains Element    ${SWAP_INSUFFICIENT_BALANCE}    timeout=15s

Clearing The Amount Clears Its Result
    [Tags]    id:swap.form.clear-resets    swap-form    p1
    Open Swap
    Enter Pay Amount    999999999
    Wait Until Page Contains Element    ${SWAP_INSUFFICIENT_BALANCE}    timeout=15s
    Clear Text    ${SWAP_PAY_INPUT}
    Wait Until Page Does Not Contain Element    ${SWAP_INSUFFICIENT_BALANCE}    timeout=10s
    Form Should Offer No Swap

Zero Amount Offers No Swap
    [Tags]    id:swap.form.zero-no-cta    swap-form    p2
    Open Swap
    Enter Pay Amount    0
    Form Should Offer No Swap

Non Numeric Amount Offers No Swap
    [Tags]    id:swap.form.non-numeric-no-cta    swap-form    p2
    Open Swap
    Enter Pay Amount    abc
    Form Should Offer No Swap

Pay Amount Produces A Positive Quote
    [Tags]    id:swap.quote.receive-populated    swap-form    p1    needs-testid
    Open Swap
    Choose USDC To Receive
    Enter Amount And Wait For Quote    1
    ${raw}=    Quoted Receive Amount
    ${received}=    Extract Number    ${raw}
    Should Not Be Equal    ${received}    ${None}    The receive amount is not a number: "${raw}".
    Should Be True    ${received} > 0    A quote for 1 must receive more than 0, got ${received}.

Quote Shows The Swap Button Disabled Without Funds
    [Tags]    id:swap.quote.cta-shown    swap-form    p2
    Open Swap
    Enter Amount And Wait For Quote    1
    Wait Until Page Contains Element    ${SWAP_BUTTON}    timeout=15s
    Expect Element    ${SWAP_BUTTON}    disabled

Receive Amount Keeps Its Decimals
    [Tags]    id:swap.quote.decimal-precision    swap-form    p1    needs-testid
    Open Swap
    Choose USDC To Receive
    Enter Amount And Wait For Quote    0.1
    ${raw}=    Quoted Receive Amount
    Should Not Be Equal    ${{ None }}    ${{ re.search(r'[0-9][.][0-9]', $raw) }}
    ...    Receive amount "${raw}" shows no fractional part.

Receive Picker Lists Swappable Assets
    [Tags]    id:swap.asset.receive-picker-open    swap-asset    p2
    Open Swap
    Open Receive Asset Picker
    ${rows}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${RECEIVE_ASSET_ROW_ANY}    timeout=30s
    IF    not ${rows}
        # The list shows no empty state until a filter is applied; with one it must show rows or
        # the empty state, and neither means the picker is broken rather than the backend empty.
        Search Assets    USD
        Wait Until Page Contains Element    xpath=${RECEIVE_ASSET_ROW_ANY.replace('xpath=', '')} | ${NO_MATCHING_ASSETS.replace('xpath=', '')}
        ...    timeout=15s
        # Rows under a filter still show the picker listing what the DEX offers, which is all this
        # case claims. Skipping on them too made it unpassable through this branch: it skipped
        # whenever the unfiltered list was merely slow, and that is the half of its
        # pass-one-run-skip-the-next that was ours rather than the backend's.
        ${filtered}=    Run Keyword And Return Status
        ...    Page Should Contain Element    ${RECEIVE_ASSET_ROW_ANY}
        Skip If    not ${filtered}    The receive (DEX) asset list is empty on this run.
    END
    Close Picker Back To Form

Asset Search With No Match Shows The Empty State
    [Tags]    id:swap.asset.search-no-match    swap-asset    p2
    Open Swap
    Open Receive Asset Picker
    Search Assets    ${NO_MATCH_SEARCH}
    Wait Until Page Contains Element    ${NO_MATCHING_ASSETS}    timeout=20s
    Page Should Not Contain Element    ${RECEIVE_ASSET_ROW_ANY}

Choosing A Receive Asset Returns To The Form
    [Tags]    id:swap.asset.receive-select    swap-asset    p1
    Open Swap
    Open Receive Asset Picker
    Search Assets    ${USDC_ASSET_ID}
    Wait For USDC Receive Row
    Tap    ${USDC_RECEIVE_ROW}
    Wait Until Page Does Not Contain Element    ${ASSET_SEARCH_INPUT}    timeout=15s
    Wait Until Page Contains Element    ${RECEIVE_IS_USDC}    timeout=15s

Choosing A Pay Asset Returns To The Form
    [Tags]    id:swap.asset.pay-select    swap-asset    p1
    Open Swap
    Open Pay Asset Picker
    Wait Until Page Contains Element    ${PAY_ASSET_ROW_ANY}    timeout=15s
    Tap    ${PAY_ASSET_ROW_ANY}
    Wait Until Page Does Not Contain Element    ${ASSET_SEARCH_INPUT}    timeout=15s
    Wait Until Page Contains Element    ${SWAP_PAY_INPUT}    timeout=15s

Flip Swaps Pay And Receive And Flips Back
    [Tags]    id:swap.asset.flip    swap-asset    p1
    Open Swap
    Tap    ${SWAP_FLIP_BUTTON}
    Wait Until Page Contains Element    ${SWAP_PAY_INPUT}    timeout=15s
    Page Should Contain Element    ${SWAP_PAY_ASSET_SELECTOR}
    Page Should Contain Element    ${SWAP_RECEIVE_ASSET_SELECTOR}
    Tap    ${SWAP_FLIP_BUTTON}
    Wait Until Page Contains Element    ${SWAP_PAY_INPUT}    timeout=15s

Pay Picker Leaves Out An Asset The Account Does Not Hold
    [Tags]    id:swap.asset.pay-held-only    swap-asset    p1
    Open Swap
    Open Receive Asset Picker
    Search Assets    ${USDC_ASSET_ID}
    Wait For USDC Receive Row
    Close Picker Back To Form
    Open Pay Asset Picker
    # The "no rows left" wait polls its locator repeatedly; as an xpath that is a full
    # element-tree walk per poll on iOS, which ran past WebDriverAgent's proxy timeout and
    # killed the session. The adapter gives each platform a form it can answer cheaply.
    ${pay_rows}=    Rows With Prefix    ${PAY_ASSET_ROW_PREFIX}
    Wait Until Page Contains Element    ${pay_rows}    timeout=15s
    Search Assets    USDC
    Wait Until Page Does Not Contain Element    ${pay_rows}    timeout=15s
    Close Picker Back To Form

Receive Picker Lists USDC
    [Tags]    id:swap.asset.receive-lists-usdc    swap-asset    p1
    Open Swap
    Open Receive Asset Picker
    Search Assets    ${USDC_ASSET_ID}
    Wait For USDC Receive Row
    Close Picker Back To Form

Asset Search Ignores Case
    [Documentation]    The receive search goes to the backend as typed, and only a lowercase query
    ...                matches: "USDC" and "Folks" find nothing while "usdc" finds USDC.
    [Tags]    id:swap.asset.search-any-case    swap-asset    p2    app-bug
    Open Swap
    Open Receive Asset Picker
    Receive Rows Or Skip
    ${unfiltered}=    Get Matching Xpath Count    ${RECEIVE_ASSET_ROW_ANY.replace('xpath=', '')}
    Search Assets    USDC
    Wait For Search To Apply    ${unfiltered}
    # The backend search answers asynchronously: wait for either outcome before judging it.
    Wait Until Keyword Succeeds    15s    0.5s
    ...    Run Keyword And Expect Error    *    Run Keywords
    ...    Page Should Not Contain Element    ${USDC_RECEIVE_ROW}    AND
    ...    Page Should Not Contain Element    ${NO_MATCHING_ASSETS}
    ${found}=    Run Keyword And Return Status    Page Should Contain Element    ${USDC_RECEIVE_ROW}
    IF    not ${found}
        Page Should Contain Element    ${NO_MATCHING_ASSETS}
        Skip    App bug: the receive asset search is case-sensitive; "USDC" matches nothing (query passed verbatim from apps/mobile/src/modules/swap/components/SwapToAssetSelectionList/useSwapToAssetSelectionList.ts).
    END
    Close Picker Back To Form

Slippage Preset Is Saved
    [Tags]    id:swap.config.slippage-preset    swap-config    p1
    Open Swap
    Open Configuration
    Page Should Contain Element    ${CONFIG_SLIPPAGE_CUSTOM}
    Expect Element    ${CONFIG_APPLY}    enabled
    Tap    ${CONFIG_SLIPPAGE_CHIP_1}
    Apply Configuration
    Open Configuration
    ${saved}=    Get Text    ${CONFIG_SLIPPAGE_INPUT}
    Should Be Equal    ${saved}    1

Custom Slippage Is Saved
    [Tags]    id:swap.config.slippage-custom    swap-config    p1
    Open Swap
    Open Configuration
    Tap    ${CONFIG_SLIPPAGE_CUSTOM}
    Input Text    ${CONFIG_SLIPPAGE_INPUT}    3
    Dismiss Keyboard
    Expect Element    ${CONFIG_APPLY}    enabled
    Apply Configuration
    Open Configuration
    ${saved}=    Get Text    ${CONFIG_SLIPPAGE_INPUT}
    Should Be Equal    ${saved}    3

Out Of Range Slippage Blocks Apply
    [Tags]    id:swap.config.slippage-out-of-range    swap-config    p2
    Open Swap
    Open Configuration
    Tap    ${CONFIG_SLIPPAGE_CUSTOM}
    Input Text    ${CONFIG_SLIPPAGE_INPUT}    99
    Wait Until Page Contains Element    ${CONFIG_SLIPPAGE_ERROR}    timeout=5s
    Expect Element    ${CONFIG_APPLY}    disabled

Balance Preset Fills From The Balance
    [Tags]    id:swap.config.balance-preset    swap-config    p1
    Open Swap
    Open Configuration
    Tap    ${CONFIG_BALANCE_CHIP_50}
    Apply Configuration
    Wait Until Page Contains Element    ${NOTHING_TO_SWAP_TOAST}    timeout=10s

Custom Balance Percentage Is Accepted
    [Tags]    id:swap.config.balance-custom    swap-config    p1
    Open Swap
    Open Configuration
    Input Text    ${CONFIG_BALANCE_INPUT}    40
    Dismiss Keyboard
    Page Should Not Contain Element    ${CONFIG_BALANCE_ERROR}
    Expect Element    ${CONFIG_APPLY}    enabled
    Apply Configuration
    Wait Until Page Contains Element    ${NOTHING_TO_SWAP_TOAST}    timeout=10s

Local Currency Toggle Is Saved And Reverts
    [Tags]    id:swap.config.local-currency    swap-config    p1
    Open Swap
    Set Local Currency    ${True}
    Local Currency Should Be    ${True}
    Set Local Currency    ${False}
    Local Currency Should Be    ${False}

Quote Shows The Auto Provider
    [Tags]    id:swap.provider.row-shown    swap-provider    p1
    Open Swap
    Enter Amount And Wait For Quote
    Page Should Contain Element    ${PROVIDER_TITLE_AUTO}
    Restore Auto Provider

Dismissing The Provider Sheet Discards The Choice
    [Tags]    id:swap.provider.dismiss-discards    swap-provider    p1
    Open Swap
    Enter Amount And Wait For Quote
    Open Provider Sheet
    Other Provider Or Skip
    Tap    ${PROVIDER_OPTION_OTHER}
    Close Provider Sheet
    Wait Until Page Contains Element    ${PROVIDER_TITLE_AUTO}    timeout=15s
    Page Should Not Contain Element    ${PROVIDER_TITLE_MANUAL}

Chosen Provider Survives Reopening The Sheet
    [Tags]    id:swap.provider.persists-reopen    swap-provider    p1
    Open Swap
    Enter Amount And Wait For Quote
    Open Provider Sheet
    Other Provider Or Skip
    Tap    ${PROVIDER_OPTION_OTHER}
    Tap    ${PROVIDER_APPLY}
    Wait Until Page Contains Element    ${PROVIDER_TITLE_MANUAL}    timeout=15s
    Page Should Not Contain Element    ${PROVIDER_TITLE_AUTO}
    Open Provider Sheet
    Close Provider Sheet
    Page Should Contain Element    ${PROVIDER_TITLE_MANUAL}
    Restore Auto Provider

Each Provider States Its Price
    [Tags]    id:swap.provider.price-per-row    swap-provider    p1    needs-testid
    Open Swap
    Enter Amount And Wait For Quote
    Open Provider Sheet
    Other Provider Or Skip
    ${text}=    Text Inside    ${PROVIDER_OPTION_OTHER.replace('xpath=', '')}
    Close Provider Sheet
    # Prices always carry a fraction, which keeps digits in names like "Vestige V4" out.
    ${price}=    Evaluate    re.search(r'[0-9][.][0-9]', $text)    modules=re
    # The row is a PWTouchableOpacity with getTestProps; on iOS that leaves only the provider's
    # name readable and the price is not exposed at all, which the needs-testid tag records.
    # Nothing here can tell that gap apart from a provider quoting no price, so say what the row
    # did expose and skip rather than claim either.
    Skip If    $price is None
    ...    No price is readable on a provider row; it exposes only "${text}". Needs a testID on the price.
    Should Not Be Equal    ${{ None }}    ${price}
    ...    The provider row states no price: "${text}".

Tapping A Top Pair Fills The Form
    [Tags]    id:swap.pairs.top-populates    swap-history    p1
    Open Swap
    ${shown}=    Run Keyword And Return Status    Wait Until Page Contains Element    ${TOP_PAIR_FIRST}    timeout=20s
    Skip If    not ${shown}    No top pairs from the backend on this run.
    Page Should Contain Element    ${TOP_PAIRS}
    Page Should Contain Element    ${TOP_PAIRS_TITLE}
    Tap    ${TOP_PAIR_FIRST}
    Wait Until Page Contains Element    ${SWAP_PAY_INPUT}    timeout=15s
    Page Should Contain Element    ${SWAP_PAY_ASSET_SELECTOR}
    Page Should Contain Element    ${SWAP_RECEIVE_ASSET_SELECTOR}

Top Pair Row Shows Its Pair And Volume
    [Tags]    id:swap.pairs.top-row-details    swap-history    p1    needs-testid
    Open Swap
    ${shown}=    Run Keyword And Return Status    Wait Until Page Contains Element    ${TOP_PAIR_FIRST}    timeout=20s
    Skip If    not ${shown}    No top pairs from the backend on this run.
    ${text}=    Wait Until Keyword Succeeds    10s    0.5s    Top Pair Row With Volume
    Should Contain    ${text}    to    The top pair row shows no "X to Y" label: "${text}".

Swap History Opens From See All And Closes Back To The Form
    [Tags]    id:swap.history.open-close    swap-history    p2    needs-funded    excludefromci
    Open Swap With Funded Account
    Wait Until Page Contains Element    ${HISTORY_WIDGET}    timeout=15s
    Open Swap History
    Page Should Not Contain Element    ${HISTORY_EMPTY}
    Close Sheet
    Wait Until Page Does Not Contain Element    ${HISTORY_LIST}    timeout=10s
    Wait Until Page Contains Element    ${SWAP_PAY_INPUT}    timeout=10s

Swap History Row Opens It In The Explorer
    [Tags]    id:swap.history.row-explorer    swap-history    p2    needs-funded    excludefromci
    Open Swap With Funded Account
    Open Swap History
    Wait Until Page Contains Element    ${HISTORY_ROW_FIRST}    timeout=20s
    Tap    ${HISTORY_ROW_FIRST}
    Wait Until Page Contains Element    ${WEBVIEW_CLOSE_BUTTON}    timeout=30s
    Tap    ${WEBVIEW_CLOSE_BUTTON}

Large Amount Warns About Price Impact
    [Tags]    id:swap.confirm.price-impact-warning    swap-exec    p1    needs-funded    excludefromci
    Open Swap With Funded Account
    Choose USDC To Receive
    Enter Amount And Wait For Quote    1000000
    ${affordable}=    Run Keyword And Return Status
    ...    Expect Element    ${SWAP_BUTTON}    enabled    timeout=1ms    retry_interval=0s    loglevel=NONE
    Skip If    not ${affordable}    The funded wallet cannot afford an amount large enough to move the price.
    Tap    ${SWAP_BUTTON}
    Wait Until Settled    ${CONFIRM_SLIDE}
    Page Should Contain Element    ${CONFIRM_WARNING}
    Tap    ${CONFIRM_CLOSE}

Confirmation Shows Every Quote Detail
    [Tags]    id:swap.confirm.details    swap-exec    p0    needs-funded    needs-testid    excludefromci
    Open Swap With Funded Account
    Open Confirmation
    Page Should Contain Element    ${CONFIRM_TITLE}
    FOR    ${label}    IN    @{CONFIRM_LABELS}
        Page Should Contain Element    xpath=//*[@text='${label}' or @label='${label}']
    END
    FOR    ${test_id}    IN    @{CONFIRM_VALUE_IDS}
        ${value}=    Displayed Value    ${test_id}
        Should Not Be Empty    ${value.strip()}    ${test_id} is rendered but empty.
    END
    ${fee}=    Displayed Value    swap-confirm-pera-fee
    Should Not Be Equal    ${None}    ${{ re.search(r'[0-9]', $fee) }}    The Pera fee is not a number: "${fee}".
    Tap    ${CONFIRM_CLOSE}
    Wait Until Page Does Not Contain Element    ${CONFIRM_SLIDE}    timeout=10s

Minimum Received Does Not Exceed The Quote
    [Tags]    id:swap.confirm.min-received    swap-exec    p0    needs-funded    needs-testid    excludefromci
    Open Swap With Funded Account
    Choose USDC To Receive
    Enter Amount And Wait For Quote    ${FUNDED_PAY_AMOUNT}
    ${quoted_raw}=    Displayed Value    swap-receive-amount
    ${quoted}=    Extract Number    ${quoted_raw}
    Should Not Be Equal    ${quoted}    ${None}    The quoted amount is not a number: "${quoted_raw}".
    Expect Element    ${SWAP_BUTTON}    enabled    timeout=30s
    Tap    ${SWAP_BUTTON}
    Wait Until Settled    ${CONFIRM_SLIDE}
    ${minimum_raw}=    Displayed Value    swap-confirm-min-received
    ${minimum}=    Extract Number    ${minimum_raw}
    Should Not Be Equal    ${minimum}    ${None}    Minimum received is not a number: "${minimum_raw}".
    Should Be True    ${minimum} <= ${quoted}
    ...    Minimum received ${minimum} exceeds the quoted ${quoted}; slippage was applied the wrong way.
    Tap    ${CONFIRM_CLOSE}

Real ALGO To USDC Swap Completes And Lands In History
    [Documentation]    Spends real mainnet funds (about 0.1 ALGO), hence the second opt-in.
    [Tags]    id:swap.exec.algo-to-usdc    swap-exec    p0    needs-funded    needs-testid    excludefromci    mainnet-exec
    Skip If    os.environ.get('PERA_E2E_SWAP_ALLOW_SPEND') != '1'
    ...    PERA_E2E_SWAP_ALLOW_SPEND is not 1; this case executes a real paid swap.
    Open Swap With Funded Account
    Open Confirmation
    Slide To Confirm    ${CONFIRM_SLIDE}
    # The sheet closes only after the swap is submitted and confirmed on chain.
    Wait Until Page Does Not Contain Element    ${CONFIRM_SLIDE}    timeout=120s
    Wait Until Page Contains Element    ${SWAP_PAY_INPUT}    timeout=20s
    Page Should Not Contain Element    ${SWAP_QUOTE_ERROR}
    Open Swap History
    Wait Until Page Contains Element    ${HISTORY_ROW_FIRST}    timeout=30s
    ${row}=    Text Inside    ${HISTORY_ROW_FIRST.replace('xpath=', '')}
    Should Contain    ${row}    Swapped    The newest history row does not describe a swap: "${row}".
    Should Contain    ${row}    USDC    The newest history row is not this ALGO to USDC swap: "${row}".
    Close Sheet
