import { IsString, IsNumber, Min, Max } from 'class-validator';

export class PlaceBetDto {
  @IsString() challenge_id: string;
  @IsNumber() @Min(100) @Max(500000) amount: number;
}
