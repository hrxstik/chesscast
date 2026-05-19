import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameRepository } from './game.repository';
import { OrganizationModule } from '../organization/organization.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [OrganizationModule, AuthModule],
  controllers: [GameController],
  providers: [GameService, GameRepository],
})
export class GameModule {}
