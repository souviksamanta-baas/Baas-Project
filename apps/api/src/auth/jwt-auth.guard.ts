import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { User } from '@supabase/supabase-js';

import { SupabaseService } from '../supabase/supabase.service';
import { IS_PUBLIC_KEY } from './auth.decorators';
import { resolveAuthUser } from './request-auth.helper';

export type AuthenticatedRequest = Request & { user?: User };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly supabaseService: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.user = await resolveAuthUser(
      this.supabaseService,
      request.headers.authorization,
    );
    return true;
  }
}
