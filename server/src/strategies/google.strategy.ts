import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth2';
import { User } from '@prisma/client';
import { UserRepository } from 'src/modules/user/user.repository';
import config from '../config/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(config.KEY) private configService: ConfigType<typeof config>,
    private readonly userRepository: UserRepository,
  ) {
    super({
      clientID: configService.clientID,
      clientSecret: configService.clientSecret,
      callbackURL: configService.callbackURL,
      scope: ['profile', 'email'],
    });
  }

  // TODO
  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;
    const user = await this.userRepository.findByEmail(emails[0].value);
    if (!user) {
      const newUser = await this.userRepository.create({
        data: {
          provider: 'google',
          providerId: id,
          email: emails[0].value,
          name: `${name.givenName} ${name.familyName}`,
          avatar: photos[0]?.value,
        },
      });
      return done(null, newUser);
    }
    return done(null, user);
  }
}
