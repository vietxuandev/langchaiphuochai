ALTER TABLE "posts" ADD COLUMN "facebookPostedAt" TIMESTAMP(3);

-- Bài đã có facebookPostId coi như đã đăng.
UPDATE "posts" SET "facebookPostedAt" = NOW() WHERE "facebookPostId" IS NOT NULL;

CREATE TABLE "facebook_queue_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "postTimes" TEXT NOT NULL DEFAULT '08:00',
    "onlyNews" BOOLEAN NOT NULL DEFAULT true,
    "lastSlot" TEXT,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "facebook_queue_settings_pkey" PRIMARY KEY ("id")
);
