-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('video', 'text', 'pdf');

-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "duration_seconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "type" "LessonType" NOT NULL DEFAULT 'text';
