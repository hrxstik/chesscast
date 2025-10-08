import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRepository } from '../user/user.repository';
import { RegisterUserDto } from 'src/dtos/auth/register-user.dto';
import { User } from '@prisma/client';
import { LoginUserDto } from 'src/dtos/auth/login-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private userRepository: UserRepository,
  ) {}

  generateJwt(payload) {
    return this.jwtService.sign(payload);
  }

  async login(dto: LoginUserDto) {
    if (!dto) {
      throw new BadRequestException('Unauthenticated');
    }

    const user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const payload = { sub: user.id, email: user.email };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    };
  }

  async register(dto: RegisterUserDto) {
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new UnauthorizedException(
        'Пользователь с таким email уже существует',
      );
    }

    try {
      const hashedPassword = await bcrypt.hash(dto.password, 10);

      const newUser = await this.userRepository.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
          subscriptionEnd: new Date(new Date().setFullYear(2099)),
        },
      });

      return this.generateJwt({
        sub: newUser.id,
        email: newUser.email,
      });
    } catch {
      throw new InternalServerErrorException();
    }
  }

  async validateUserById(userId: number): Promise<User | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) return null;
    return user;
  }
}
