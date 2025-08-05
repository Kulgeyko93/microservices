import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { UserService } from './user-service.service';

@Controller()
export class UserServiceController {
  constructor(private readonly userService: UserService) {}

  @MessagePattern({ cmd: 'get-user' })
  async getUser(@Payload() data: { id: string }) {
    return this.userService.getUser(data.id);
  }

  @MessagePattern({ cmd: 'create-user' })
  async createUser(@Payload() data: any) {
    return this.userService.createUser(data);
  }

  @MessagePattern({ cmd: 'update-user' })
  async updateUser(@Payload() data: { id: string; userData: any }) {
    return this.userService.updateUser(data.id, data.userData);
  }

  @MessagePattern({ cmd: 'delete-user' })
  async deleteUser(@Payload() data: { id: string }) {
    return this.userService.deleteUser(data.id);
  }
}