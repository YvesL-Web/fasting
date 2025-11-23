import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAvatarpublicid1763910214855 implements MigrationInterface {
    name = 'AddAvatarpublicid1763910214855'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "avatarPublicId" character varying(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatarPublicId"`);
    }

}
