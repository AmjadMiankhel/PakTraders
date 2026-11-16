import { Module } from "@nestjs/common";
import { TendersModule } from "../tenders/tenders.module";
import { AdminController } from "./admin.controller";
import { AdminTendersController } from "./admin-tenders.controller";
import { AdminService } from "./admin.service";

@Module({
  imports: [TendersModule],
  controllers: [AdminController, AdminTendersController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
