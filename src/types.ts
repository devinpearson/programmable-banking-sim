export interface AccessToken {
    expires_at: string
    scope: string
  }
  
  export interface Settings {
    client_id: string
    client_secret: string
    api_key: string
    token_expiry: number
    auth: boolean
  }
  
  export interface ControlMessage {
    action: string
    message: string
  }

  export type ExecutionItem = {
    executionId: string
    cardKey: string
    rootCodeFunctionId: string
    sandbox: boolean
    type: string
    authorizationApproved: boolean | null
    smsCount: number
    emailCount: number
    pushNotificationCount: number
    createdAt: Date
    startedAt: Date
    completedAt: Date
    updatedAt: Date | null
    logs: Array<any> | null // Add the 'logs' property
  }