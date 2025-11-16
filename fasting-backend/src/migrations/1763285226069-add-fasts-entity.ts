import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFastsEntity1763285226069 implements MigrationInterface {
    name = 'AddFastsEntity1763285226069'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "fasts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "type" character varying(10) NOT NULL, "startAt" TIMESTAMP NOT NULL, "endAt" TIMESTAMP, "notes" character varying(500), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "PK_79487fedd16a578f725d4e6725e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_a1966302ad75681388b768e6e7" ON "fasts" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_5d4bc93ee11aa8e451fe835f08" ON "fasts" ("startAt") `);
        await queryRunner.query(`ALTER TABLE "fasts" ADD CONSTRAINT "FK_a1966302ad75681388b768e6e7c" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fasts" DROP CONSTRAINT "FK_a1966302ad75681388b768e6e7c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5d4bc93ee11aa8e451fe835f08"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_a1966302ad75681388b768e6e7"`);
        await queryRunner.query(`DROP TABLE "fasts"`);
    }

}
