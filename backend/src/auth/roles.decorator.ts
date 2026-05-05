import { SetMetadata } from '@nestjs/common';

export const Roles       = (...roles: string[]) => SetMetadata('roles', roles);
export const Public      = ()                   => SetMetadata('isPublic', true);
export const AdminOnly   = ()                   => Roles('admin');
export const CurrentUser = () => {
  const { createParamDecorator, ExecutionContext } = require('@nestjs/common');
  return createParamDecorator((_: unknown, ctx: typeof ExecutionContext) => {
    return ctx.switchToHttp().getRequest().user;
  })();
};
