import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFoodItemInFoodentry1765877931172 implements MigrationInterface {
    name = 'AddFoodItemInFoodentry1765877931172'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "food_entries" ADD "foodItemId" uuid`);
        await queryRunner.query(`ALTER TABLE "food_entries" ADD CONSTRAINT "FK_9a620e049a09cd0eee4ccb66a56" FOREIGN KEY ("foodItemId") REFERENCES "food_items"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "food_entries" DROP CONSTRAINT "FK_9a620e049a09cd0eee4ccb66a56"`);
        await queryRunner.query(`ALTER TABLE "food_entries" DROP COLUMN "foodItemId"`);
    }

}
