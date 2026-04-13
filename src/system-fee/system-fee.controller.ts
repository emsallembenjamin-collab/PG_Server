import { Body, Controller, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { SystemFeeService } from "./system-fee.service";
import { UpdateSystemFeeDto } from "./dto/update-system-fee.dto";

@ApiTags("Admin - System Fee")
@Controller("admin/system-fee")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SystemFeeController {
  constructor(private readonly systemFeeService: SystemFeeService) {}

  @Get()
  @ApiOperation({ summary: "Get platform transaction fee settings" })
  async getSettings() {
    return this.systemFeeService.getSettings();
  }

  @Patch()
  @ApiOperation({ summary: "Update platform transaction fee settings" })
  async updateSettings(@Body() dto: UpdateSystemFeeDto) {
    return this.systemFeeService.updateSettings(dto);
  }
}
