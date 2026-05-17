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
import { AppElasticsearchService } from '../elasticsearch/elasticsearch.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private userRepository: UserRepository,
    private elastic: AppElasticsearchService,
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
    if (user.deletedAt) {
      throw new UnauthorizedException('Аккаунт удален');
    }
    if (user.blocked) {
      throw new UnauthorizedException('Аккаунт заблокирован');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const payload = {
      sub: user.id,
      email: user.email,
      platformRole: user.platformRole,
    };

    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        platformRole: user.platformRole,
      },
    };
  }

  async register(dto: RegisterUserDto) {
    const existingUser = await this.userRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new UnauthorizedException('User with this email already exists');
    }

    if (dto.password !== dto.passwordRepeat) {
      throw new UnauthorizedException('Passwords do not match');
    }

    try {
      const hashedPassword = await bcrypt.hash(dto.password, 10);

      const newUser = await this.userRepository.create({
        data: {
          name: dto.name,
          email: dto.email,
          password: hashedPassword,
        },
      });
      await this.elastic.indexUser({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        blocked: newUser.blocked,
        blockedReason: newUser.blockedReason,
        platformRole: newUser.platformRole,
      });

      const access_token = await this.jwtService.signAsync({
        sub: newUser.id,
        email: newUser.email,
        platformRole: newUser.platformRole,
      });

      return {
        access_token,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          platformRole: newUser.platformRole,
        },
      };
    } catch {
      throw new InternalServerErrorException();
    }
  }

  async validateUserById(userId: number): Promise<User | null> {
    const user = await this.userRepository.findById(userId);
    if (!user || user.deletedAt || user.blocked) return null;
    return user;
  }
}
