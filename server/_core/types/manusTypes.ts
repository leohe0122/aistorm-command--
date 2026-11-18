// Manus 托管平台的定时任务回调身份类型；随定时任务改造一并删除。

export interface GetUserInfoWithJwtRequest {
  jwtToken: string;
  projectId: string;
}

export interface GetUserInfoWithJwtResponse {
  openId: string;
  projectId: string;
  name: string;
  email?: string | null;
  platform?: string | null;
  loginMethod?: string | null;
  /** Cron-only; references `schedule_task.uid`. */
  taskUid?: string | null;
}
