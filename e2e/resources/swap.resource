*** Settings ***
Resource            onboarding.resource
Resource            discover.resource


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
# The amount follows the label after an asset glyph ("¦" on Android, "Algo" on iOS).
${SWAP_BALANCE_VALUE}               xpath=(//*[@text='Balance: ' or @label='Balance: ']/following-sibling::*/descendant-or-self::*[contains(translate(@text,'0123456789','##########'),'#') or contains(translate(@label,'0123456789','##########'),'#')])[1]
${SWAP_SELECT_ASSET_LABEL}          xpath=//*[@text='Select' or @label='Select']
# iOS labels the toast with its title and body together, and keeps a hidden one in the tree.
${NOTHING_TO_SWAP_TOAST}            xpath=//*[(starts-with(@text,'Nothing to swap') or starts-with(@label,'Nothing to swap')) and not(@visible='false')]

${ASSET_SEARCH_INPUT}               tid=searchable-list-search-input
${PAY_ASSET_ROW_ANY}                xpath=//*[starts-with(@content-desc,'asset-list-item-') or starts-with(@resource-id,'asset-list-item-') or starts-with(@name,'asset-list-item-')]
${PAY_ASSET_ROW_PREFIX}             asset-list-item-
${RECEIVE_ASSET_ROW_ANY}            xpath=//*[starts-with(@content-desc,'swap-asset-item-') or starts-with(@resource-id,'swap-asset-item-') or starts-with(@name,'swap-asset-item-')]
${NO_MATCHING_ASSETS}               xpath=//*[@text='No Matching Assets' or @label='No Matching Assets']
${NO_MATCH_SEARCH}                  ZZQXNOMATCH9999
# Mainnet USDC: verified and pooled against ALGO, so a stable probe for the receive list.
${USDC_ASSET_ID}                    31566704
${USDC_RECEIVE_ROW}                 tid=swap-asset-item-31566704
# Only the receive side's balance carries the receive asset's unit; "ALGO to USDC" in Top Swaps
# would match a bare USDC text anywhere.
${RECEIVE_IS_USDC}                  xpath=//*[@text='Balance: ' or @label='Balance: ']/following-sibling::*[contains(@text,'USDC') or contains(@label,'USDC')]

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

${TOP_PAIRS}                        tid=swap-top-pairs
${TOP_PAIRS_TITLE}                  xpath=//*[@text='Top 5 Swaps' or @label='Top 5 Swaps']
# The trailing hyphen keeps the swap-top-pairs-skeleton-N placeholders out.
${TOP_PAIR_FIRST}                   xpath=(//*[starts-with(@content-desc, 'swap-top-pair-') or starts-with(@resource-id, 'swap-top-pair-') or starts-with(@name,'swap-top-pair-')])[1]
${HISTORY_WIDGET}                   tid=swap-pair-history-widget
${HISTORY_SEE_ALL}                  tid=swap-pair-history-see-all
${HISTORY_LIST}                     tid=swap-history-list
${HISTORY_EMPTY}                    xpath=//*[@text='No swaps yet' or @label='No swaps yet']
${HISTORY_ROW_FIRST}                xpath=(//*[starts-with(@content-desc, 'swap-history-item-') or starts-with(@resource-id, 'swap-history-item-') or starts-with(@name,'swap-history-item-')])[1]

${CONFIRM_SLIDE}                    tid=swap-confirm-slide
${CONFIRM_WARNING}                  tid=swap-confirm-warning
${CONFIRM_CLOSE}                    tid=swap-confirm-close
${CONFIRM_TITLE}                    xpath=//*[@text='Confirm Swap' or @label='Confirm Swap']
@{CONFIRM_LABELS}                   Rate    Minimum Received    Pera Fee    Price Impact    Slippage Tolerance
@{CONFIRM_VALUE_IDS}                swap-confirm-rate    swap-confirm-provider    swap-confirm-slippage
...                                 swap-confirm-price-impact    swap-confirm-min-received    swap-confirm-pera-fee

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

Top Pair Row With Volume
    [Documentation]    Joined text of the first top pair row once it shows a volume, which renders
    ...                after the pair label, when the currency rates have loaded.
    ${text}=    Text Inside    ${TOP_PAIR_FIRST.replace('xpath=', '')}
    ${volume}=    Extract Number    ${text}
    Should Not Be Equal    ${volume}    ${None}    The top pair row shows no volume: "${text}".
    RETURN    ${text}

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

Switch Is On
    [Documentation]    Android reports a switch through `checked`, iOS through `value`.
    [Arguments]    ${locator}
    ${ok}    ${checked}=    Run Keyword And Ignore Error    Get Element Attribute    ${locator}    checked
    IF    '${ok}' == 'PASS' and $checked is not None
        RETURN    ${{ str($checked).lower() == 'true' }}
    END
    ${value}=    Get Element Attribute    ${locator}    value
    RETURN    ${{ str($value).lower() in ('1', 'true') }}

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
    ${already}=    Run Keyword And Return Status    Page Should Contain Element    ${RECEIVE_IS_USDC}
    IF    ${already}    RETURN
    Open Receive Asset Picker
    Search Assets    ${USDC_ASSET_ID}
    Wait For USDC Receive Row
    Tap    ${USDC_RECEIVE_ROW}
    Wait Until Page Does Not Contain Element    ${ASSET_SEARCH_INPUT}    timeout=15s
    Wait Until Page Contains Element    ${RECEIVE_IS_USDC}    timeout=15s

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
    ${has_history}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${HISTORY_SEE_ALL}    timeout=15s
    Skip If    not ${has_history}    This account has no swap history, so See all is not offered.
    Tap    ${HISTORY_SEE_ALL}
    Wait Until Page Contains Element    ${HISTORY_LIST}    timeout=15s

Open Confirmation
    [Arguments]    ${amount}=${FUNDED_PAY_AMOUNT}
    Choose USDC To Receive
    Enter Amount And Wait For Quote    ${amount}
    Expect Element    ${SWAP_BUTTON}    enabled    timeout=30s
    Tap    ${SWAP_BUTTON}
    Wait Until Settled    ${CONFIRM_SLIDE}

Slide To Confirm
    [Documentation]    The slider is a gesture-handler pan, so a tap does nothing. One drag only: a
    ...                retry could submit a second real swap.
    ${loc}=    Get Element Location    ${CONFIRM_SLIDE}
    ${size}=    Get Element Size    ${CONFIRM_SLIDE}
    ${y}=    Evaluate    int($loc['y'] + $size['height'] / 2)
    ${x1}=    Evaluate    int($loc['x'] + $size['width'] * 0.1)
    ${x2}=    Evaluate    int($loc['x'] + $size['width'] * 0.95)
    Swipe    start_x=${x1}    start_y=${y}    end_x=${x2}    end_y=${y}    duration=1500ms
