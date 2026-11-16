import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { loadEnv } from "@paktenders/config";
import { PrismaService } from "../../common/prisma/prisma.service";
import { CollectionProcessorService } from "./collection-processor.service";
import { CollectionSchedulerService } from "./collection-scheduler.service";
import {
  COLLECTION_DLQ,
  COLLECTION_JOB,
  COLLECTION_QUEUE,
  type CollectSourceJobData,
} from "./collection.types";

const env = loadEnv();

export interface EnqueueResult {
  queued: boolean;
  jobId: string | null;
  reason?: string;
}

/**
 * BullMQ queue, worker and Redis locks for the collection system.
 *
 * Redis is optional infrastructure: when it is not configured the API keeps
 * running, scheduled collection stays off and administrators can still run a
 * source synchronously from the admin screen.
 */
@Injectable()
export class CollectionQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CollectionQueueService.name);
  private queue: import("bullmq").Queue | null = null;
  private deadLetter: import("bullmq").Queue | null = null;
  private worker: import("bullmq").Worker | null = null;
  private redis: import("ioredis").Redis | null = null;
  private workerRedis: import("ioredis").Redis | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly processor: CollectionProcessorService,
    private readonly scheduler: CollectionSchedulerService,
  ) {}

  get enabled(): boolean {
    return env.COLLECTION_ENABLED && Boolean(env.REDIS_URL);
  }

  get workerEnabled(): boolean {
    return this.enabled && env.COLLECTION_WORKER_ENABLED;
  }

  get ready(): boolean {
    return Boolean(this.queue && this.redis);
  }

  /**
   * True when this process can actually execute a queued job. Admin "run now"
   * falls back to a synchronous run when the worker is disabled, so a manual
   * run never sits in a queue that nobody consumes.
   */
  get canRunJobs(): boolean {
    return this.ready && this.workerEnabled;
  }

  async onModuleInit(): Promise<void> {
    if (!this.enabled) {
      this.logger.log("Collection queue is disabled (COLLECTION_ENABLED=false or REDIS_URL missing).");
      return;
    }
    try {
      const IORedis = (await import("ioredis")).default;
      const { Queue, Worker } = await import("bullmq");

      this.redis = new IORedis(env.REDIS_URL, {
        maxRetriesPerRequest: null,
        enableReadyCheck: true,
        lazyConnect: false,
      });
      this.redis.on("error", (error) => this.logger.warn(`Redis error: ${error.message}`));

      this.queue = new Queue(COLLECTION_QUEUE, {
        connection: this.redis,
        prefix: env.BULLMQ_PREFIX,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: "exponential", delay: 30_000 },
          removeOnComplete: true,
          removeOnFail: true,
        },
      });
      this.deadLetter = new Queue(COLLECTION_DLQ, {
        connection: this.redis,
        prefix: env.BULLMQ_PREFIX,
      });

      if (this.workerEnabled) {
        this.workerRedis = new IORedis(env.REDIS_URL, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: false,
        });
        this.workerRedis.on("error", (error) => this.logger.warn(`Redis worker error: ${error.message}`));
        this.worker = new Worker(
          COLLECTION_QUEUE,
          async (job) => this.handleJob(job.name, job.data),
          {
            connection: this.workerRedis,
            prefix: env.BULLMQ_PREFIX,
            concurrency: env.COLLECTION_CONCURRENCY,
            lockDuration: 10 * 60_000,
          },
        );
        this.worker.on("failed", (job, error) => {
          const attempts = job?.opts?.attempts ?? 1;
          const made = job?.attemptsMade ?? 1;
          if (made < attempts) {
            this.logger.warn(
              `Collection job ${job?.name ?? "unknown"} failed (attempt ${made}/${attempts}); BullMQ will retry. ${error.message}`,
            );
            return;
          }
          void this.onJobFailed(job?.name ?? "unknown", job?.data, error);
        });
        this.worker.on("error", (error) => this.logger.error(`Collection worker error: ${error.message}`));
        this.logger.log(`Collection worker started (concurrency ${env.COLLECTION_CONCURRENCY}).`);
      }

      await this.registerSchedulers();
      void this.tick().catch((error: unknown) => {
        this.logger.warn(`Initial collection tick failed: ${error instanceof Error ? error.message : String(error)}`);
      });
    } catch (error) {
      this.logger.error(
        `Collection queue could not start: ${error instanceof Error ? error.message : String(error)}. Admin runs will use synchronous mode.`,
      );
      await this.closeResources();
    }
  }

  private async registerSchedulers(): Promise<void> {
    if (!this.queue) return;
    await this.queue.upsertJobScheduler(
      "collection-scheduler-tick",
      { every: 60_000 },
      { name: "scheduler-tick", data: {} },
    );
    await this.queue.upsertJobScheduler(
      "collection-deadline-reconciliation",
      { pattern: env.COLLECTION_DEADLINE_CRON, tz: "Asia/Karachi" },
      { name: COLLECTION_JOB.reconcileDeadlines, data: {} },
    );
    await this.queue.upsertJobScheduler(
      "collection-source-reconciliation",
      { pattern: env.COLLECTION_RECONCILE_CRON, tz: "Asia/Karachi" },
      { name: COLLECTION_JOB.reconcileSources, data: {} },
    );
    this.logger.log("Collection job schedulers registered.");
  }

  private async handleJob(name: string, data: unknown): Promise<unknown> {
    if (name === "scheduler-tick") return this.tick();
    if (name === COLLECTION_JOB.collectSource) {
      const job = data as CollectSourceJobData;
      const lockKey = `collection:lock:source:${job.sourceId}`;
      const token = await this.acquireLock(lockKey, 30 * 60_000);
      if (!token) {
        this.logger.warn(`Skipping ${job.sourceId}: another collection run holds the lock.`);
        // A manual run may be queued while the scheduled run for the same
        // source is still working. Do not leave its SourceRun stuck at QUEUED.
        if (job.runId) {
          await this.prisma.client.sourceRun
            .updateMany({
              where: { id: job.runId, status: { in: ["QUEUED", "RUNNING"] } },
              data: {
                status: "SKIPPED",
                finishedAt: new Date(),
                errorSummary:
                  "Skipped because another collection run for this source was already in progress.",
              },
            })
            .catch((error: unknown) => {
              this.logger.warn(
                `Could not mark skipped run ${job.runId}: ${error instanceof Error ? error.message : String(error)}`,
              );
            });
        }
        return { skipped: true, reason: "locked" };
      }
      try {
        return await this.processor.processJob(job);
      } finally {
        await this.releaseLock(lockKey, token);
      }
    }
    if (name === COLLECTION_JOB.reconcileDeadlines) return this.scheduler.reconcileDeadlines();
    if (name === COLLECTION_JOB.reconcileSources) {
      const sourceIds = await this.scheduler.reconcileSources();
      for (const [index, sourceId] of sourceIds.entries()) {
        await this.enqueueSource(sourceId, "SCHEDULE", { delayMs: Math.min(index * 5_000, 10 * 60_000) });
      }
      return { enqueued: sourceIds.length };
    }
    this.logger.warn(`Unknown collection job "${name}" ignored.`);
    return { skipped: true };
  }

  private async onJobFailed(name: string, data: unknown, error: Error): Promise<void> {
    const sourceId = (data as CollectSourceJobData | undefined)?.sourceId;
    this.logger.error(`Collection job ${name} failed: ${error.message}`);
    try {
      if (this.deadLetter) {
        await this.deadLetter.add(
          "dead-letter",
          { name, data, error: error.message, failedAt: new Date().toISOString() },
          { removeOnComplete: { age: 30 * 24 * 3600, count: 1000 } },
        );
      }
      if (sourceId) await this.processor.recordDeadLetter(sourceId, error.message);
    } catch (deadLetterError) {
      this.logger.error(
        `Could not record the dead letter: ${deadLetterError instanceof Error ? deadLetterError.message : String(deadLetterError)}`,
      );
    }
  }

  async enqueueSource(
    sourceId: string,
    trigger: CollectSourceJobData["trigger"],
    options: { delayMs?: number; runId?: string; manual?: boolean } = {},
  ): Promise<EnqueueResult> {
    if (!this.queue) {
      return { queued: false, jobId: null, reason: "The collection queue is not available." };
    }
    const jobId = options.manual ? `manual-${sourceId}` : `source-${sourceId}`;
    try {
      // BullMQ would return the existing job for a repeated jobId, leaving the
      // caller's new SourceRun waiting forever. Report the collision instead.
      const existing = await this.queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (["waiting", "active", "delayed", "prioritized", "waiting-children"].includes(state)) {
          return {
            queued: false,
            jobId,
            reason: "A collection job for this source is already queued or running.",
          };
        }
      }
      await this.queue.add(
        COLLECTION_JOB.collectSource,
        { sourceId, trigger, runId: options.runId } satisfies CollectSourceJobData,
        {
          jobId,
          delay: options.delayMs ?? 0,
          priority: trigger === "MANUAL" ? 1 : 10,
        },
      );
      return { queued: true, jobId };
    } catch (error) {
      return {
        queued: false,
        jobId: null,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Finds enabled sources whose nextRunAt has passed and enqueues one job per
   * source. nextRunAt is advanced in a conditional update so two API instances
   * cannot enqueue the same source twice.
   */
  async tick(): Promise<{ enqueued: number; due: number }> {
    if (!this.ready) return { enqueued: 0, due: 0 };
    const now = new Date();
    const due = await this.prisma.client.tenderSource.findMany({
      where: {
        isEnabled: true,
        status: "ACTIVE",
        connectorKey: { not: "manual" },
        collectionMethod: { not: "MANUAL_IMPORT" },
        OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
      },
      orderBy: [{ priority: "asc" }, { nextRunAt: "asc" }],
      take: 50,
      select: { id: true, scheduleMinutes: true },
    });

    let enqueued = 0;
    for (const source of due) {
      const nextRunAt = new Date(now.getTime() + Math.max(1, source.scheduleMinutes) * 60_000);
      const claimed = await this.prisma.client.tenderSource.updateMany({
        where: {
          id: source.id,
          OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
        },
        data: { nextRunAt },
      });
      if (claimed.count === 0) continue;
      const result = await this.enqueueSource(source.id, "SCHEDULE");
      if (result.queued) enqueued += 1;
    }
    return { enqueued, due: due.length };
  }

  async acquireLock(key: string, ttlMs: number): Promise<string | null> {
    if (!this.redis) return null;
    const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const result = await this.redis.set(key, token, "PX", ttlMs, "NX");
    return result === "OK" ? token : null;
  }

  async releaseLock(key: string, token: string): Promise<void> {
    if (!this.redis) return;
    await this.redis.eval(
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end',
      1,
      key,
      token,
    );
  }

  async status(): Promise<{
    enabled: boolean;
    workerEnabled: boolean;
    ready: boolean;
    waiting: number;
    active: number;
    delayed: number;
    failed: number;
    completed: number;
    deadLetters: number;
  }> {
    if (!this.queue) {
      return {
        enabled: this.enabled,
        workerEnabled: this.workerEnabled,
        ready: false,
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 0,
        deadLetters: 0,
      };
    }
    const counts = await this.queue.getJobCounts("waiting", "active", "delayed", "failed", "completed");
    const deadLetterCounts = this.deadLetter
      ? await this.deadLetter.getJobCounts("waiting", "active", "delayed", "failed", "completed")
      : null;
    const deadLetters = deadLetterCounts
      ? Object.values(deadLetterCounts).reduce((sum, value) => sum + (value ?? 0), 0)
      : 0;
    return {
      enabled: this.enabled,
      workerEnabled: this.workerEnabled,
      ready: this.ready,
      waiting: counts.waiting ?? 0,
      active: counts.active ?? 0,
      delayed: counts.delayed ?? 0,
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
      deadLetters,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeResources();
  }

  /** Recent dead-letter entries, newest first, for the admin diagnostics screen. */
  async deadLetters(limit = 20): Promise<
    Array<{
      id: string | null;
      name: string;
      sourceId: string | null;
      error: string;
      failedAt: string | null;
      payload: unknown;
    }>
  > {
    if (!this.deadLetter) return [];
    const jobs = await this.deadLetter.getJobs(["waiting", "delayed", "failed", "completed"], 0, limit - 1, false);
    return jobs.map((job) => {
      const data = (job.data ?? {}) as {
        name?: string;
        data?: { sourceId?: string };
        error?: string;
        failedAt?: string;
      };
      return {
        id: job.id ?? null,
        name: data.name ?? job.name,
        sourceId: data.data?.sourceId ?? null,
        error: data.error ?? "Unknown error",
        failedAt: data.failedAt ?? null,
        payload: job.data,
      };
    });
  }

  /** Re-queues the source named in a dead-letter entry and removes the entry. */
  async retryDeadLetter(
    jobId: string,
  ): Promise<{ retried: boolean; sourceId: string | null; reason?: string }> {
    if (!this.deadLetter) return { retried: false, sourceId: null, reason: "The dead-letter queue is not available." };
    const job = await this.deadLetter.getJob(jobId);
    if (!job) return { retried: false, sourceId: null, reason: "Dead-letter entry not found." };
    const data = (job.data ?? {}) as { data?: { sourceId?: string } };
    const sourceId = data.data?.sourceId ?? null;
    if (!sourceId) {
      await job.remove();
      return { retried: false, sourceId: null, reason: "The entry does not reference a source." };
    }
    const result = await this.enqueueSource(sourceId, "RETRY", { manual: true });
    if (!result.queued) return { retried: false, sourceId, reason: result.reason };
    await job.remove();
    return { retried: true, sourceId };
  }

  private async closeResources(): Promise<void> {
    try {
      await this.worker?.close();
    } catch {
      // Already closed.
    }
    try {
      await this.queue?.close();
    } catch {
      // Already closed.
    }
    try {
      await this.deadLetter?.close();
    } catch {
      // Already closed.
    }
    this.worker = null;
    this.queue = null;
    this.deadLetter = null;
    this.workerRedis?.disconnect();
    this.redis?.disconnect();
    this.workerRedis = null;
    this.redis = null;
  }
}
