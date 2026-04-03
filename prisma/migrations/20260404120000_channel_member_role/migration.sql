-- Group chat: member vs admin (manage group, add/remove people).
CREATE TYPE "ChannelMemberRole" AS ENUM ('MEMBER', 'ADMIN');

ALTER TABLE "channel_members" ADD COLUMN "role" "ChannelMemberRole" NOT NULL DEFAULT 'MEMBER';

-- Creators of existing groups become admins.
UPDATE "channel_members" AS cm
SET "role" = 'ADMIN'
FROM "channels" AS c
WHERE cm."channelId" = c.id
  AND c.type = 'GROUP'
  AND c."createdById" IS NOT NULL
  AND cm."userId" = c."createdById";
