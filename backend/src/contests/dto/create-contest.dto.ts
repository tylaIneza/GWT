import { IsString, IsNumber, IsDateString, IsOptional, IsArray, Min, IsBoolean } from 'class-validator';

export class CreateContestDto {
  @IsString()  title: string;
  @IsString()  @IsOptional() description?: string;
  @IsNumber()  @Min(0) entry_fee: number;
  @IsDateString() start_time: string;
  @IsDateString() end_time: string;
  @IsNumber()  @IsOptional() max_participants?: number;
  @IsArray()   challenge_ids: string[];
  @IsBoolean() @IsOptional() is_rated?: boolean;
}
