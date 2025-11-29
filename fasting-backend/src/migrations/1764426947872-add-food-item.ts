import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFoodItem1764426947872 implements MigrationInterface {
    name = 'AddFoodItem1764426947872'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "food_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "label" character varying(255) NOT NULL, "brand" character varying(255), "servingSize" character varying(50), "calories" integer, "proteinGrams" double precision, "carbsGrams" double precision, "fatGrams" double precision, "source" character varying(20) NOT NULL DEFAULT 'GLOBAL', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "ownerId" uuid, CONSTRAINT "PK_6b37e62b21c674c714a581c59a6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_50fd5308b62cc45ce24e33dc94" ON "food_items" ("label") `);
        await queryRunner.query(`ALTER TABLE "food_items" ADD CONSTRAINT "FK_b2fa1821a50291b13a38b56352c" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "food_items" DROP CONSTRAINT "FK_b2fa1821a50291b13a38b56352c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_50fd5308b62cc45ce24e33dc94"`);
        await queryRunner.query(`DROP TABLE "food_items"`);
    }

}
