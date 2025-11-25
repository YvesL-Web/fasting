import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTargetDurationHours1764070285554 implements MigrationInterface {
    name = 'AddTargetDurationHours1764070285554'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fasts" ADD "targetDurationHours" integer`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fasts" DROP COLUMN "targetDurationHours"`);
    }

}
