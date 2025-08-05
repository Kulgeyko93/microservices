import { Controller, Get, Post, Body, Param, Inject } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiGatewayService } from './api-gateway.service';

@Controller()
export class ApiGatewayController {
  constructor(
    private readonly apiGatewayService: ApiGatewayService,
    @Inject('AUTH_SERVICE') private readonly authClient: ClientProxy,
    @Inject('USER_SERVICE') private readonly userClient: ClientProxy,
  ) {}

  @Get()
  getHello() {
    return this.apiGatewayService.getHello();
  }

  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      service: 'api-gateway',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('auth/login')
  async login(@Body() loginDto: any) {
    return this.authClient.send({ cmd: 'login' }, loginDto);
  }

  @Post('auth/register')
  async register(@Body() registerDto: any) {
    return this.authClient.send({ cmd: 'register' }, registerDto);
  }

  @Get('users/:id')
  async getUser(@Param('id') id: string) {
    return this.userClient.send({ cmd: 'get-user' }, { id });
  }
}