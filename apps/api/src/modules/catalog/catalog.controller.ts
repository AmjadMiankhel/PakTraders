import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/auth.decorators";
import { CatalogService } from "./catalog.service";

@ApiTags("catalog")
@Public()
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  @ApiOperation({ summary: "All active tender categories with published tender counts" })
  categories() {
    return this.catalog.categories();
  }

  @Get("categories/:slug")
  @ApiOperation({ summary: "One category by slug" })
  category(@Param("slug") slug: string) {
    return this.catalog.categoryBySlug(slug);
  }

  @Get("locations/provinces")
  @ApiOperation({ summary: "Provinces with cities and published tender counts" })
  provinces() {
    return this.catalog.provinces();
  }

  @Get("departments")
  @ApiOperation({ summary: "Departments / organizations, optionally filtered by province" })
  departments(@Query("province") province?: string, @Query("limit") limit?: string) {
    const parsed = limit ? Number(limit) : undefined;
    return this.catalog.departments({
      province,
      limit: parsed && Number.isFinite(parsed) ? parsed : undefined,
    });
  }

  @Get("departments/:slug")
  @ApiOperation({ summary: "One department by slug" })
  department(@Param("slug") slug: string) {
    return this.catalog.departmentBySlug(slug);
  }

  @Get("settings/public")
  @ApiOperation({ summary: "Public site settings (never includes secrets)" })
  publicSettings() {
    return this.catalog.publicSettings();
  }

  @Get("sources")
  @ApiOperation({ summary: "Tender sources with attribution metadata" })
  sources() {
    return this.catalog.sources();
  }
}
