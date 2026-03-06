export enum EmailTemplate {
    INVITATION = 'invitation',
    WELCOME = 'welcome',
    PASSWORD_RESET = 'password-reset',
    TASK_ASSIGNED = 'task-assigned',
    TASK_DUE_SOON = 'task-due-soon',
    TASK_OVERDUE = 'task-overdue',
    EMAIL_VERIFICATION = 'email-verification',
    PASSWORD_RESET_OTP = 'password-reset-otp',
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
    [EmailTemplate.EMAIL_VERIFICATION]: {
        to: string;
        name: string;
        code: string;
        expiresInMinutes: number;
    };
    [EmailTemplate.PASSWORD_RESET_OTP]: {
        to: string;
        name: string;
        code: string;
        expiresInMinutes: number;
    };
}
