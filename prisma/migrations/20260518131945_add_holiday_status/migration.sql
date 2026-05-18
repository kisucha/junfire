-- AlterTable
ALTER TABLE `workrecord` MODIFY `status` ENUM('WORK', 'SICK', 'ANNUAL', 'UNPAID', 'HOLIDAY') NOT NULL;
