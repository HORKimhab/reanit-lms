import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Param, Put } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";

import { Audited, pathParam } from "../audit/audit.decorator";
import { CurrentSchool, Roles, type StaffSchool } from "../schools/schools.decorators";
import { QuizBody, QuizLessonParams, QuizResponse } from "./learning.dto";
import { LEARNING_FOR_SCHOOL, type LearningForSchool } from "./learning.tokens";

/** The quiz builder's routes: a quiz lesson's pass mark and questions, with the right answers. */
@Controller("lessons/:lessonId/quiz")
@Roles("owner", "admin", "instructor")
export class QuizzesController {
  /**
   * Receives the factory for per-school learning services.
   *
   * @param learningFor Builds a learning service limited to one school.
   */
  constructor(@Inject(LEARNING_FOR_SCHOOL) private readonly learningFor: LearningForSchool) {}

  /**
   * Loads a quiz lesson for the builder; one never saved has no questions yet.
   *
   * @param school The caller's school.
   * @param params The lesson's id.
   * @returns The quiz with its right answers.
   * @throws {QuizNotFoundError} When the school has no such lesson or it is not a quiz (404).
   */
  @Get()
  @ApiOkResponse({ type: QuizResponse })
  async get(@CurrentSchool() school: StaffSchool, @Param() params: QuizLessonParams): Promise<QuizResponse> {
    return { quiz: await this.learningFor(school.id).getQuizForEditing(params.lessonId) };
  }

  /**
   * Saves a quiz lesson's pass mark and questions.
   *
   * @param school The caller's school.
   * @param params The lesson's id.
   * @param body The pass mark and questions.
   * @throws {QuizNotFoundError} When the school has no such lesson or it is not a quiz (404).
   */
  @Put()
  @Audited("lesson.quiz.save", pathParam("lessonId"))
  @HttpCode(HttpStatus.NO_CONTENT)
  async save(@CurrentSchool() school: StaffSchool, @Param() params: QuizLessonParams, @Body() body: QuizBody) {
    await this.learningFor(school.id).saveQuiz(params.lessonId, body);
  }
}
