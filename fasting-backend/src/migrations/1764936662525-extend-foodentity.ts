import { MigrationInterface, QueryRunner } from "typeorm";

export class ExtendFoodentity1764936662525 implements MigrationInterface {
    name = 'ExtendFoodentity1764936662525'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "food_entries" ADD "isPostFast" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "food_entries" ADD "recipeId" uuid`);
        await queryRunner.query(`ALTER TABLE "food_entries" ADD CONSTRAINT "FK_7505f3b0c7e40eebb5b2aaf8eae" FOREIGN KEY ("recipeId") REFERENCES "recipes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "food_entries" DROP CONSTRAINT "FK_7505f3b0c7e40eebb5b2aaf8eae"`);
        await queryRunner.query(`ALTER TABLE "food_entries" DROP COLUMN "recipeId"`);
        await queryRunner.query(`ALTER TABLE "food_entries" DROP COLUMN "isPostFast"`);
    }

}
