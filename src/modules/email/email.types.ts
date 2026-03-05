export enum EmailTemplate {
    INVITATION = 'invitation',
    WELCOME = 'welcome',
    PASSWORD_RESET = 'password-reset',
    TASK_ASSIGNED = 'task-assigned',
    TASK_DUE_SOON = 'task-due-soon',
    TASK_OVERDUE = 'task-overdue',
}

export interface EmailPayloadMap {
    [EmailTemplate.INVITATION]: {
        to: string;
        orgName: string;
        token: string;
        inviterName: string;
    };
    [EmailTemplate.WELCOME]: {
        to: string;
        name: string;
        orgName: string;
    };
    [EmailTemplate.PASSWORD_RESET]: {
        to: string;
        name: string;
        resetUrl: string;
    };
    [EmailTemplate.TASK_ASSIGNED]: {
        to: string;
        name: string;
        taskTitle: string;
        taskUrl: string;
    };
    [EmailTemplate.TASK_DUE_SOON]: {
        to: string;
        name: string;
        taskTitle: string;
        taskNumber: number;
        dueDate: string;
        projectKey: string;
    };
    [EmailTemplate.TASK_OVERDUE]: {
        to: string;
        name: string;
        taskTitle: string;
        taskNumber: number;
        dueDate: string;
        projectKey: string;
    };
}
