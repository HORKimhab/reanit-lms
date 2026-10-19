import type { LessonType } from "../catalog";
import type { CommentThread, InboxThread, LessonComment } from "./comments";
import type { LessonUnlock } from "./drip";
import type { Quiz, QuizAnswers, QuizResult } from "./quizzes";

/** A student's access to one course. */
export interface Enrollment {
  id: string;
  courseId: string;
  /** Null for lifetime access. */
  expiresAt: Date | null;
  /** When the student got the course; drip lessons count from it. */
  enrolledAt: Date;
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
  /** The lesson's drip settings; null when the school has no such lesson. */
  findLessonUnlock(lessonId: string): Promise<LessonUnlock | null>;
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

/** One school's lesson comments. `@reanit/db` implements it with `createCommentStore`. */
export interface CommentStore {
  /** Threads newest first, replies oldest first; hidden threads and replies only when asked for. */
  listThreads(lessonId: string, options: { includeHidden: boolean }): Promise<CommentThread[]>;
  /** Where a comment sits; null when the school has no such comment. */
  findComment(commentId: string): Promise<{ id: string; lessonId: string; authorId: string | null; parentId: string | null } | null>;
  createComment(comment: { lessonId: string; authorId: string; parentId: string | null; body: string; at: Date }): Promise<LessonComment>;
  /** Removes a comment and its replies. */
  deleteComment(commentId: string): Promise<void>;
  /** Returns false when the school has no such comment. */
  setHidden(commentId: string, isHidden: boolean): Promise<boolean>;
  /** Threads newest first, all or only those without a staff reply, hidden ones included. */
  listInbox(query: { isUnansweredOnly: boolean; limit: number; offset: number }): Promise<{ threads: InboxThread[]; total: number }>;
}
