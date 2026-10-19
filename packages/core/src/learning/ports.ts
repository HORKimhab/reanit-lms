import type { LessonType } from "../catalog";
import type { Quiz, QuizAnswers, QuizResult } from "./quizzes";

/** A student's access to one course. */
export interface Enrollment {
  id: string;
  courseId: string;
  /** Null for lifetime access. */
  expiresAt: Date | null;
}

/** Where a student is in one lesson. */
export interface LessonProgress {
  lessonId: string;
  /** Where the video was last playing; 0 for other lessons. */
  positionSeconds: number;
  isCompleted: boolean;
}

/** What a heartbeat or "complete" saves; an omitted field keeps its stored value, and a completed lesson stays completed. */
export interface ProgressUpdate {
  positionSeconds?: number;
  completed?: boolean;
}

/** One school's enrollments and lesson progress. `@reanit/db` implements it with `createLearningStore`. */
export interface LearningStore {
  findEnrollment(userId: string, courseId: string): Promise<Enrollment | null>;
  /** The enrollment in the course the lesson belongs to; null when there is none or no such lesson. */
  findEnrollmentForLesson(userId: string, lessonId: string): Promise<Enrollment | null>;
  listProgress(enrollmentId: string): Promise<LessonProgress[]>;
  saveProgress(enrollmentId: string, lessonId: string, update: ProgressUpdate): Promise<void>;
  /** Lessons the course has, and how many of them the enrollment completed. */
  countLessons(enrollmentId: string, courseId: string): Promise<{ completed: number; total: number }>;
  /**
   * Marks the enrollment's course completed and counts it in the day's completions, once:
   * a repeat for an enrollment already completed changes nothing.
   */
  completeCourse(enrollment: Enrollment, at: Date): Promise<void>;
}

/** A student's latest go at a quiz. */
export interface QuizAttemptSummary {
  scorePercent: number;
  isPassed: boolean;
  at: Date;
}

/** One school's quizzes and attempts. `@reanit/db` implements it with `createQuizStore`. */
export interface QuizStore {
  /** Null when the school has no such lesson. */
  findLessonType(lessonId: string): Promise<LessonType | null>;
  /** Null until the lesson's quiz is first saved. */
  findQuiz(lessonId: string): Promise<Quiz | null>;
  saveQuiz(lessonId: string, quiz: Quiz): Promise<void>;
  recordAttempt(attempt: { enrollmentId: string; lessonId: string; answers: QuizAnswers; result: QuizResult; at: Date }): Promise<void>;
  /** The enrollment's most recent attempt at the lesson's quiz, or null before the first. */
  findLastAttempt(enrollmentId: string, lessonId: string): Promise<QuizAttemptSummary | null>;
}
