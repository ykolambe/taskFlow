-- Run once after adding per-user add-on columns (optional).
-- Grants existing users access matching company-level add-on flags so behavior matches pre-migration.
UPDATE users AS u
SET
  chat_addon_access = COALESCE(b.chat_addon_enabled, false),
  recurring_addon_access = COALESCE(b.recurring_addon_enabled, false),
  ai_addon_access = COALESCE(b.ai_addon_enabled, false)
FROM company_billing AS b
WHERE u.company_id = b.company_id;
