*** Settings ***
Resource            onboarding.resource
Resource            discover.resource
Resource            accounts.resource


*** Variables ***
${SWAP_TAB}                         tid=Swap
${SWAP_INTRO_START_BUTTON}          tid=swap-intro-start-button
${SWAP_INFO_BUTTON}                 tid=swap_info_button
${WEBVIEW_CLOSE_BUTTON}             tid=webview_close_button
${ACCOUNT_DRAWER}                   tid=pw_drawer_gesture_surface
${ACCOUNT_ROW_ANY}                  xpath=//*[starts-with(@content-desc,'account_switcher_row_') or starts-with(@resource-id,'account_switcher_row_') or starts-with(@name,'account_switcher_row_')]

${SWAP_PAY_INPUT}                   tid=swap-pay-input
${SWAP_RECEIVE_AMOUNT}              tid=swap-receive-amount
${SWAP_BUTTON}                      tid=swap-button
${SWAP_MAX_BUTTON}                  tid=swap-max-button
${SWAP_FLIP_BUTTON}                 tid=swap-flip-button
${SWAP_CONFIGURE_BUTTON}            tid=swap-configure-button
${SWAP_PROVIDER_ROW}                tid=swap-provider-row
${SWAP_PAY_ASSET_SELECTOR}          tid=swap-pay-asset-selector
${SWAP_RECEIVE_ASSET_SELECTOR}      tid=swap-receive-asset-selector
# PWView containers expose their testID as resource-id on Android, not as an accessibility id.
${SWAP_QUOTE_ERROR}                 tid=swap_quote_error
${SWAP_INSUFFICIENT_BALANCE}        tid=swap_insufficient_balance
# Either native tree can flatten the balance label beside its View. The testID
# anchors both that shape and the nested label shape.
${PAY_BALANCE_VIEW}                 //*[@resource-id='swap-pay-balance' or @name='swap-pay-balance' or @content-desc='swap-pay-balance']
${SWAP_BALANCE_VALUE}               xpath=(${PAY_BALANCE_VIEW}/descendant-or-self::* | (${PAY_BALANCE_VIEW})/following-sibling::*[1])[contains(translate(concat(@text,@label),'0123456789','##########'),'#')][1]
${SWAP_SELECT_ASSET_LABEL}          xpath=//*[@text='Select' or @label='Select']
# iOS labels the toast with its title and body together, and keeps a hidden one in the tree.
${NOTHING_TO_SWAP_TOAST}            xpath=//*[(starts-with(@text,'Nothing to swap') or starts-with(@label,'Nothing to swap')) and not(@visible='false')]

