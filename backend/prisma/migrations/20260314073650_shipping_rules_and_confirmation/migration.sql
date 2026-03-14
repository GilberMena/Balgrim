-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'ADDI';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "guestDepartment" TEXT;

-- AlterTable
ALTER TABLE "StoreSettings" ADD COLUMN     "shippingRules" JSONB;
