import { IsString, IsArray, IsBoolean, IsNumber, IsOptional, IsIn, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class TestCaseDto {
  @IsString() input: string;
  @IsString() expected_output: string;
  @IsBoolean() @IsOptional() is_sample?: boolean;
  @IsBoolean() @IsOptional() is_hidden?: boolean;
  @IsNumber()  @IsOptional() points?: number;
  @IsString()  @IsOptional() explanation?: string;
}

export class CreateChallengeDto {
  @IsString() title: string;
  @IsString() description: string;
  @IsIn(['easy','medium','hard']) difficulty: string;
  @IsString() @IsOptional() category?: string;
  @IsArray()  @IsOptional() supported_languages?: string[];
  @IsNumber()  @IsOptional() @Min(1000) @Max(30000)  time_limit_ms?: number;
  @IsNumber()  @IsOptional() @Min(32)   @Max(1024)   memory_limit_mb?: number;
  @IsNumber()  @IsOptional() @Min(1)    @Max(50)     max_submissions?: number;
  @IsNumber()  @IsOptional() submission_cooldown_seconds?: number;
  @IsBoolean() @IsOptional() is_published?: boolean;
  @IsBoolean() @IsOptional() randomize_inputs?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TestCaseDto)
  test_cases: TestCaseDto[];
}
