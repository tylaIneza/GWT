import { IsString, IsUUID, IsOptional, IsIn, IsObject } from 'class-validator';

const SUPPORTED_LANGUAGES = [
  'javascript', 'typescript', 'python', 'java', 'cpp', 'csharp',
  'php', 'go', 'rust', 'swift', 'kotlin', 'ruby',
];

export class SubmitDto {
  @IsString()   challenge_id: string;
  @IsString() @IsIn(SUPPORTED_LANGUAGES) language: string;
  @IsString()   code: string;
  @IsUUID()     @IsOptional() contest_id?: string;

  @IsObject() @IsOptional() typing_stats?: {
    keystrokes:         number;
    paste_count:        number;
    time_to_first_char: number;
    total_time_ms:      number;
  };
}
