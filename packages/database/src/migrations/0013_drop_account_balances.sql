INSERT OR IGNORE INTO `account_chain_state` (`account_address`, `network`, `native_balance`, `chain_data`, `updated_at`)
SELECT `account_address`, `network`, `native_micro`,
	json_patch(
		json_object(
			'family', 'algorand',
			'minBalance', json_object('$decimal', `min_micro`),
			'status', CASE WHEN `status` IN ('Online', 'NotParticipating') THEN `status` ELSE 'Offline' END,
			'totalAssetsOptedIn', `total_assets_opted_in`,
			'totalCreatedAssets', `total_created_assets`,
			'totalAppsOptedIn', `total_apps_opted_in`
		),
		json_object('authAddress', `auth_address`)
	),
	`updated_at`
FROM (
	SELECT *,
		coalesce(nullif(ltrim(CASE WHEN instr(`algo_balance`, '.') = 0 THEN `algo_balance` || '000000' ELSE substr(`algo_balance`, 1, instr(`algo_balance`, '.') - 1) || substr(substr(`algo_balance`, instr(`algo_balance`, '.') + 1) || '000000', 1, 6) END, '0'), ''), '0') AS `native_micro`,
		coalesce(nullif(ltrim(CASE WHEN instr(`min_balance`, '.') = 0 THEN `min_balance` || '000000' ELSE substr(`min_balance`, 1, instr(`min_balance`, '.') - 1) || substr(substr(`min_balance`, instr(`min_balance`, '.') + 1) || '000000', 1, 6) END, '0'), ''), '0') AS `min_micro`
	FROM `account_balances`
	WHERE `network` LIKE 'algorand/%'
);
--> statement-breakpoint
DROP TABLE `account_balances`;
