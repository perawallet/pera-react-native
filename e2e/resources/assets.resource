*** Settings ***
Documentation       Account assets: add-asset search and opt-in sheet, the manage sheet (sort, filter,
...                 remove), and on the funded testnet account asset detail plus real opt-in/out.
Resource            send_receive.resource


*** Variables ***
${ADD_ASSET_BUTTON}             accessibility_id=add_asset_button
${ASSET_SEARCH_INPUT}           accessibility_id=searchable-list-search-input
# USDC by asset id: the result list can show other assets above the match.
${USDC_MAINNET_ROW}             accessibility_id=asset_row_31566704
${USDC_TESTNET_ROW}             accessibility_id=asset_row_10458941
${ALGO_ROW}                     accessibility_id=asset_row_0
${OPT_IN_CONFIRM}               accessibility_id=opt_in_confirm
${OPT_IN_FEE}                   accessibility_id=opt_in_fee
${OPT_OUT_CONFIRM}              accessibility_id=opt_out_confirm

${MANAGE_ASSETS_BUTTON}         accessibility_id=manage_assets_button
${MANAGE_SORT}                  accessibility_id=manage_assets_sort
${MANAGE_FILTER}                accessibility_id=manage_assets_filter
${MANAGE_REMOVE}                accessibility_id=manage_assets_remove
${SORT_DEFAULT}                 accessibility_id=asset_sort_option_balanceDesc
${SORT_ALPHABETICAL}            accessibility_id=asset_sort_option_alphabeticalAsc
${SORT_APPLY}                   accessibility_id=asset_sort_apply_button
${FILTER_HIDE_ZERO}             accessibility_id=asset_filter_hide_zero_balance
${FILTER_DISPLAY_NFTS}          accessibility_id=asset_filter_display_nfts
${FILTER_APPLY}                 accessibility_id=asset_filter_apply_button
${REMOVE_SELECT_ALL}            accessibility_id=remove_assets_select_all_button

${DETAIL_SEND}                  accessibility_id=asset_detail_send_button
${DETAIL_RECEIVE}               accessibility_id=asset_detail_receive_button
${DETAIL_SWAP}                  accessibility_id=asset_detail_swap_button
${NFTS_TAB}                     accessibility_id=tab_nfts
${FIRST_COLLECTIBLE}            xpath=(//*[starts-with(@content-desc,'collectible_row_') or starts-with(@name,'collectible_row_')])[1]
# Screen containers carry a bare testID (no accessibility label), which Android exposes as
# resource-id only; iOS exposes it as name.
${ASSET_DETAILS_SCREEN}         xpath=//*[@resource-id='asset_details_screen' or @name='asset_details_screen']
${REMOVE_ASSETS_SCREEN}         xpath=//*[@resource-id='remove_assets_screen' or @name='remove_assets_screen']
${COLLECTIBLE_DETAIL_SCREEN}    xpath=//*[@resource-id='collectible_detail_screen' or @name='collectible_detail_screen']


*** Keywords ***
Search Assets For USDC
    [Arguments]    ${result}
    Wait Until Page Contains Element    ${ADD_ASSET_BUTTON}    timeout=30s
    Tap    ${ADD_ASSET_BUTTON}
    Wait Until Page Contains Element    ${ASSET_SEARCH_INPUT}    timeout=15s
    Input Text    ${ASSET_SEARCH_INPUT}    USDC
    # Remote lookup; allow for a slow backend rather than retyping.
    Wait Until Page Contains Element    ${result}    timeout=30s

Open Opt In Sheet
    [Arguments]    ${result}
    Search Assets For USDC    ${result}
    Dismiss Keyboard
    # The row sits under the search sheet's layer and a tap there can be dropped; repeat while the
    # confirmation has not appeared.
    FOR    ${i}    IN RANGE    3
        Tap    ${result}
        ${open}=    Run Keyword And Return Status
        ...    Wait Until Page Contains Element    ${OPT_IN_CONFIRM}    timeout=5s
        IF    ${open}    BREAK
    END
    Wait Until Settled    ${OPT_IN_CONFIRM}

Open Manage Sheet
    Wait Until Page Contains Element    ${MANAGE_ASSETS_BUTTON}    timeout=30s
    Tap    ${MANAGE_ASSETS_BUTTON}
    Wait Until Settled    ${MANAGE_SORT}

Open Sort Sheet
    Open Manage Sheet
    Tap    ${MANAGE_SORT}
    Wait Until Settled    ${SORT_APPLY}

Apply Sort
    [Arguments]    ${option}
    Open Sort Sheet
    Tap    ${option}
    Tap    ${SORT_APPLY}
    Wait Until Page Does Not Contain Element    ${SORT_APPLY}    timeout=10s

Open Filter Sheet
    Open Manage Sheet
    Tap    ${MANAGE_FILTER}
    Wait Until Settled    ${FILTER_APPLY}

Toggle Display NFTs
    Open Filter Sheet
    Tap    ${FILTER_DISPLAY_NFTS}
    Tap    ${FILTER_APPLY}
    Wait Until Page Does Not Contain Element    ${FILTER_APPLY}    timeout=10s

Open Remove Assets
    Open Manage Sheet
    Tap    ${MANAGE_REMOVE}
    Wait Until Page Contains Element    ${REMOVE_ASSETS_SCREEN}    timeout=15s

Open ALGO Detail
    Wait Until Page Contains Element    ${ALGO_ROW}    timeout=30s
    Tap    ${ALGO_ROW}
    Wait Until Page Contains Element    ${ASSET_DETAILS_SCREEN}    timeout=20s

Opt In To Testnet USDC
    Open Opt In Sheet    ${USDC_TESTNET_ROW}
    Slide To Confirm    ${OPT_IN_CONFIRM}
    Wait Until Page Does Not Contain Element    ${OPT_IN_CONFIRM}    timeout=90s
    Go Home
    Wait Until Page Contains Element    ${USDC_TESTNET_ROW}    timeout=60s

Opt Out Of Testnet USDC
    [Documentation]    Swiping a held row left asks to opt out; only a zero balance can opt out.
    Wait Until Page Contains Element    ${USDC_TESTNET_ROW}    timeout=30s
    ${loc}=    Get Element Location    ${USDC_TESTNET_ROW}
    ${size}=    Get Element Size    ${USDC_TESTNET_ROW}
    ${y}=    Evaluate    int($loc['y'] + $size['height'] / 2)
    ${x1}=    Evaluate    int($loc['x'] + $size['width'] * 0.9)
    ${x2}=    Evaluate    int($loc['x'] + $size['width'] * 0.1)
    Swipe    start_x=${x1}    start_y=${y}    end_x=${x2}    end_y=${y}    duration=800ms
    Slide To Confirm    ${OPT_OUT_CONFIRM}
    Wait Until Page Does Not Contain Element    ${OPT_OUT_CONFIRM}    timeout=90s
    Wait Until Page Does Not Contain Element    ${USDC_TESTNET_ROW}    timeout=60s

Holds Testnet USDC
    ${held}=    Run Keyword And Return Status
    ...    Wait Until Page Contains Element    ${ALGO_ROW}    timeout=30s
    Should Be True    ${held}    The funded account overview did not load.
    ${usdc}=    Run Keyword And Return Status    Page Should Contain Element    ${USDC_TESTNET_ROW}
    RETURN    ${usdc}
