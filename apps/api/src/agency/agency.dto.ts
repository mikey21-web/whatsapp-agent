import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateAgencyDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() name!: string;
  @IsString() slug!: string;
  @IsOptional() @IsString() brandColor?: string;
  @IsOptional() @IsIn(['STARTER', 'GROWTH', 'SCALE']) plan?: 'STARTER' | 'GROWTH' | 'SCALE';
}

export class UpdateAgencyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() brandColor?: string;
  @IsOptional() @IsIn(['STARTER', 'GROWTH', 'SCALE']) plan?: 'STARTER' | 'GROWTH' | 'SCALE';
}
