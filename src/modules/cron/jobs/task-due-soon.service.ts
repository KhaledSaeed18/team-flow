import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { EmailService } from '../../email/email.service';
import { EmailTemplate } from '../../email/email.types';

/**
 * Alerts watchers and assignees about tasks due within the next 24 hours.
 * Runs every 6 hours to balance timeliness against performance.
 *
 * NotificationType.TASK_DUE_SOON — sent to watchers when due date approaches.
 */
@Injectable()
export class TaskDueSoonService {
    private readonly logger = new Logger(TaskDueSoonService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
        private readonly emailService: EmailService,
    ) {}

    @Cron(CronExpression.EVERY_6_HOURS, {
        name: 'task-due-soon',
    })
    async handleTaskDueSoon(): Promise<void> {
        const jobStart = Date.now();
        this.logger.log('Starting task due-soon check...');

        try {
            const now = new Date();
            const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

            const tasks = await this.prisma.task.findMany({
                where: {
                    dueDate: { gte: now, lte: in24h },
                    deletedAt: null,
                    status: { notIn: ['DONE', 'CANCELLED'] },
                },
                include: {
                    project: { select: { key: true } },
                    assignedTo: {
                        select: { id: true, name: true, email: true },
                    },
                    watchers: { select: { userId: true } },
                },
            });

            this.logger.log(
                `Found ${tasks.length} task(s) due within 24 hours`,
            );

            let notifiedCount = 0;

            for (const task of tasks) {
                const watcherIds = task.watchers.map((w) => w.userId);

                // Notify all watchers via SSE
                if (watcherIds.length > 0) {
                    this.notificationsService
                        .createAndEmitMany(watcherIds, {
                            type: 'TASK_DUE_SOON' as const,
                            title: `Task ${task.project.key}-${task.number} is due soon`,
                            body: `"${task.title}" is due ${task.dueDate!.toISOString()}`,
                            resourceType: 'Task',
                            resourceId: task.id,
                        })
                        .catch((err) => {
                            this.logger.warn(
                                `Failed to notify watchers for task ${task.id}: ${err.message}`,
                            );
                        });
                    notifiedCount += watcherIds.length;
                }

                // Email the assignee
                if (task.assignedTo) {
                    this.emailService
                        .send(EmailTemplate.TASK_DUE_SOON, {
                            to: task.assignedTo.email,
                            name: task.assignedTo.name,
                            taskTitle: task.title,
                            taskNumber: task.number,
                            dueDate: task.dueDate!.toISOString(),
                            projectKey: task.project.key,
                        })
                        .catch((err) => {
                            this.logger.warn(
                                `Failed to send due-soon email for task ${task.id}: ${err.message}`,
                            );
                        });
                }
            }

            const duration = Date.now() - jobStart;
            this.logger.log(
                `Task due-soon check completed in ${duration}ms — ` +
                    `tasks: ${tasks.length}, notifications: ${notifiedCount}`,
            );
        } catch (error) {
            const duration = Date.now() - jobStart;
            this.logger.error(
                `Task due-soon check failed after ${duration}ms`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }
}
