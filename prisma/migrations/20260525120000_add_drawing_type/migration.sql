-- AlterTable: Drawing에 type 컬럼 추가
-- 기존 데이터는 기본값 '1st' 적용
ALTER TABLE `Drawing` ADD COLUMN `type` VARCHAR(191) NOT NULL DEFAULT '1st';
