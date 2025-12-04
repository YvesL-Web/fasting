import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRecipe1764847494801 implements MigrationInterface {
    name = 'AddRecipe1764847494801'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "recipes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(255) NOT NULL, "description" text, "imageUrl" character varying(500), "imagePublicId" character varying(255), "isPublic" boolean NOT NULL DEFAULT false, "prepTimeMinutes" integer, "cookTimeMinutes" integer, "servings" integer, "totalCalories" integer, "proteinGrams" double precision, "carbsGrams" double precision, "fatGrams" double precision, "tags" text, "ingredients" jsonb, "steps" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "authorId" uuid, CONSTRAINT "PK_8f09680a51bf3669c1598a21682" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "recipes" ADD CONSTRAINT "FK_afd4f74f8df44df574253a7f37b" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "recipes" DROP CONSTRAINT "FK_afd4f74f8df44df574253a7f37b"`);
        await queryRunner.query(`DROP TABLE "recipes"`);
    }

}
