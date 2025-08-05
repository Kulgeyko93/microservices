import { Injectable } from '@nestjs/common';

@Injectable()
export class UserService {
  private users = [
    { id: '1', email: 'user@example.com', name: 'John Doe' },
    { id: '2', email: 'admin@example.com', name: 'Admin User' },
  ];

  async getUser(id: string) {
    const user = this.users.find(u => u.id === id);
    
    if (!user) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    return {
      success: true,
      data: user,
    };
  }

  async createUser(userData: any) {
    const newUser = {
      id: Date.now().toString(),
      ...userData,
    };
    
    this.users.push(newUser);
    
    return {
      success: true,
      data: newUser,
    };
  }

  async updateUser(id: string, userData: any) {
    const userIndex = this.users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    this.users[userIndex] = { ...this.users[userIndex], ...userData };
    
    return {
      success: true,
      data: this.users[userIndex],
    };
  }

  async deleteUser(id: string) {
    const userIndex = this.users.findIndex(u => u.id === id);
    
    if (userIndex === -1) {
      return {
        success: false,
        error: 'User not found',
      };
    }

    const deletedUser = this.users.splice(userIndex, 1)[0];
    
    return {
      success: true,
      data: deletedUser,
      message: 'User deleted successfully',
    };
  }
}