import { Equals, IsBoolean, IsIn, IsOptional, IsEmail, IsString, Length, MaxLength, MinLength, Matches } from 'class-validator';
export class LoginDto {
 @IsOptional() @IsIn(['web', 'mobile']) client?: 'web' | 'mobile';
 @IsOptional() @IsBoolean() remember?: boolean;
 @IsEmail() @MaxLength(254) email!: string;
 @IsString() @MinLength(1) @MaxLength(72) password!: string;
}
export class RegisterDto extends LoginDto {
 @IsString() @Length(2, 60) username!: string;
 @IsString() @MinLength(8) @MaxLength(72) declare password: string;
 @IsBoolean() @Equals(true) acceptedTerms!: boolean;
}

export class ForgotPasswordDto {
 @IsEmail() @MaxLength(254) email!: string;
}
export class ResetPasswordDto {
 @IsString() @Matches(/^[a-f0-9]{64}$/) token!: string;
 @IsString() @MinLength(8) @MaxLength(72) password!: string;
}
