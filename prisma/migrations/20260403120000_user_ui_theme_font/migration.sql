-- CreateEnum
CREATE TYPE "UiTheme" AS ENUM ('LIGHT', 'DARK');

-- CreateEnum
CREATE TYPE "UiFontScale" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'XL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "uiTheme" "UiTheme" NOT NULL DEFAULT 'DARK';
ALTER TABLE "users" ADD COLUMN "uiFontScale" "UiFontScale" NOT NULL DEFAULT 'MEDIUM';
