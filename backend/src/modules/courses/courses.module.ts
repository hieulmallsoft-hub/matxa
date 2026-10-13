import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoursesController, AdminCoursesController } from './courses.controller';
import { CoursesService } from './courses.service';

@Module({ imports: [AuthModule], controllers: [CoursesController, AdminCoursesController], providers: [CoursesService] })
export class CoursesModule {}
