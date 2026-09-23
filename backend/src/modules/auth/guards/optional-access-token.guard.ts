import { ExecutionContext, Injectable } from '@nestjs/common';
import { AccessTokenGuard } from './access-token.guard';

/** Guests may browse; supplied credentials must pass the normal session checks. */
@Injectable()
export class OptionalAccessTokenGuard extends AccessTokenGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (request.headers.authorization === undefined) return true;
    return super.canActivate(context);
  }
}
