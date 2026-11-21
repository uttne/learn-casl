-- CreateEnum
CREATE TYPE "OrganizationPlan" AS ENUM ('starter', 'business', 'enterprise');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "plan" "OrganizationPlan" NOT NULL DEFAULT 'starter';
