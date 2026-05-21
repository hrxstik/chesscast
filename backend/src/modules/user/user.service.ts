import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRepository } from './user.repository';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AppElasticsearchService } from '../elasticsearch/elasticsearch.service';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly elastic: AppElasticsearchService,
  ) {}

  async findById(id: number): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return user;
  }

  async deleteById(id: number): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    const deleted = await this.userRepository.deleteById(id);
    await this.elastic.removeUser(id);
    return deleted;
  }

  async updateById(id: number, updateData: Partial<User>): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    const updated = await this.userRepository.updateById(id, updateData);
    const onlyAvatar =
      Object.keys(updateData).length === 1 && 'avatar' in updateData;
    if (!onlyAvatar) {
      this.elastic.scheduleIndexUser({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        blocked: updated.blocked,
        blockedReason: updated.blockedReason,
        platformRole: updated.platformRole,
      });
    }
    return updated;
  }

  async getPublicProfileById(id: number) {
    const user = await this.userRepository.findPublicProfileById(id);
    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }
    return {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      createdAt: user.createdAt,
      organizations: user.userOrganizations.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        role: m.role,
        blocked: m.organization.blocked,
      })),
      recentGames: user.userGames.map((x) => ({
        id: x.game.id,
        token: x.game.token,
        status: x.game.status,
        result: x.game.result,
        createdAt: x.game.createdAt,
        color: x.color,
        organization: x.game.organization,
      })),
    };
  }

  async getDashboardSummary(userId: number) {
    await this.findById(userId);
    return this.userRepository.getDashboardSummary(userId);
  }

  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string,
    confirmPassword?: string,
  ): Promise<{ success: true }> {
    if (!currentPassword || !newPassword) {
      throw new BadRequestException('Нужно указать текущий и новый пароль');
    }
    if (confirmPassword != null && newPassword !== confirmPassword) {
      throw new BadRequestException('Новый пароль и повтор не совпадают');
    }
    if (newPassword.length < 6) {
      throw new BadRequestException('Новый пароль слишком короткий');
    }
    const user = await this.findById(userId);
    if (!user.password) {
      throw new ForbiddenException('Для OAuth-аккаунта смена пароля недоступна');
    }
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      throw new ForbiddenException('Текущий пароль неверный');
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await this.userRepository.updateById(userId, { password: hashed });
    return { success: true };
  }

  async deleteByIdWithPassword(
    userId: number,
    password: string,
  ): Promise<{ success: true }> {
    if (!password) {
      throw new BadRequestException('Нужно подтвердить пароль');
    }
    const user = await this.findById(userId);
    if (!user.password) {
      throw new ForbiddenException('Для OAuth-аккаунта удаление по паролю недоступно');
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      throw new ForbiddenException('Неверный пароль');
    }
    await this.userRepository.deleteById(userId);
    return { success: true };
  }
}
