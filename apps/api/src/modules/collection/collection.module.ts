import { Module } from "@nestjs/common";
import { CollectionAdminController } from "./collection-admin.controller";
import { CollectionAdminService } from "./collection-admin.service";
import { CollectionProcessorService } from "./collection-processor.service";
import { CollectionQueueService } from "./collection-queue.service";
import { CollectionSchedulerService } from "./collection-scheduler.service";
import { DedupeService } from "./dedupe.service";
import { AiClassifierService } from "./extraction/ai-classifier.service";
import { DocumentExtractorService } from "./extraction/document-extractor.service";
import { OcrService } from "./extraction/ocr.service";
import { NormalizationService } from "./normalization.service";

@Module({
  controllers: [CollectionAdminController],
  providers: [
    CollectionProcessorService,
    CollectionSchedulerService,
    CollectionQueueService,
    CollectionAdminService,
    NormalizationService,
    DedupeService,
    DocumentExtractorService,
    OcrService,
    AiClassifierService,
  ],
  exports: [CollectionProcessorService, CollectionQueueService, CollectionSchedulerService],
})
export class CollectionModule {}