${ASSET_SEARCH_INPUT}               tid=searchable-list-search-input
${PAY_ASSET_ROW_ANY}                xpath=//*[starts-with(@content-desc,'asset-list-item-') or starts-with(@resource-id,'asset-list-item-') or starts-with(@name,'asset-list-item-')]
${PAY_ASSET_ROW_PREFIX}             asset-list-item-
${SOURCE_ACCOUNT_HEADER}            tid=swap_source_account_header
${SOURCE_ACCOUNT_ROW_ANY}           xpath=//*[(starts-with(@content-desc,'swap_source_account_') or starts-with(@resource-id,'swap_source_account_') or starts-with(@name,'swap_source_account_')) and not(contains(concat(@content-desc,@resource-id,@name),'header'))]
${RECEIVE_ASSET_ROW_ANY}            xpath=//*[starts-with(@content-desc,'swap-asset-item-') or starts-with(@resource-id,'swap-asset-item-') or starts-with(@name,'swap-asset-item-')]
${NO_MATCHING_ASSETS}               xpath=//*[@text='No Matching Assets' or @label='No Matching Assets']
${NO_MATCH_SEARCH}                  ZZQXNOMATCH9999
# Mainnet USDC: verified and pooled against ALGO, so a stable probe for the receive list.
${USDC_ASSET_ID}                    31566704
${USDC_RECEIVE_ROW}                 tid=swap-asset-item-31566704
# Anchor the unit on the receive balance so the Top Swaps strip cannot satisfy it.
${RECEIVE_BALANCE}                  tid=swap-receive-balance
${RECEIVE_BALANCE_VIEW}             //*[@resource-id='swap-receive-balance' or @name='swap-receive-balance' or @content-desc='swap-receive-balance']
${RECEIVE_BALANCE_IS_USDC}          xpath=(${RECEIVE_BALANCE_VIEW}/descendant-or-self::* | (${RECEIVE_BALANCE_VIEW})[@resource-id]/following-sibling::*[1])[contains(concat(@text,@label),'USDC')][1]
${PAY_CHAIN_FILTER}                 tid=swap_from_chain_filter
${RECEIVE_CHAIN_FILTER}             tid=swap_to_chain_filter
${OTHER_CHAIN_RECEIVE_CHIP}         xpath=(//*[(starts-with(@content-desc,'swap_to_chain_filter_') or starts-with(@resource-id,'swap_to_chain_filter_') or starts-with(@name,'swap_to_chain_filter_')) and not(contains(concat(@content-desc,@resource-id,@name),'_all')) and not(contains(concat(@content-desc,@resource-id,@name),'_algorand'))])[1]
# The selector's label is the asset's unit; iOS folds it into the touchable, Android keeps a child.
${PAY_IS_USDC}                      xpath=//*[@content-desc='swap-pay-asset-selector' or @resource-id='swap-pay-asset-selector' or @name='swap-pay-asset-selector'][descendant-or-self::*[contains(@text,'USDC') or contains(@label,'USDC')]]

${CONFIG_APPLY}                     tid=swap-config-apply
${CONFIG_SLIPPAGE_INPUT}            tid=swap-config-slippage-input
${CONFIG_SLIPPAGE_CUSTOM}           tid=swap-config-slippage-chip-custom
${CONFIG_SLIPPAGE_CHIP_1}           tid=swap-config-slippage-chip-1
${CONFIG_BALANCE_INPUT}             tid=swap-config-balance-input
${CONFIG_BALANCE_CHIP_50}           tid=swap-config-balance-chip-50
${CONFIG_LOCAL_CURRENCY_TOGGLE}     tid=swap_local_currency_toggle
${CONFIG_SLIPPAGE_ERROR}            xpath=//*[starts-with(@text,'Slippage must be between') or starts-with(@label,'Slippage must be between')]
${CONFIG_BALANCE_ERROR}             xpath=//*[starts-with(@text,'Balance percentage must be between') or starts-with(@label,'Balance percentage must be between')]

${PROVIDER_APPLY}                   tid=swap-provider-apply
${PROVIDER_OPTION_AUTO}             tid=swap-provider-option-auto
# Each option holds an <option>-radio view, which iOS also names; the first non-auto row is wanted.
${PROVIDER_OPTION_OTHER}            xpath=(//*[((starts-with(@content-desc,'swap-provider-option-') or starts-with(@resource-id,'swap-provider-option-')) and not(starts-with(@content-desc,'swap-provider-option-auto') or starts-with(@resource-id,'swap-provider-option-auto'))) or (starts-with(@name,'swap-provider-option-') and not(starts-with(@name,'swap-provider-option-auto')) and not(contains(@name,'-radio')))])[1]
${PROVIDER_TITLE_AUTO}              xpath=//*[@text='Provider (Best price available)' or @label='Provider (Best price available)']
${PROVIDER_TITLE_MANUAL}            xpath=//*[@text='Provider' or @label='Provider']

${HISTORY_WIDGET}                   tid=swap-pair-history-widget
${HISTORY_SEE_ALL}                  tid=swap-pair-history-see-all
${HISTORY_LIST}                     tid=swap-history-list
${HISTORY_EMPTY}                    xpath=//*[@text='No swaps yet' or @label='No swaps yet']
${HISTORY_TITLE}                    xpath=//*[@text='Swap History' or @label='Swap History']
${HISTORY_STRIP_ERROR}              xpath=//*[@text="Couldn't load swap history." or @label="Couldn't load swap history."]
${PAIR_CHIP_PREFIX}                 swap-pair-chip-
${PAIR_CHIP_FIRST}                  xpath=(//*[starts-with(@content-desc,'swap-pair-chip-') or starts-with(@resource-id,'swap-pair-chip-') or starts-with(@name,'swap-pair-chip-')])[1]
# ALGO is asset 0 on Algorand; the chip id is swap-pair-chip-<in>-<out>.
${ALGO_TO_USDC_CHIP}                tid=swap-pair-chip-0-31566704
${HISTORY_ROW_FIRST}                xpath=(//*[starts-with(@content-desc, 'swap-history-item-') or starts-with(@resource-id, 'swap-history-item-') or starts-with(@name,'swap-history-item-')])[1]

${CONFIRM_SLIDE}                    tid=swap-confirm-slide
${CONFIRM_WARNING}                  tid=swap-confirm-warning
${CONFIRM_CLOSE}                    tid=swap-confirm-close
${CONFIRM_ROUTE}                    tid=swap-confirm-route
${CONFIRM_CROSS_CHAIN_NOTE}         tid=swap-confirm-cross-chain-note
${CONFIRM_NETWORK_FEE}              tid=swap-confirm-network-fee
${CONFIRM_PROVIDER_FEE}             tid=swap-confirm-provider-fee
${CONFIRM_TITLE}                    xpath=//*[@text='Confirm Swap' or @label='Confirm Swap']
# Label to value testID. Only Provider and Slippage Tolerance render on every route; the others
# render when the provider reports them.
&{CONFIRM_ROWS}                     Rate=swap-confirm-rate    Provider=swap-confirm-provider
...                                 Slippage Tolerance=swap-confirm-slippage    Price Impact=swap-confirm-price-impact
...                                 Minimum Received=swap-confirm-min-received    Pera Fee=swap-confirm-pera-fee
@{CONFIRM_ALWAYS_IDS}               swap-confirm-provider    swap-confirm-slippage

${QUOTE_TIMEOUT}                    45
# Quote fetches are debounced, so an absent CTA only proves something once this has passed.
${QUOTE_SETTLE}                     3s
${FUNDED_PAY_AMOUNT}                0.1
${FUNDED_WALLET_IMPORTED}           ${False}


*** Keywords ***
Open Swap
    [Documentation]    Home first, so a WebView or sheet left by an earlier case cannot cover the form.
    Go Home
    # First visits raise the age declaration and then the introduction sheet, a moment apart.
    Open Past Age Gate    ${SWAP_TAB}    ${SWAP_PAY_INPUT}    also_dismiss=${SWAP_INTRO_START_BUTTON}
    # The introduction is requested as the form mounts, and Android keeps the form in the tree
    # under it, so the form being there does not mean the sheet is gone.
    ${intro}=    Run Keyword And Return Status    Page Should Contain Element    ${SWAP_INTRO_START_BUTTON}
    IF    ${intro}
        Wait Until Settled    ${SWAP_INTRO_START_BUTTON}
        Tap    ${SWAP_INTRO_START_BUTTON}
        Wait Until Page Does Not Contain Element    ${SHEET_BACKDROP}    timeout=10s
    END

Open Swap With Funded Account
    [Documentation]    Skips unless PERA_E2E_SWAP_MNEMONIC holds a funded mainnet universal wallet.
    ...                Replaces the device wallet with it once per session; the phrase is passed
    ...                straight through and never assigned or logged.
    Skip If    not os.environ.get('PERA_E2E_SWAP_MNEMONIC')
    ...    PERA_E2E_SWAP_MNEMONIC is not set; this case needs a funded mainnet wallet.
    IF    not ${FUNDED_WALLET_IMPORTED}
        Import From Welcome    ${RECOVER_UNIVERSAL_WALLET}    PERA_E2E_SWAP_MNEMONIC
        VAR    ${FUNDED_WALLET_IMPORTED}    ${True}    scope=SUITE
    END
    Open Swap

Enter Pay Amount
    [Arguments]    ${amount}
    Clear Text    ${SWAP_PAY_INPUT}
    Input Text    ${SWAP_PAY_INPUT}    ${amount}
    Dismiss Keyboard

Wait For Quote
    [Documentation]    The provider row renders only with a selected quote; the receive amount shows
    ...                0.00 without one, so it proves nothing. No quote is a backend or liquidity
    ...                condition on this network, so it skips.
    FOR    ${i}    IN RANGE    ${QUOTE_TIMEOUT}
        ${quoted}=    Run Keyword And Return Status    Page Should Contain Element    ${SWAP_PROVIDER_ROW}
        IF    ${quoted}    RETURN
        ${failed}=    Run Keyword And Return Status    Page Should Contain Element    ${SWAP_QUOTE_ERROR}
        Skip If    ${failed}    The quote service answered with an error on this run.
        Sleep    1s
    END
    Skip    No quote within ${QUOTE_TIMEOUT}s; this network or pair has no swap liquidity.

Enter Amount And Wait For Quote
    [Arguments]    ${amount}=1
    Enter Pay Amount    ${amount}
    Wait For Quote

Form Should Offer No Swap
    Sleep    ${QUOTE_SETTLE}
    Page Should Not Contain Element    ${SWAP_BUTTON}
    Page Should Not Contain Element    ${SWAP_PROVIDER_ROW}

Extract Number
    [Documentation]    First number in a display string, tolerating grouping commas and a currency
    ...                prefix; None when there is none. [.] because a backslash does not survive Evaluate.
    [Arguments]    ${raw}
    ${num}=    Evaluate
    ...    (lambda m: float(m.group(0).replace(',', '')) if m else None)(re.search(r'[0-9][0-9,]*(?:[.][0-9]+)?', $raw))
    RETURN    ${num}

Text Inside
    [Documentation]    Joined text of an element's descendants, for rows whose own node carries no text.
    [Arguments]    ${xpath}
    ${found}    ${nodes}=    Run Keyword And Ignore Error    Get Webelements
    ...    xpath=(${xpath})//*[string-length(@text) > 0 or string-length(@label) > 0]
    IF    '${found}' != 'PASS'    RETURN    ${EMPTY}
    # iOS reports a node's name AND its label, so the same string arrives twice and a row
    # reads back as "Vestige V4 Vestige V4". Keep the first of each, in order.
    VAR    @{parts}
    FOR    ${node}    IN    @{nodes}
        ${text}=    Get Text    ${node}
        ${seen}=    Evaluate    $text in $parts
        IF    not ${seen}    VAR    @{parts}    @{parts}    ${text}
    END
    RETURN    ${{ ' '.join($parts) }}

Open Pay Asset Picker
    Tap    ${SWAP_PAY_ASSET_SELECTOR}
    Wait Until Page Contains Element    ${ASSET_SEARCH_INPUT}    timeout=15s

Open Receive Asset Picker
    Tap    ${SWAP_RECEIVE_ASSET_SELECTOR}
    Wait Until Page Contains Element    ${ASSET_SEARCH_INPUT}    timeout=15s

Search Assets
    [Arguments]    ${term}
    Input Text    ${ASSET_SEARCH_INPUT}    ${term}
    Dismiss Keyboard

Receive Rows Or Skip
    [Documentation]    The receive list comes from the DEX backend and can be empty on a network
    ...                without swap liquidity.
    ${rows}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${RECEIVE_ASSET_ROW_ANY}    timeout=30s
    Skip If    not ${rows}    The receive (DEX) asset list is empty on this run.

Wait For USDC Receive Row
    [Documentation]    After a search by USDC's ID. The search is debounced, so the unfiltered list,
    ...                USDC included, stays up for a moment and is then replaced; wait for the one
    ...                row the ID matches.
    Receive Rows Or Skip
    Wait Until Keyword Succeeds    15s    0.3s    Only USDC Should Be Listed
    Wait Until Settled    ${USDC_RECEIVE_ROW}

Only USDC Should Be Listed
    ${count}=    Get Matching Xpath Count    ${RECEIVE_ASSET_ROW_ANY.replace('xpath=', '')}
    Should Be Equal As Integers    ${count}    1
    Page Should Contain Element    ${USDC_RECEIVE_ROW}

Wait For Search To Apply
    [Documentation]    Waits until the receive list differs from the unfiltered ${before} rows.
    [Arguments]    ${before}
    Wait Until Keyword Succeeds    15s    0.3s    Receive List Should Differ    ${before}

Receive List Should Differ
    [Arguments]    ${before}
    ${now}=    Get Matching Xpath Count    ${RECEIVE_ASSET_ROW_ANY.replace('xpath=', '')}
    Should Not Be Equal As Integers    ${now}    ${before}

Quoted Receive Amount
    [Documentation]    The provider row can render a moment before the receive amount takes the
    ...                quote, so poll until it shows more than zero.
    FOR    ${i}    IN RANGE    20
        ${raw}=    Displayed Value    swap-receive-amount
        ${amount}=    Extract Number    ${raw}
        IF    $amount    RETURN    ${raw}
        Sleep    0.25s
    END
    RETURN    ${raw}

Close Picker Back To Form
    Dismiss Keyboard
    Close Sheet
    Wait Until Page Does Not Contain Element    ${ASSET_SEARCH_INPUT}    timeout=10s
    Wait Until Page Contains Element    ${SWAP_PAY_INPUT}    timeout=10s

Choose USDC To Receive
    [Documentation]    Picks the pair explicitly: the form seeds USDC as the receive asset but shows
    ...                "Select" for it on a wallet that does not hold USDC.
    ${already}=    Run Keyword And Return Status    Page Should Contain Element    ${RECEIVE_BALANCE_IS_USDC}
    IF    ${already}    RETURN
    Open Receive Asset Picker
    Search Assets    ${USDC_ASSET_ID}
    Wait For USDC Receive Row
    Tap    ${USDC_RECEIVE_ROW}
    Wait Until Page Does Not Contain Element    ${ASSET_SEARCH_INPUT}    timeout=15s
    Wait Until Page Contains Element    ${RECEIVE_BALANCE_IS_USDC}    timeout=15s

Open Configuration
    Tap    ${SWAP_CONFIGURE_BUTTON}
    Wait Until Settled    ${CONFIG_APPLY}

Apply Configuration
    # Hiding the keyboard drops the sheet back down; a tap while it moves misses. The no-balance
    # toast an earlier step raised slides over the sheet's header and takes the tap.
    Wait Until Settled    ${CONFIG_APPLY}
    Wait Until Page Does Not Contain Element    ${NOTHING_TO_SWAP_TOAST}    timeout=10s
    Tap    ${CONFIG_APPLY}
    Wait Until Page Does Not Contain Element    ${CONFIG_APPLY}    timeout=10s

Reveal Local Currency Toggle
    [Documentation]    The toggle sits below the presets and can start under the fold.
    FOR    ${i}    IN RANGE    5
        ${seen}=    Run Keyword And Return Status    Page Should Contain Element    ${CONFIG_LOCAL_CURRENCY_TOGGLE}
        IF    ${seen}    RETURN
        Swipe By Percent    50    70    50    40
    END
    Wait Until Page Contains Element    ${CONFIG_LOCAL_CURRENCY_TOGGLE}    timeout=5s

Set Local Currency
    [Arguments]    ${on}
    Open Configuration
    Reveal Local Currency Toggle
    ${current}=    Switch Is On    ${CONFIG_LOCAL_CURRENCY_TOGGLE}
    IF    $current != $on    Tap    ${CONFIG_LOCAL_CURRENCY_TOGGLE}
    Apply Configuration

Local Currency Should Be
    [Arguments]    ${on}
    Open Configuration
    Reveal Local Currency Toggle
    ${current}=    Switch Is On    ${CONFIG_LOCAL_CURRENCY_TOGGLE}
    Should Be Equal    ${current}    ${on}    Use local currency did not keep the applied value.
    Close Sheet
    Wait Until Page Does Not Contain Element    ${CONFIG_APPLY}    timeout=10s

Open Provider Sheet
    Tap    ${SWAP_PROVIDER_ROW}
    Wait Until Settled    ${PROVIDER_APPLY}

Other Provider Or Skip
    ${offered}=    Run Keyword And Return Status    Page Should Contain Element    ${PROVIDER_OPTION_OTHER}
    Skip If    not ${offered}    Only Auto was offered for this quote; there is no provider to pick.

Close Provider Sheet
    Close Sheet
    Wait Until Page Does Not Contain Element    ${PROVIDER_APPLY}    timeout=10s

Restore Auto Provider
    Open Provider Sheet
    Tap    ${PROVIDER_OPTION_AUTO}
    Tap    ${PROVIDER_APPLY}
    Wait Until Page Contains Element    ${PROVIDER_TITLE_AUTO}    timeout=15s

Open Swap History
    # The strip renders last in the form, below the fold on a small screen.
    ${has_history}=    Run Keyword And Return Status
    ...    Wait Until Keyword Succeeds    20s    1s    Scroll Until Present    ${HISTORY_SEE_ALL}
    Skip If    not ${has_history}    This account has no swap history, so See all is not offered.
    Scroll Until Tappable    ${HISTORY_SEE_ALL}
    Tap    ${HISTORY_SEE_ALL}
    Wait Until Page Contains Element    ${HISTORY_LIST}    timeout=15s

Open Confirmation
    [Arguments]    ${amount}=${FUNDED_PAY_AMOUNT}
    Choose USDC To Receive
    Enter Amount And Wait For Quote    ${amount}
    Expect Element    ${SWAP_BUTTON}    enabled    timeout=30s
    Tap    ${SWAP_BUTTON}
    Wait Until Settled    ${CONFIRM_SLIDE}

Chain Filter Should Be Absent
    [Documentation]    With an asset picker open, passes when it offers no chain filter and skips when the wallet swaps on several networks.
    [Arguments]    ${filter}
    ${shown}=    Run Keyword And Return Status    Page Should Contain Element    ${filter}
    Skip If    ${shown}    This wallet can swap on several networks, so the filter is offered; the case listing its chips covers it.

Chain Filter Should List All And Each Network
    [Documentation]    With an asset picker open, its chain filter must offer All plus at least two networks.
    [Arguments]    ${filter}
    ${shown}=    Run Keyword And Return Status    Wait Until Page Contains Element    ${filter}    timeout=10s
    Skip If    not ${shown}    This build or wallet swaps on one network only, so there is no chain filter to check.
    ${id}=    Bare Test Id    ${filter}
    Page Should Contain Element    tid=${id}_all
    ${chips}=    Rows With Prefix    ${id}_
    ${found}=    Get Webelements    ${chips}
    ${count}=    Get Length    ${found}
    Should Be True    ${count} > 2
    ...    The chain filter offers ${count} chip(s); All plus two networks is the least it may show.

Open Swap With Pair History
    [Documentation]    Opens Swap on the funded wallet and skips unless its swap history strip offers a pair.
    Open Swap With Funded Account
    ${chips}=    Rows With Prefix    ${PAIR_CHIP_PREFIX}
    ${shown}=    Run Keyword And Return Status
    ...    Wait Until Keyword Succeeds    20s    1s    Scroll Until Present    ${chips}
    Skip If    not ${shown}    This wallet has no swap history, so the pair strip is not offered.

Open Cross Chain Confirmation
    [Documentation]    Picks a receive asset on another network for the funded wallet and opens the confirmation of its quote.
    Open Swap With Funded Account
    Open Receive Asset Picker
    ${multichain}=    Run Keyword And Return Status    Wait Until Page Contains Element    ${RECEIVE_CHAIN_FILTER}    timeout=10s
    Skip If    not ${multichain}    This build or wallet offers no other network to receive on.
    Tap    ${OTHER_CHAIN_RECEIVE_CHIP}
    Receive Rows Or Skip
    Tap    ${RECEIVE_ASSET_ROW_ANY}
    Wait Until Page Does Not Contain Element    ${ASSET_SEARCH_INPUT}    timeout=15s
    Enter Amount And Wait For Quote    ${FUNDED_PAY_AMOUNT}
    Expect Element    ${SWAP_BUTTON}    enabled    timeout=30s
    Tap    ${SWAP_BUTTON}
    Wait Until Settled    ${CONFIRM_SLIDE}

Flip Back From USDC
    Tap    ${SWAP_FLIP_BUTTON}
    Wait Until Page Does Not Contain Element    ${PAY_IS_USDC}    timeout=5s
