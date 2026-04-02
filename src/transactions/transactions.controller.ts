import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiSecurity } from "@nestjs/swagger";
import { TransactionsService } from "./transactions.service";
import { CreateTransactionDto } from "./dto/create-transaction.dto";
import { TransactionStatus } from "./entities/transaction.entity";
import { ApiKeyGuard } from "../common/guards/api-key.guard";
import { ApiKey } from "../common/decorators/api-key.decorator";
import { MERCHANT_INTEGRATION_TAG } from "../docs/swagger-merchant.filter";

@ApiTags(MERCHANT_INTEGRATION_TAG, "Transactions")
@Controller("transactions")
@UseGuards(ApiKeyGuard)
@ApiSecurity("api-key")
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  @ApiKey()
  @ApiOperation({
    summary: "Create a new transaction (deposit or withdrawal)",
    description:
      "Uses the merchant's assigned provider. Prefer POST /funding/deposits or /funding/withdrawals for clearer integration. On success, `payment` contains provider instructions (QR, bank info, URL) when available.",
  })
  async create(
    @Request() req,
    @Body() createTransactionDto: CreateTransactionDto,
  ) {
    return this.transactionsService.create(
      req.merchant.id,
      createTransactionDto,
    );
  }

  @Get()
  @ApiKey()
  @ApiOperation({ summary: "Get merchant transactions" })
  async findByMerchant(
    @Request() req,
    @Query("page") page: number = 1,
    @Query("limit") limit: number = 20,
    @Query("status") status?: string,
    @Query("type") type?: "deposit" | "withdrawal",
    @Query("sandbox") sandbox?: string,
  ) {
    return this.transactionsService.findByMerchant(
      req.merchant.id,
      +page,
      +limit,
      {
        status:
          status === "pending" ||
          status === "processing" ||
          status === "succeeded" ||
          status === "failed" ||
          status === "reversed"
            ? (status as TransactionStatus)
            : undefined,
        type:
          type === "deposit" || type === "withdrawal" ? type : undefined,
        sandbox:
          sandbox === "true"
            ? true
            : sandbox === "false"
              ? false
              : undefined,
      },
    );
  }

  @Get(":id")
  @ApiKey()
  @ApiOperation({ summary: "Get transaction by ID" })
  async findOne(@Request() req, @Param("id") id: string) {
    return this.transactionsService.findOneForMerchant(+id, req.merchant.id);
  }
}
