-- CreateEnum
CREATE TYPE "WalletType" AS ENUM ('ADVERTISING_CREDIT');

-- CreateEnum
CREATE TYPE "TopUpStatus" AS ENUM ('PENDING_PAYMENT', 'PROCESSING', 'SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WalletTransactionType" AS ENUM ('TOP_UP');

-- CreateEnum
CREATE TYPE "WalletPaymentMethod" AS ENUM ('BANK_TRANSFER');

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "WalletType" NOT NULL,
    "balance_vnd" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "top_up_transactions" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_vnd" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" "TopUpStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "payment_method" "WalletPaymentMethod" NOT NULL,
    "reference_code" TEXT NOT NULL,
    "provider_transaction_id" TEXT,
    "failure_code" TEXT,
    "failure_message" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "top_up_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_ledger_entries" (
    "id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "top_up_id" UUID,
    "type" "WalletTransactionType" NOT NULL,
    "amount_vnd" INTEGER NOT NULL,
    "balance_before_vnd" INTEGER NOT NULL,
    "balance_after_vnd" INTEGER NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_type_key" ON "wallets"("user_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "top_up_transactions_reference_code_key" ON "top_up_transactions"("reference_code");

-- CreateIndex
CREATE UNIQUE INDEX "top_up_transactions_provider_transaction_id_key" ON "top_up_transactions"("provider_transaction_id");

-- CreateIndex
CREATE INDEX "top_up_transactions_user_id_created_at_idx" ON "top_up_transactions"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "top_up_transactions_wallet_id_status_idx" ON "top_up_transactions"("wallet_id", "status");

-- CreateIndex
CREATE INDEX "wallet_ledger_entries_wallet_id_created_at_idx" ON "wallet_ledger_entries"("wallet_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "wallet_ledger_entries_reference_type_reference_id_key" ON "wallet_ledger_entries"("reference_type", "reference_id");

-- RenameForeignKey
ALTER TABLE "technician_service_price_options" RENAME CONSTRAINT "technician_service_price_options_service_fkey" TO "technician_service_price_options_technician_service_id_fkey";

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "top_up_transactions" ADD CONSTRAINT "top_up_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "top_up_transactions" ADD CONSTRAINT "top_up_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_top_up_id_fkey" FOREIGN KEY ("top_up_id") REFERENCES "top_up_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "technician_profiles_is_active_is_available_average_rating_id_id" RENAME TO "technician_profiles_is_active_is_available_average_rating_i_idx";

-- RenameIndex
ALTER INDEX "technician_service_price_options_service_active_idx" RENAME TO "technician_service_price_options_technician_service_id_is_a_idx";

-- RenameIndex
ALTER INDEX "technician_service_price_options_service_code_key" RENAME TO "technician_service_price_options_technician_service_id_code_key";
