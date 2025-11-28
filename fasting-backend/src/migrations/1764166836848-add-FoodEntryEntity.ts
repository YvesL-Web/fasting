import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFoodEntryEntity1764166836848 implements MigrationInterface {
    name = 'AddFoodEntryEntity1764166836848'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "food_entries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "loggedAt" TIMESTAMP NOT NULL, "label" character varying(255) NOT NULL, "calories" integer, "proteinGrams" double precision, "carbsGrams" double precision, "fatGrams" double precision, "inEatingWindow" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, "fastId" uuid, CONSTRAINT "PK_9ff4018d66bc4142ac2222a3ad0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "food_entries" ADD CONSTRAINT "FK_20df2413919b31bced5d0eb5264" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "food_entries" ADD CONSTRAINT "FK_b640c48e451fcf892f376b3c622" FOREIGN KEY ("fastId") REFERENCES "fasts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "food_entries" DROP CONSTRAINT "FK_b640c48e451fcf892f376b3c622"`);
        await queryRunner.query(`ALTER TABLE "food_entries" DROP CONSTRAINT "FK_20df2413919b31bced5d0eb5264"`);
        await queryRunner.query(`DROP TABLE "food_entries"`);
    }

}
