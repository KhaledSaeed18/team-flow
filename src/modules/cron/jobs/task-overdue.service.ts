import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { EmailService } from '../../email/email.service';
import { EmailTemplate } from '../../email/email.types';

/**
 * Detects overdue tasks (dueDate in the past) and notifies watchers + emails assignees.
 * Runs every day at 8:00 AM.
 *
 * NotificationType.TASK_OVERDUE — sent to watchers when a task is past its due date.
 */
@Injectable()
export class TaskOverdueService {
    private readonly logger = new Logger(TaskOverdueService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
        private readonly emailService: EmailService,
    ) {}

    @Cron(CronExpression.EVERY_DAY_AT_8AM, {
        name: 'task-overdue',
    })
    async handleTaskOverdue(): Promise<void> {
        const jobStart = Date.now();
        this.logger.log('Starting task overdue check...');

        try {
            const now = new Date();

            const tasks = await this.prisma.task.findMany({
                where: {
                    dueDate: { lt: now },
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

            this.logger.log(`Found ${tasks.length} overdue task(s)`);

            let notifiedCount = 0;

            for (const task of tasks) {
                const watcherIds = task.watchers.map((w) => w.userId);

                // Notify all watchers via SSE
                if (watcherIds.length > 0) {
                    this.notificationsService
                        .createAndEmitMany(watcherIds, {
                            type: 'TASK_OVERDUE' as const,
                            title: `Task ${task.project.key}-${task.number} is overdue`,
                            body: `"${task.title}" was due ${task.dueDate!.toISOString()}`,
                            resourceType: 'Task',
                            resourceId: task.id,
                        })
                        .catch((err) => {
                            this.logger.warn(
                                `Failed to notify watchers for overdue task ${task.id}: ${err.message}`,
                            );
                        });
                    notifiedCount += watcherIds.length;
                }

                // Email the assignee
                if (task.assignedTo) {
                    this.emailService
                        .send(EmailTemplate.TASK_OVERDUE, {
                            to: task.assignedTo.email,
                            name: task.assignedTo.name,
                            taskTitle: task.title,
                            taskNumber: task.number,
                            dueDate: task.dueDate!.toISOString(),
                            projectKey: task.project.key,
                        })
                        .catch((err) => {
                            this.logger.warn(
                                `Failed to send overdue email for task ${task.id}: ${err.message}`,
                            );
                        });
                }
            }

            const duration = Date.now() - jobStart;
            this.logger.log(
                `Task overdue check completed in ${duration}ms — ` +
                    `tasks: ${tasks.length}, notifications: ${notifiedCount}`,
            );
        } catch (error) {
            const duration = Date.now() - jobStart;
            this.logger.error(
                `Task overdue check failed after ${duration}ms`,
                error instanceof Error ? error.stack : String(error),
            );
        }
    }
}
