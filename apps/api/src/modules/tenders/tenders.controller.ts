import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { tenderSearchSchema, type TenderSearchInput } from "@paktenders/validation";
import { Public, CurrentUser, type AuthUser } from "../../common/decorators/auth.decorators";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { TendersService } from "./tenders.service";

@ApiTags("tenders")
@Public()
@Controller("tenders")
export class TendersController {
  constructor(private readonly tenders: TendersService) {}

  @Get()
  @ApiOperation({ summary: "Search published tenders with filters and pagination" })
  list(@Query(new ZodValidationPipe(tenderSearchSchema)) query: TenderSearchInput) {
    return this.tenders.list(query);
  }

  @Get(":slug")
  @ApiOperation({ summary: "Fetch one tender by its public slug" })
  detail(@Param("slug") slug: string, @CurrentUser() user?: AuthUser) {
    return this.tenders.bySlug(slug, user?.id);
  }

  @Get(":slug/similar")
  @ApiOperation({ summary: "Related tenders in the same category or province" })
  similar(@Param("slug") slug: string, @Query("limit") limit?: string) {
    const parsed = limit ? Number(limit) : 4;
    return this.tenders.similar(slug, Number.isFinite(parsed) ? parsed : 4);
  }
}
