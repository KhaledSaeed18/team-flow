import { Module } from '@nestjs/common';
import { LabelsService } from './labels.service';
import {
    OrgLabelsController,
    ProjectLabelsController,
    LabelsController,
    TaskLabelsController,
} from './labels.controller';

@Module({
    controllers: [
        OrgLabelsController,
        ProjectLabelsController,
        LabelsController,
        TaskLabelsController,
    ],
    providers: [LabelsService],
    exports: [LabelsService],
})
export class LabelsModule {}
