import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const IS_API_KEY = 'isApiKey';
export const ApiKey = () => SetMetadata(IS_API_KEY, true);
