import { Module } from '@nestjs/common';
import { SandboxGatewayService } from './sandbox-gateway.service.js';
import { SandboxGatewayController } from './sandbox-gateway.controller.js';

@Module({
  controllers: [SandboxGatewayController],
  providers: [SandboxGatewayService],
  exports: [SandboxGatewayService],
})
export class SandboxGatewayModule {}
