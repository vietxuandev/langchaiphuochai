CREATE TABLE "post_view_daily" (
    "postId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "post_view_daily_pkey" PRIMARY KEY ("postId", "day")
);
CREATE INDEX "post_view_daily_day_idx" ON "post_view_daily"("day");
ALTER TABLE "post_view_daily" ADD CONSTRAINT "post_view_daily_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
