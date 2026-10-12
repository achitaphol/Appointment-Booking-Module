-- CreateTable
CREATE TABLE "roles" (
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(100) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "user_account_roles" (
    "user_account_id" UUID NOT NULL,
    "role_code" VARCHAR(32) NOT NULL,

    CONSTRAINT "user_account_roles_pkey" PRIMARY KEY ("user_account_id","role_code")
);

-- CreateIndex
CREATE INDEX "user_account_roles_role_code_idx" ON "user_account_roles"("role_code");

-- AddForeignKey
ALTER TABLE "user_account_roles" ADD CONSTRAINT "user_account_roles_user_account_id_fkey" FOREIGN KEY ("user_account_id") REFERENCES "user_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_account_roles" ADD CONSTRAINT "user_account_roles_role_code_fkey" FOREIGN KEY ("role_code") REFERENCES "roles"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- These role codes have deliberately fixed meanings in the API policy.
INSERT INTO "roles" ("code", "name") VALUES
    ('administrator', 'Administrator'),
    ('scheduler', 'Scheduler'),
    ('schedule_manager', 'Schedule Manager'),
    ('clinician', 'Clinician'),
    ('clinical_delegate', 'Clinical Delegate');
