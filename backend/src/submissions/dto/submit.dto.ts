import { IsString, IsUUID, IsOptional, IsIn, IsObject } from 'class-validator';

export class SubmitDto {
  @IsUUID()   challenge_id: string;
  @IsString() @IsIn(['javascript', 'python']) language: string;
  @IsString() code: string;
  @IsUUID()   @IsOptional() contest_id?: string;

  // Anti-cheat metadata from frontend
  @IsObject() @IsOptional() typing_stats?: {
    keystrokes:        number;
    paste_count:       number;
    time_to_first_char: number;
    total_time_ms:     number;
  };
}
