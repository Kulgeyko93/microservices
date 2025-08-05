import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  async login(data: any) {
    const { email, password: _password } = data;
    
    const user = { id: '1', email, roles: ['user'] };
    
    const payload = { sub: user.id, email: user.email, roles: user.roles };
    
    return {
      success: true,
      data: {
        user,
        access_token: this.jwtService.sign(payload),
      },
    };
  }

  async register(data: any) {
    const { email, password: _password } = data;
    
    const user = { id: Date.now().toString(), email, roles: ['user'] };
    
    return {
      success: true,
      data: {
        user,
        message: 'User registered successfully',
      },
    };
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token);
      return {
        success: true,
        data: payload,
      };
    } catch {
      return {
        success: false,
        error: 'Invalid token',
      };
    }
  }
}