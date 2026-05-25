import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

const ROLES = ['ADMIN', 'SUPERVISOR', 'AGENT'] as const;
type Role = (typeof ROLES)[number];

export class CreateTeamMemberDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() name!: string;
  @IsOptional() @IsIn(ROLES as unknown as string[]) role?: Role;
}

export class UpdateTeamMemberDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsIn(ROLES as unknown as string[]) role?: Role;
}
