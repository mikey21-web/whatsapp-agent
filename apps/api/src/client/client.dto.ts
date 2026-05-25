import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const VERTICALS = [
  'REAL_ESTATE',
  'CLINIC',
  'COACHING',
  'D2C',
  'HOSPITALITY',
  'EDUCATION',
  'FINANCE',
  'GENERAL',
] as const;
type Vertical = (typeof VERTICALS)[number];

export class CreateClientDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() name!: string;
  @IsString() businessName!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsIn(VERTICALS as unknown as string[]) vertical?: Vertical;
}

export class UpdateClientDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() businessName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsIn(VERTICALS as unknown as string[]) vertical?: Vertical;
}
