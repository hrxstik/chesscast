import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameRepository } from './game.repository';
import { OrganizationModule } from '../organization/organization.module';
import { OptionalJwtAuthGuard } from 'src/guards/optional-jwt-auth.guard';

@Module({
  imports: [OrganizationModule],
  controllers: [GameController],
  providers: [GameService, GameRepository, OptionalJwtAuthGuard],
})
export class GameModule {}
