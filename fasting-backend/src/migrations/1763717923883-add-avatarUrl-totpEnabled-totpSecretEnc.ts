import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAvatarUrlTotpEnabledTotpSecretEnc1763717923883 implements MigrationInterface {
    name = 'AddAvatarUrlTotpEnabledTotpSecretEnc1763717923883'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "avatarUrl" character varying(512)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totpEnabled" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "users" ADD "totpSecretEnc" text`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totpSecretEnc"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totpEnabled"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarUrl"`);
    }

}
